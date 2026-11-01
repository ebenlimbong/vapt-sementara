import "dotenv/config";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { checkScopeGuard } from "../src/lib/ssrf-guard";
import { checkScanPermission } from "../src/lib/scan-permission";
import { maskJson } from "../src/lib/mask";
import { decryptSecret } from "../src/lib/crypto";
import { checkResponseHeaders, checkResponseBody, extractSameOriginLinks, type RawCheckFinding } from "./checks";
import { runHttpxTechDetect, runNucleiScan } from "./realtools";

const POLL_INTERVAL_MS = 3000;
const FETCH_TIMEOUT_MS = 8000;

/**
 * Worker scan — proses Node.js terpisah yang mengambil job dari tabel scan_jobs
 * (PostgreSQL sebagai antrean, sesuai PRD §5/§7). Tidak ada broker tambahan.
 *
 * Kontrak jobType:
 *  - web_scan: scope_version.content berisi { targetUrl, allowedHosts?: string[] }.
 *    Tahap: validasi_scope -> spider_terbatas -> header_cookie -> info_disclosure -> normalisasi.
 *  - api_access_test: AccessScenario rows yang sudah diberi jobId = job ini (dibuat oleh
 *    API modul Uji Akses API sebelum job di-enqueue). Tahap: validasi_scope -> jalankan_skenario -> normalisasi.
 *  - retest: scope_version sama dengan job asal; Retest row dibuat SETELAH job ini selesai,
 *    dengan hasil ditentukan dari apakah kandidat/skenario asal masih terdeteksi.
 */

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, redirect: "manual", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getAllowedHostsEnv(): string[] {
  return (process.env.ALLOWED_SCAN_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

async function logEvent(jobId: string, stage: string, status: "mulai" | "selesai" | "gagal", message?: string) {
  await prisma.scanJobEvent.create({
    data: { jobId, stage, status, message: message ? JSON.stringify(maskJson({ message })) : null },
  });
}

async function setProgress(jobId: string, stage: string, pct: number) {
  await prisma.scanJob.update({ where: { id: jobId }, data: { currentStage: stage, progressPct: pct } });
}

async function isCancelled(jobId: string): Promise<boolean> {
  const job = await prisma.scanJob.findUnique({ where: { id: jobId }, select: { cancelRequested: true } });
  return job?.cancelRequested ?? false;
}

/** Validasi ulang approval aktif & jendela waktu SAAT eksekusi (bukan hanya saat enqueue). */
async function validateApprovalAndWindow(requestId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const result = await checkScanPermission(requestId);
  if (!result.allowed) return { ok: false, reason: result.reason };
  return { ok: true };
}

async function saveCandidateDeduped(jobId: string, appId: string, f: RawCheckFinding) {
  const existing = await prisma.candidate.findFirst({
    where: {
      normalizedKey: f.normalizedKey,
      status: { not: "alarm_palsu" },
      job: { request: { appId } },
    },
  });
  if (existing) return; // hasil serupa dari scan berulang digabung, tidak dobel

  await prisma.candidate.create({
    data: {
      jobId,
      title: f.title,
      category: f.category,
      normalizedKey: f.normalizedKey,
      rawPayload: maskJson(f.rawPayload) as Prisma.InputJsonValue,
      status: "baru",
    },
  });
}

async function runWebScan(job: { id: string; requestId: string; scopeVersionId: string }) {
  const scope = await prisma.scopeVersion.findUnique({ where: { id: job.scopeVersionId } });
  const request = await prisma.testRequest.findUnique({ where: { id: job.requestId }, include: { app: true } });
  if (!scope || !request) throw new Error("Scope atau request tidak ditemukan");

  const content = (scope.content ?? {}) as { allowedHosts?: string[] };
  const targetUrl = request.targetUrl;
  const allowedHosts = Array.from(
    new Set([new URL(request.app.baseUrl).hostname, new URL(targetUrl).hostname, ...(content.allowedHosts ?? []), ...getAllowedHostsEnv()])
  );

  const stages = [
    "validasi_scope",
    "spider_terbatas",
    "header_cookie",
    "info_disclosure",
    "fingerprint_tech",
    "kerentanan_nuclei",
    "normalisasi",
  ];
  const stepPct = Math.floor(100 / stages.length);

  // Tahap 1: validasi scope
  await logEvent(job.id, "validasi_scope", "mulai");
  const guard = await checkScopeGuard(targetUrl, allowedHosts);
  if (!guard.allowed) {
    await logEvent(job.id, "validasi_scope", "gagal", guard.reason);
    throw new Error(`Target di luar cakupan: ${guard.reason}`);
  }
  await logEvent(job.id, "validasi_scope", "selesai");
  await setProgress(job.id, "validasi_scope", stepPct);
  if (await isCancelled(job.id)) return "cancelled";

  // Tahap 2: spider terbatas
  await logEvent(job.id, "spider_terbatas", "mulai");
  const urlsToCheck = new Set<string>([targetUrl]);
  try {
    const res = await fetchWithTimeout(targetUrl);
    const html = await res.text();
    for (const link of extractSameOriginLinks(targetUrl, html)) {
      const linkGuard = await checkScopeGuard(link, allowedHosts);
      if (linkGuard.allowed) urlsToCheck.add(link);
    }
  } catch (e) {
    await logEvent(job.id, "spider_terbatas", "gagal", `Gagal memuat target awal: ${(e as Error).message}`);
  }
  await logEvent(job.id, "spider_terbatas", "selesai", `${urlsToCheck.size} URL dalam cakupan akan diperiksa`);
  await setProgress(job.id, "spider_terbatas", stepPct * 2);
  if (await isCancelled(job.id)) return "cancelled";

  // Tahap 3 & 4: header/cookie + info disclosure
  await logEvent(job.id, "header_cookie", "mulai");
  await logEvent(job.id, "info_disclosure", "mulai");
  let candidateCount = 0;
  for (const url of urlsToCheck) {
    const guard = await checkScopeGuard(url, allowedHosts);
    if (!guard.allowed) continue;
    try {
      const res = await fetchWithTimeout(url);
      const headerFindings = checkResponseHeaders(url, res.headers);
      const body = await res.text();
      const bodyFindings = checkResponseBody(url, body);
      for (const f of [...headerFindings, ...bodyFindings]) {
        await saveCandidateDeduped(job.id, request.appId, f);
        candidateCount++;
      }
    } catch (e) {
      await logEvent(job.id, "header_cookie", "gagal", `Gagal memeriksa ${url}: ${(e as Error).message}`);
    }
  }
  await logEvent(job.id, "header_cookie", "selesai", `${candidateCount} kandidat terkumpul`);
  await logEvent(job.id, "info_disclosure", "selesai");
  await setProgress(job.id, "info_disclosure", stepPct * 4);
  if (await isCancelled(job.id)) return "cancelled";

  // Tahap 5: fingerprint teknologi + versi (httpx, dataset Wappalyzer) — real tool,
  // bukan heuristik regex. Dilewati dengan jelas kalau binary tidak terpasang di worker.
  await logEvent(job.id, "fingerprint_tech", "mulai");
  try {
    const { findings, ran } = await runHttpxTechDetect(targetUrl, () => isCancelled(job.id));
    if (!ran) {
      await logEvent(job.id, "fingerprint_tech", "selesai", "Dilewati: binary httpx tidak ditemukan di worker ini");
    } else {
      for (const f of findings) await saveCandidateDeduped(job.id, request.appId, f);
      await logEvent(job.id, "fingerprint_tech", "selesai", `${findings.length} teknologi terdeteksi`);
    }
  } catch (e) {
    await logEvent(job.id, "fingerprint_tech", "gagal", (e as Error).message);
  }
  await setProgress(job.id, "fingerprint_tech", stepPct * 5);
  if (await isCancelled(job.id)) return "cancelled";

  // Tahap 6: kerentanan tervalidasi via nuclei (template komunitas: CVE versi-spesifik,
  // exposure, misconfig). Tag intrusif/DoS/fuzzing/bruteforce DIKECUALIKAN secara eksplisit
  // (PRD §2: di luar cakupan). Dilewati dengan jelas kalau binary tidak terpasang.
  await logEvent(job.id, "kerentanan_nuclei", "mulai");
  try {
    const { findings, ran } = await runNucleiScan(
      targetUrl,
      // "tech" sengaja TIDAK disertakan — sudah ditangani httpx di tahap fingerprint_tech,
      // menyertakannya di sini menambah ~1200 template dan terbukti membuat scan gagal
      // selesai dalam batas waktu. Severity info/low untuk exposure/misconfig juga
      // dikecualikan dulu untuk menjaga waktu scan realistis (lihat catatan tuning di README).
      { tags: "cve,exposure,misconfig", severity: "medium,high,critical", timeoutMs: 260_000 },
      () => isCancelled(job.id)
    );
    if (!ran) {
      await logEvent(job.id, "kerentanan_nuclei", "selesai", "Dilewati: binary nuclei tidak ditemukan di worker ini");
    } else {
      for (const f of findings) await saveCandidateDeduped(job.id, request.appId, f);
      await logEvent(job.id, "kerentanan_nuclei", "selesai", `${findings.length} temuan dari template nuclei`);
    }
  } catch (e) {
    await logEvent(job.id, "kerentanan_nuclei", "gagal", (e as Error).message);
  }
  await setProgress(job.id, "kerentanan_nuclei", stepPct * 6);
  if (await isCancelled(job.id)) return "cancelled";

  // Tahap 7: normalisasi (dedup sudah dilakukan saat simpan)
  await logEvent(job.id, "normalisasi", "mulai");
  await logEvent(job.id, "normalisasi", "selesai");
  await setProgress(job.id, "normalisasi", 100);
  return "done";
}

async function runApiAccessTest(job: { id: string }) {
  await logEvent(job.id, "validasi_scope", "mulai");
  const scenarios = await prisma.accessScenario.findMany({
    where: { jobId: job.id },
    include: { endpoint: { include: { spec: { include: { app: true } } } }, actorAccount: true },
  });
  if (scenarios.length === 0) {
    await logEvent(job.id, "validasi_scope", "gagal", "Tidak ada skenario ekspektasi akses untuk job ini");
    throw new Error("Tidak ada skenario untuk dijalankan");
  }
  await logEvent(job.id, "validasi_scope", "selesai");
  await setProgress(job.id, "validasi_scope", 20);
  if (await isCancelled(job.id)) return "cancelled";

  await logEvent(job.id, "jalankan_skenario", "mulai");
  const allowedHosts = getAllowedHostsEnv();
  let deviasi = 0;

  for (const sc of scenarios) {
    const app = sc.endpoint.spec.app;
    const base = app.baseUrl.replace(/\/$/, "");
    const url = base + sc.endpoint.path;
    const guard = await checkScopeGuard(url, Array.from(new Set([new URL(app.baseUrl).hostname, ...allowedHosts])));
    if (!guard.allowed) {
      await prisma.accessScenario.update({ where: { id: sc.id }, data: { actual: "blocked_out_of_scope", verdict: "menyimpang" } });
      continue;
    }

    const headers: Record<string, string> = {};
    if (sc.actorAccount) {
      try {
        const token = await getCredentialValue(sc.actorAccount.credentialRef);
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch {
        // kredensial tidak tersedia -> request tanpa auth (mensimulasikan unauthenticated)
      }
    }

    let actualOutcome = "error";
    try {
      const res = await fetchWithTimeout(url, { method: sc.endpoint.method, headers });
      actualOutcome = res.status < 300 ? "allow" : res.status === 401 || res.status === 403 ? "deny" : `status_${res.status}`;
    } catch {
      actualOutcome = "error";
    }

    const verdict = actualOutcome === sc.expected ? "sesuai" : "menyimpang";
    if (verdict === "menyimpang") deviasi++;

    await prisma.accessScenario.update({
      where: { id: sc.id },
      data: { actual: actualOutcome, verdict },
    });

    if (verdict === "menyimpang") {
      await saveCandidateDeduped(job.id, app.id, {
        title: `Akses menyimpang: role ${sc.actorRole} pada ${sc.endpoint.method} ${sc.endpoint.path}`,
        category: "header", // kategori generik di schema candidates; detail di rawPayload
        normalizedKey: `api_access:${app.id}:${sc.endpoint.method}:${sc.endpoint.path}:${sc.actorRole}`,
        rawPayload: { expected: sc.expected, actual: actualOutcome, role: sc.actorRole, endpoint: sc.endpoint.path },
      });
    }
  }
  await logEvent(job.id, "jalankan_skenario", "selesai", `${deviasi} skenario menyimpang dari ${scenarios.length}`);
  await setProgress(job.id, "jalankan_skenario", 90);
  if (await isCancelled(job.id)) return "cancelled";

  await logEvent(job.id, "normalisasi", "mulai");
  await logEvent(job.id, "normalisasi", "selesai");
  await setProgress(job.id, "normalisasi", 100);
  return "done";
}

async function getCredentialValue(credentialRefId: string): Promise<string> {
  const entry = await prisma.credentialVaultEntry.findUnique({ where: { id: credentialRefId } });
  if (!entry) return "";
  return decryptSecret(entry.encryptedValue);
}

async function processJob(job: { id: string; requestId: string; scopeVersionId: string; jobType: string }) {
  await prisma.scanJob.update({ where: { id: job.id }, data: { status: "running", startedAt: new Date() } });

  const windowCheck = await validateApprovalAndWindow(job.requestId);
  if (!windowCheck.ok) {
    await prisma.scanJob.update({
      where: { id: job.id },
      data: { status: "failed", failureReason: windowCheck.reason, finishedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { action: "scan.rejected", entityType: "scan_job", entityId: job.id, metadata: { reason: windowCheck.reason } },
    });
    return;
  }

  try {
    let result: string;
    if (job.jobType === "web_scan" || job.jobType === "retest") {
      result = await runWebScan(job);
    } else if (job.jobType === "api_access_test") {
      result = await runApiAccessTest(job);
    } else {
      throw new Error(`jobType tidak dikenal: ${job.jobType}`);
    }

    if (result === "cancelled") {
      await prisma.scanJob.update({ where: { id: job.id }, data: { status: "cancelled", finishedAt: new Date() } });
      await prisma.auditLog.create({ data: { action: "scan.cancelled", entityType: "scan_job", entityId: job.id } });
    } else {
      await prisma.scanJob.update({ where: { id: job.id }, data: { status: "done", finishedAt: new Date() } });
      await prisma.auditLog.create({ data: { action: "scan.completed", entityType: "scan_job", entityId: job.id } });
    }
  } catch (e) {
    const message = (e as Error).message;
    await prisma.scanJob.update({
      where: { id: job.id },
      data: { status: "failed", failureReason: message, finishedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { action: "scan.failed", entityType: "scan_job", entityId: job.id, metadata: maskJson({ error: message }) },
    });
  }
}

async function pollOnce() {
  // Ambil satu job queued tertua yang belum dibatalkan. Worker tunggal (MVP) —
  // untuk multi-worker, ganti dengan `SELECT ... FOR UPDATE SKIP LOCKED` via $queryRaw.
  const job = await prisma.scanJob.findFirst({
    where: { status: "queued", cancelRequested: false },
    orderBy: { queuedAt: "asc" },
  });
  if (!job) return;
  console.log(`[worker] mengambil job ${job.id} (${job.jobType})`);
  await processJob(job);
}

async function main() {
  console.log("[worker] VAPT scan worker dimulai, polling tiap", POLL_INTERVAL_MS, "ms");
  while (true) {
    try {
      await pollOnce();
    } catch (e) {
      console.error("[worker] error saat polling:", e);
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

main();
