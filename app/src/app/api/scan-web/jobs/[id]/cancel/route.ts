import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";


/**
 * PATCH /api/scan-web/jobs/[id]/cancel
 * Hanya MENANDAI cancelRequested=true. Worker (worker/index.ts) yang mengecek flag ini
 * di antar-tahap dan benar-benar mengubah status job menjadi 'cancelled'. Endpoint ini
 * TIDAK mengubah status job secara langsung.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = getClientIp(req.headers);

  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const job = await prisma.scanJob.findUnique({
    where: { id },
  });
  if (!job) return NextResponse.json({ error: "Job scan tidak ditemukan." }, { status: 404 });

  try {
    // Pemisahan tugas: HANYA role pentester (global) yang boleh menghentikan scan.
    // Admin bersifat read-only untuk oversight — tidak menjalankan/menghentikan scan.
    await requirePentester(user, ip);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  if (job.status !== "queued" && job.status !== "running") {
    return NextResponse.json({ error: "Job sudah tidak berjalan." }, { status: 400 });
  }

  const updated = await prisma.scanJob.update({
    where: { id: job.id },
    data: { cancelRequested: true },
  });

  await writeAudit({
    actorId: user.id,
    action: "scan.cancel_requested",
    entityType: "scan_job",
    entityId: job.id,
    metadata: { previousStatus: job.status },
    ipAddress: ip,
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    cancelRequested: updated.cancelRequested,
  });
}
