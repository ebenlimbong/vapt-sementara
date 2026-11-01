import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { JobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, requirePentester, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { checkScanPermission } from "@/lib/scan-permission";


// Scan Otomatis Web — antrean ditampilkan untuk jobType web_scan & retest.
// (api_access_test adalah domain modul Uji Akses API, bukan tanggung jawab modul ini.)
const VISIBLE_JOB_TYPES = ["web_scan", "retest"] as const;
const JOB_STATUSES: JobStatus[] = ["queued", "running", "done", "failed", "cancelled"];

const createSchema = z.object({
  requestId: z.string().min(1, "requestId wajib diisi."),
});

/**
 * GET /api/scan-web/jobs
 * Daftar antrean & riwayat ScanJob (web_scan + retest), dengan posisi antrean yang
 * dihitung dari seluruh ScanJob status=queued (antrean worker bersifat global lintas
 * jobType, bukan hanya web_scan/retest).
 * Tidak ada lagi visibilitas per-aplikasi: admin & pentester sama-sama melihat SEMUA
 * aplikasi (admin read-only untuk oversight, pentester yang menjalankan/menghentikan).
 * appId di sini murni filter opsional, bukan gerbang akses.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  try {
    await requireRole(user, ["admin", "pentester"], { action: "scan.jobs.list_denied", ip });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status") || "";
  const appId = searchParams.get("appId") || "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));

  const and: Prisma.ScanJobWhereInput[] = [{ jobType: { in: [...VISIBLE_JOB_TYPES] } }];
  if (appId) and.push({ request: { appId } });
  if (status && JOB_STATUSES.includes(status as JobStatus)) and.push({ status: status as JobStatus });
  if (search) {
    and.push({
      OR: [
        { request: { app: { name: { contains: search, mode: "insensitive" } } } },
        { request: { targetUrl: { contains: search, mode: "insensitive" } } },
        { request: { purpose: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  const where: Prisma.ScanJobWhereInput = { AND: and };

  const [total, rows, allQueued, apps] = await Promise.all([
    prisma.scanJob.count({ where }),
    prisma.scanJob.findMany({
      where,
      orderBy: { queuedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
        creator: { select: { id: true, name: true } },
      },
    }),
    // Antrean nyata di worker bersifat global (semua jobType, status=queued, queuedAt paling tua
    // diambil dulu) — posisi dihitung dari situ, bukan hanya dari subset web_scan/retest.
    prisma.scanJob.findMany({
      where: { status: "queued" },
      orderBy: { queuedAt: "asc" },
      select: { id: true },
    }),
    prisma.application.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const positionMap = new Map(allQueued.map((j, idx) => [j.id, idx + 1]));

  const items = rows.map((j) => ({
    id: j.id,
    jobType: j.jobType,
    status: j.status,
    currentStage: j.currentStage,
    progressPct: j.progressPct,
    cancelRequested: j.cancelRequested,
    failureReason: j.failureReason,
    queuedAt: j.queuedAt,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
    queuePosition: j.status === "queued" ? positionMap.get(j.id) ?? null : null,
    requestId: j.requestId,
    targetUrl: j.request.targetUrl,
    app: j.request.app,
    requester: j.request.requester,
    creator: j.creator,
  }));

  return NextResponse.json({ items, total, page, pageSize, apps });
}

/**
 * POST /api/scan-web/jobs
 * Membuat ScanJob baru (jobType=web_scan, status=queued). Tidak pernah mengeksekusi
 * scan langsung — worker terpisah yang memprosesnya secara async.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "requestId wajib diisi." }, { status: 400 });
  }
  const { requestId } = parsed.data;

  const testRequest = await prisma.testRequest.findUnique({
    where: { id: requestId },
    include: { app: true },
  });
  if (!testRequest) {
    return NextResponse.json({ error: "Permintaan tes tidak ditemukan." }, { status: 404 });
  }

  try {
    // Pemisahan tugas: HANYA role pentester (global) yang boleh menjalankan scan.
    // Admin bersifat read-only untuk oversight — ditolak & tercatat otomatis oleh requirePentester.
    await requirePentester(user, ip);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const permission = await checkScanPermission(requestId);
  if (!permission.allowed) {
    await writeAudit({
      actorId: user.id,
      action: "scan.rejected",
      entityType: "test_request",
      entityId: requestId,
      metadata: { reason: permission.reason, jobType: "web_scan" },
      ipAddress: ip,
    });
    return NextResponse.json({ error: permission.reason }, { status: 403 });
  }

  const job = await prisma.scanJob.create({
    data: {
      requestId,
      scopeVersionId: permission.scopeVersionId,
      jobType: "web_scan",
      status: "queued",
      createdBy: user.id,
    },
    include: {
      request: { select: { id: true, targetUrl: true, app: { select: { id: true, name: true } } } },
      creator: { select: { id: true, name: true } },
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "scan.requested",
    entityType: "scan_job",
    entityId: job.id,
    metadata: { requestId, appId: testRequest.appId, jobType: "web_scan" },
    ipAddress: ip,
  });

  return NextResponse.json(job, { status: 201 });
}
