import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { checkScanPermission } from "@/lib/scan-permission";


/**
 * GET /api/scan-web/requests
 * Helper internal modul Scan Otomatis Web (BUKAN endpoint modul /requests): daftar
 * TestRequest yang boleh dijadikan target scan, beserta hasil checkScanPermission per
 * request supaya tombol "Jalankan Scan" di UI bisa di-disable+tooltip alasan TANPA perlu
 * klik dulu.
 *
 * Role global: hanya pentester yang menjalankan scan (tidak ada lagi penugasan per-aplikasi
 * seperti appAssignment role=tester) — pentester melihat SEMUA aplikasi. Admin bersifat
 * read-only untuk oversight dan tidak menjalankan scan, jadi daftar kandidatnya kosong.
 *
 * Catatan desain: endpoint resmi GET /api/requests/[id]/scan-permission (dibangun modul
 * lain) belum tersedia saat modul ini dikerjakan, jadi di sini kita panggil
 * checkScanPermission langsung — gerbang izin yang sama persis dipakai di seluruh app.
 */
export async function GET() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  if (user.role !== "pentester") {
    return NextResponse.json({ items: [] });
  }

  const requests = await prisma.testRequest.findMany({
    where: { status: { in: ["disetujui", "berjalan"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      app: { select: { id: true, name: true } },
      requester: { select: { id: true, name: true } },
    },
  });

  const items = await Promise.all(
    requests.map(async (r) => {
      const permission = await checkScanPermission(r.id);
      return {
        id: r.id,
        purpose: r.purpose,
        targetUrl: r.targetUrl,
        status: r.status,
        desiredStart: r.desiredStart,
        desiredEnd: r.desiredEnd,
        app: r.app,
        requester: r.requester,
        permission: permission.allowed
          ? { allowed: true, windowStart: permission.windowStart, windowEnd: permission.windowEnd }
          : { allowed: false, reason: permission.reason },
      };
    })
  );

  return NextResponse.json({ items });
}
