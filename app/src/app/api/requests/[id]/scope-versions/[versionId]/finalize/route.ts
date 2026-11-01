import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";


// POST /api/requests/[id]/scope-versions/[versionId]/finalize — Pentester menandai
// satu versi ruang lingkup sebagai final untuk dikirim ke persetujuan Admin.
// Hanya versi TERBARU (versionNo tertinggi) pada request ini yang boleh difinalkan,
// dan versi final lain pada request yang sama (bila ada, mis. sisa dari siklus
// sebelumnya) otomatis dilepas supaya antrean persetujuan tidak ambigu.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await ctx.params;
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  const ip = getClientIp(req.headers);
  const testRequest = await prisma.testRequest.findUnique({ where: { id } });
  if (!testRequest) return NextResponse.json({ error: "Permintaan tidak ditemukan." }, { status: 404 });

  try {
    await requirePentester(user, ip);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const version = await prisma.scopeVersion.findUnique({ where: { id: versionId } });
  if (!version || version.requestId !== id) {
    return NextResponse.json({ error: "Versi ruang lingkup tidak ditemukan." }, { status: 404 });
  }

  const latest = await prisma.scopeVersion.findFirst({
    where: { requestId: id },
    orderBy: { versionNo: "desc" },
  });
  if (latest && latest.id !== version.id) {
    return NextResponse.json(
      { error: "Hanya versi ruang lingkup terbaru yang dapat ditandai final." },
      { status: 400 }
    );
  }

  const alreadyDecided = await prisma.scopeApproval.findFirst({ where: { scopeVersionId: version.id } });
  if (alreadyDecided) {
    return NextResponse.json({ error: "Versi ini sudah diputuskan dan tidak dapat difinalkan ulang." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.scopeVersion.updateMany({
      where: { requestId: id, isFinal: true, id: { not: version.id } },
      data: { isFinal: false },
    }),
    prisma.scopeVersion.update({ where: { id: version.id }, data: { isFinal: true } }),
  ]);

  await writeAudit({
    actorId: user.id,
    action: "scope_version.finalized",
    entityType: "scope_version",
    entityId: version.id,
    metadata: { requestId: id, versionNo: version.versionNo },
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true });
}
