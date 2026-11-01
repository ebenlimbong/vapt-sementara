import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { writeAudit, getClientIp } from "@/lib/audit";
import { readStoredFile } from "@/lib/storage";
import { canViewApp } from "@/lib/finding-helpers";


export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { id } = await ctx.params;
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 });

  const allowed = await canViewApp(user, report.appId);
  if (!allowed) return NextResponse.json({ error: "Anda belum punya akses ke aplikasi ini." }, { status: 403 });

  const buffer = await readStoredFile("reports", report.filePath).catch(() => null);
  if (!buffer) return NextResponse.json({ error: "Berkas laporan tidak ditemukan di penyimpanan." }, { status: 404 });

  await writeAudit({
    actorId: user.id,
    action: "report.downloaded",
    entityType: "report",
    entityId: report.id,
    metadata: { reportType: report.reportType },
    ipAddress: ip,
  });

  // Buffer<ArrayBufferLike> vs lib.dom BodyInit kadang tidak match persis di beberapa versi
  // @types/node — runtime tetap valid (Buffer adalah Uint8Array/ArrayBufferView asli).
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="laporan-${report.reportType}-${report.sha256.slice(0, 12)}.pdf"`,
    },
  });
}
