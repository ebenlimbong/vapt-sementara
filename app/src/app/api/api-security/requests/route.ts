import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/audit";
import { handleApiError, VIEW_ROLES } from "@/lib/api-security";


/**
 * Daftar TestRequest milik sebuah aplikasi — dipakai untuk memilih permintaan mana yang
 * jadi dasar "Jalankan Pengujian" (gerbang izin dicek di /api/api-security/run, bukan di sini).
 * Modul Izin Tes (test_requests) dibangun subagent lain; di sini hanya baca untuk kebutuhan selector.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get("appId");
    if (!appId) {
      return NextResponse.json({ error: "appId wajib diisi." }, { status: 400 });
    }
    await requireRole(user, VIEW_ROLES, {
      action: "apisecurity.requests_list_denied",
      ip: getClientIp(req.headers),
    });

    const items = await prisma.testRequest.findMany({
      where: { appId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        purpose: true,
        targetUrl: true,
        status: true,
        desiredStart: true,
        desiredEnd: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ items });
  } catch (err) {
    return handleApiError(err);
  }
}
