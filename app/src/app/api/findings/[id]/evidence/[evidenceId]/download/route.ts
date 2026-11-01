import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { readStoredFile } from "@/lib/storage";


export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; evidenceId: string }> }) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  try {
    await requireRole(user, ["admin", "pentester"], { action: "evidence.download_denied", ip });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const { id, evidenceId } = await ctx.params;
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    include: { finding: { select: { id: true, appId: true } } },
  });
  if (!evidence || evidence.findingId !== id) {
    return NextResponse.json({ error: "Bukti tidak ditemukan." }, { status: 404 });
  }

  const buffer = await readStoredFile("evidence", evidence.filePath).catch(() => null);
  if (!buffer) return NextResponse.json({ error: "Berkas bukti tidak ditemukan di penyimpanan." }, { status: 404 });

  await writeAudit({
    actorId: user.id,
    action: "evidence.downloaded",
    entityType: "evidence",
    entityId: evidence.id,
    metadata: { findingId: id, versionNo: evidence.versionNo },
    ipAddress: ip,
  });

  // Buffer<ArrayBufferLike> vs lib.dom BodyInit kadang tidak match persis di beberapa versi
  // @types/node — runtime tetap valid (Buffer adalah Uint8Array/ArrayBufferView asli).
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": evidence.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="evidence-v${evidence.versionNo}-${evidence.sha256.slice(0, 12)}"`,
    },
  });
}
