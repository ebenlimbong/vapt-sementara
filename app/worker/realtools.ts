import { spawn } from "node:child_process";
import type { RawCheckFinding } from "./checks";

/**
 * Integrasi tool keamanan nyata yang terinstall di host worker:
 *  - httpx (ProjectDiscovery): fingerprint tech stack + versi (Wappalyzer dataset).
 *  - nuclei (ProjectDiscovery): kerentanan tervalidasi dari ribuan template komunitas
 *    (CVE spesifik, exposure/misconfig, deteksi teknologi), bukan heuristik regex buatan sendiri.
 *
 * Keduanya OPSIONAL: kalau binary tidak ada di PATH worker (mis. image Docker belum
 * dipasangi), stage ini dilewati dengan jelas (tidak membuat job gagal) — lihat
 * `isToolAvailable`. Target yang disentuh SELALU persis `targetUrl` yang sudah lolos
 * `checkScopeGuard` di pemanggil; tool ini tidak diberi kemampuan crawl ke host lain.
 */

const toolAvailabilityCache = new Map<string, boolean>();

export async function isToolAvailable(bin: string): Promise<boolean> {
  if (toolAvailabilityCache.has(bin)) return toolAvailabilityCache.get(bin)!;
  const ok = await new Promise<boolean>((resolve) => {
    const p = spawn("sh", ["-c", `command -v ${bin}`]);
    p.on("exit", (code) => resolve(code === 0));
    p.on("error", () => resolve(false));
  });
  toolAvailabilityCache.set(bin, ok);
  return ok;
}

type RunResult = { stdout: string; timedOut: boolean };

/** Jalankan child process, kumpulkan stdout, bisa dibatalkan via AbortSignal (tombol Stop) atau timeout keras. */
function runProcess(cmd: string, args: string[], timeoutMs: number, shouldAbort: () => Promise<boolean>): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "ignore"] });
    let stdout = "";
    let timedOut = false;
    const hardTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    const cancelCheck = setInterval(async () => {
      if (await shouldAbort()) {
        timedOut = true;
        child.kill("SIGTERM");
      }
    }, 3000);

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.on("close", () => {
      clearTimeout(hardTimer);
      clearInterval(cancelCheck);
      resolve({ stdout, timedOut });
    });
    child.on("error", () => {
      clearTimeout(hardTimer);
      clearInterval(cancelCheck);
      resolve({ stdout, timedOut: true });
    });
  });
}

function parseJsonLines<T>(text: string): T[] {
  const out: T[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // baris bukan JSON valid (mis. log info tool) — dilewati
    }
  }
  return out;
}

type HttpxLine = {
  host?: string;
  webserver?: string;
  tech?: string[];
  title?: string;
};

/**
 * Fingerprint teknologi + versi via httpx (-tech-detect, dataset Wappalyzer).
 * Hasil berupa kandidat kategori "tech_fingerprint" — satu per teknologi terdeteksi,
 * supaya tim bisa langsung menelusuri CVE untuk versi spesifik itu (lihat kb/cve-cwe-ref).
 */
export async function runHttpxTechDetect(
  targetUrl: string,
  shouldAbort: () => Promise<boolean>
): Promise<{ findings: RawCheckFinding[]; ran: boolean }> {
  if (!(await isToolAvailable("httpx"))) return { findings: [], ran: false };

  const host = new URL(targetUrl).hostname;
  const { stdout } = await runProcess(
    "httpx",
    ["-u", targetUrl, "-silent", "-tech-detect", "-title", "-json", "-timeout", "15"],
    25_000,
    shouldAbort
  );
  const lines = parseJsonLines<HttpxLine>(stdout);
  const findings: RawCheckFinding[] = [];
  for (const line of lines) {
    if (line.webserver) {
      findings.push({
        title: `Teknologi terdeteksi (web server): ${line.webserver}`,
        category: "tech_fingerprint",
        normalizedKey: `tech:${host}:webserver:${line.webserver}`,
        rawPayload: { url: targetUrl, tool: "httpx", webserver: line.webserver, title: line.title },
      });
    }
    for (const t of line.tech ?? []) {
      findings.push({
        title: `Teknologi terdeteksi: ${t}`,
        category: "tech_fingerprint",
        normalizedKey: `tech:${host}:tech:${t}`,
        rawPayload: { url: targetUrl, tool: "httpx", tech: t, title: line.title },
      });
    }
  }
  return { findings, ran: true };
}

type NucleiLine = {
  "template-id": string;
  info: {
    name: string;
    severity: string;
    description?: string;
    reference?: string[];
    classification?: { "cve-id"?: string[] | null; "cwe-id"?: string[] | null };
    tags?: string[];
  };
  host?: string;
  "matched-at"?: string;
};

const NUCLEI_SAFE_ETAGS = "intrusive,dos,fuzz,fuzzing,bruteforce,brute-force";

/**
 * Jalankan nuclei dengan tag TERBATAS pada deteksi pasif/aman (deteksi tech, CVE
 * berbasis fingerprint versi, exposure/misconfig) — explicit exclude tag intrusif/DoS/
 * fuzzing/bruteforce sesuai kebijakan "Di luar cakupan" PRD §2.
 */
export async function runNucleiScan(
  targetUrl: string,
  opts: { tags: string; severity: string; timeoutMs: number },
  shouldAbort: () => Promise<boolean>
): Promise<{ findings: RawCheckFinding[]; ran: boolean }> {
  if (!(await isToolAvailable("nuclei"))) return { findings: [], ran: false };

  const host = new URL(targetUrl).hostname;
  const { stdout } = await runProcess(
    "nuclei",
    [
      "-u", targetUrl,
      "-silent", "-jsonl",
      "-tags", opts.tags,
      "-etags", NUCLEI_SAFE_ETAGS,
      "-severity", opts.severity,
      "-timeout", "5",
      "-rate-limit", "80",
      "-c", "40",
      "-no-color",
    ],
    opts.timeoutMs,
    shouldAbort
  );
  const lines = parseJsonLines<NucleiLine>(stdout);
  const findings: RawCheckFinding[] = [];
  for (const line of lines) {
    const tags = line.info.tags ?? [];
    const category = tags.includes("cve")
      ? "cve"
      : tags.includes("exposure")
        ? "exposure"
        : tags.includes("misconfig")
          ? "misconfig"
          : "tech_fingerprint";
    const cveId = line.info.classification?.["cve-id"]?.[0];
    findings.push({
      title: cveId ? `${line.info.name} (${cveId})` : line.info.name,
      category,
      normalizedKey: `nuclei:${host}:${line["template-id"]}`,
      rawPayload: {
        url: targetUrl,
        tool: "nuclei",
        templateId: line["template-id"],
        severity: line.info.severity,
        description: line.info.description,
        reference: line.info.reference,
        cveId,
        cweId: line.info.classification?.["cwe-id"]?.[0],
        matchedAt: line["matched-at"],
      },
    });
  }
  return { findings, ran: true };
}

/** Pemetaan severity label nuclei -> enum Severity platform (sudah sama persis). */
export function nucleiSeverityToPlatform(sev: string): "critical" | "high" | "medium" | "low" | "info" {
  const s = sev.toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low") return s;
  return "info";
}
