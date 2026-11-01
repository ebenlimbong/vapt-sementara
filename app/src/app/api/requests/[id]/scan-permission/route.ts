import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { checkScanPermission } from "@/lib/scan-permission";


// GET /api/requests/[id]/scan-permission — dipakai modul scan-web & api-security
// untuk menampilkan status tombol scan (aktif/nonaktif + alasan). Read-only:
// semua user yang login (admin & pentester) boleh melihat status ini — tidak
// ada lagi filter peran per-aplikasi. Mengembalikan hasil checkScanPermission()
// mentah sebagai JSON, tanpa diubah.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const request = await prisma.testRequest.findUnique({ where: { id }, select: { appId: true } });
  if (!request) return NextResponse.json({ error: "Permintaan tidak ditemukan." }, { status: 404 });

  const result = await checkScanPermission(id);
  return NextResponse.json(result);
}
