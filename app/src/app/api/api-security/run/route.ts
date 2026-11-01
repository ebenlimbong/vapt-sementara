import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireAppRole } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { checkScanPermission } from "@/lib/scan-permission";
import { handleApiError, TESTER_ONLY } from "@/lib/api-security";


const runSchema = z.object({
  requestId: z.string().uuid(),
  specId: z.string().uuid(),
});

/**
 * GET /api/api-security/run?requestId=... — cek gerbang izin TANPA membuat job apapun.
 * Dipakai UI untuk disable+tooltip tombol "Jalankan Pengujian" sebelum diklik.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");
    if (!requestId) {
      return NextResponse.json({ error: "requestId wajib diisi." }, { status: 400 });
    }

    const testRequest = await prisma.testRequest.findUnique({
      where: { id: requestId },
      select: { appId: true },
    });
    if (!testRequest) {
      return NextResponse.json({ error: "Permintaan tidak ditemukan." }, { status: 404 });
    }
    await requireAppRole(user, testRequest.appId, TESTER_ONLY, {
      action: "scan.permission_check_denied",
      ip: getClientIp(req.headers),
    });

    const permission = await checkScanPermission(requestId);
    return NextResponse.json(permission);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/api-security/run — jalankan uji akses API: cek gerbang izin, lalu beri
 * jobId ke semua AccessScenario yang belum pernah dijalankan pada spec ini.
 * Worker (worker/index.ts, tidak disentuh) yang mengeksekusi job secara async.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const user = await requireCurrentUser();
    const body = await req.json().catch(() => null);
    const parsed = runSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "requestId dan specId wajib diisi." },
        { status: 400 }
      );
    }
    const { requestId, specId } = parsed.data;

    const testRequest = await prisma.testRequest.findUnique({ where: { id: requestId } });
    if (!testRequest) {
      return NextResponse.json({ error: "Permintaan tidak ditemukan." }, { status: 404 });
    }

    await requireAppRole(user, testRequest.appId, TESTER_ONLY, {
      action: "scan.request_denied",
      ip,
    });

    const spec = await prisma.apiSpec.findUnique({
      where: { id: specId },
      select: { id: true, appId: true },
    });
    if (!spec) {
      return NextResponse.json({ error: "Spesifikasi tidak ditemukan." }, { status: 404 });
    }
    if (spec.appId !== testRequest.appId) {
      return NextResponse.json(
        { error: "Spesifikasi tidak berasal dari aplikasi permintaan ini." },
        { status: 400 }
      );
    }

    const permission = await checkScanPermission(requestId);
    if (!permission.allowed) {
      await writeAudit({
        actorId: user.id,
        action: "scan.rejected",
        entityType: "test_request",
        entityId: requestId,
        metadata: { reason: permission.reason, jobType: "api_access_test", specId },
        ipAddress: ip,
      });
      return NextResponse.json({ error: permission.reason }, { status: 403 });
    }

    const pendingScenarios = await prisma.accessScenario.findMany({
      where: { jobId: null, endpoint: { specId } },
      select: { id: true },
    });
    if (pendingScenarios.length === 0) {
      return NextResponse.json(
        { error: "Belum ada skenario untuk dijalankan." },
        { status: 400 }
      );
    }

    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.scanJob.create({
        data: {
          requestId,
          scopeVersionId: permission.scopeVersionId,
          jobType: "api_access_test",
          status: "queued",
          createdBy: user.id,
        },
      });
      await tx.accessScenario.updateMany({
        where: { id: { in: pendingScenarios.map((s) => s.id) } },
        data: { jobId: created.id },
      });
      return created;
    });

    await writeAudit({
      actorId: user.id,
      action: "scan.requested",
      entityType: "scan_job",
      entityId: job.id,
      metadata: {
        jobType: "api_access_test",
        scenarioCount: pendingScenarios.length,
        requestId,
        specId,
      },
      ipAddress: ip,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
