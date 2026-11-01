import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { getClientIp } from "@/lib/audit";


// Urutan tahap baku per jobType (sesuai kontrak worker/index.ts — JANGAN diubah di sini,
// hanya dipakai untuk menyusun tampilan "belum berjalan" bagi tahap yang belum punya event).
const STAGE_ORDER_BY_TYPE: Record<string, string[]> = {
  web_scan: ["validasi_scope", "spider_terbatas", "header_cookie", "info_disclosure", "fingerprint_tech", "kerentanan_nuclei", "normalisasi"],
  retest: ["validasi_scope", "spider_terbatas", "header_cookie", "info_disclosure", "fingerprint_tech", "kerentanan_nuclei", "normalisasi"],
  api_access_test: ["validasi_scope", "jalankan_skenario", "normalisasi"],
};

function mapEventStatus(rawStatus: string, jobStatus: string): string {
  if (rawStatus === "mulai") return jobStatus === "cancelled" ? "dihentikan" : "berjalan";
  if (rawStatus === "selesai") return "selesai";
  if (rawStatus === "gagal") return "gagal";
  return rawStatus;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = getClientIp(req.headers);

  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  try {
    await requireRole(user, ["admin", "pentester"], { action: "scan.jobs.detail_denied", ip });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const job = await prisma.scanJob.findUnique({
    where: { id },
    include: {
      request: {
        select: {
          id: true,
          purpose: true,
          targetUrl: true,
          app: { select: { id: true, name: true } },
          requester: { select: { id: true, name: true } },
        },
      },
      scopeVersion: { select: { id: true, versionNo: true, content: true } },
      creator: { select: { id: true, name: true } },
      events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      candidates: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!job) return NextResponse.json({ error: "Job scan tidak ditemukan." }, { status: 404 });

  // Tidak ada lagi visibilitas per-aplikasi: admin & pentester sama-sama boleh lihat detail job apa pun.

  // Susun 1 baris per tahap dengan status TERAKHIRnya; tahap tanpa event sama sekali = belum berjalan.
  const canonical = STAGE_ORDER_BY_TYPE[job.jobType] ?? STAGE_ORDER_BY_TYPE.web_scan;
  const seen = new Set<string>();
  const orderedStageNames: string[] = [];
  for (const s of canonical) {
    orderedStageNames.push(s);
    seen.add(s);
  }
  for (const e of job.events) {
    if (!seen.has(e.stage)) {
      seen.add(e.stage);
      orderedStageNames.push(e.stage);
    }
  }

  const latestByStage = new Map<string, { status: string; message: string | null; createdAt: Date }>();
  for (const e of job.events) {
    // events sudah terurut ASC by createdAt/id, jadi penulisan terakhir = state terbaru.
    latestByStage.set(e.stage, { status: e.status, message: e.message, createdAt: e.createdAt });
  }

  const stages = orderedStageNames.map((name) => {
    const latest = latestByStage.get(name);
    return {
      stage: name,
      status: latest ? mapEventStatus(latest.status, job.status) : "belum_berjalan",
      message: latest?.message ?? null,
      updatedAt: latest?.createdAt ?? null,
    };
  });

  let queuePosition: number | null = null;
  if (job.status === "queued") {
    const earlier = await prisma.scanJob.count({
      where: { status: "queued", queuedAt: { lt: job.queuedAt } },
    });
    queuePosition = earlier + 1;
  }

  const scopeContent = (job.scopeVersion.content ?? {}) as { allowedHosts?: string[] };
  const failedEventCount = job.events.filter((e) => e.status === "gagal").length;

  return NextResponse.json({
    id: job.id,
    jobType: job.jobType,
    status: job.status,
    currentStage: job.currentStage,
    progressPct: job.progressPct,
    cancelRequested: job.cancelRequested,
    failureReason: job.failureReason,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    queuePosition,
    canCancel: job.status === "queued" || job.status === "running",
    requestId: job.requestId,
    app: job.request.app,
    requester: job.request.requester,
    creator: job.creator,
    scope: {
      scopeVersionId: job.scopeVersion.id,
      versionNo: job.scopeVersion.versionNo,
      targetUrl: job.request.targetUrl,
      allowedHosts: scopeContent.allowedHosts ?? [],
      failedEventCount,
    },
    stages,
    candidates: job.candidates.map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      status: c.status,
      createdAt: c.createdAt,
    })),
  });
}
