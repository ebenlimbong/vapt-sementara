import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";


// GET /api/requests/[id] — detail permintaan + riwayat scope version (berurutan,
// dengan diff ringkas) + jendela waktu tes aktif/terbaru. Read-only: semua user
// yang login (admin & pentester) bisa melihat detail permintaan apa pun — tidak
// ada lagi filter visibilitas per-aplikasi. currentUserRole dikirim supaya UI
// tahu aksi apa yang boleh ditampilkan (menyusun/finalkan scope = pentester,
// approve/reject = admin).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const request = await prisma.testRequest.findUnique({
    where: { id },
    include: {
      app: { select: { id: true, name: true, category: true, baseUrl: true, environment: true } },
      requester: { select: { id: true, name: true, email: true } },
    },
  });
  if (!request) return NextResponse.json({ error: "Permintaan tidak ditemukan." }, { status: 404 });

  const [scopeVersions, testWindows] = await Promise.all([
    prisma.scopeVersion.findMany({
      where: { requestId: id },
      orderBy: { versionNo: "asc" },
      include: {
        creator: { select: { id: true, name: true } },
        approvals: {
          include: { approver: { select: { id: true, name: true } } },
          orderBy: { decidedAt: "desc" },
        },
      },
    }),
    prisma.testWindow.findMany({
      where: { requestId: id },
      orderBy: { startAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    currentUserId: user.id,
    currentUserRole: user.role,
    item: {
      id: request.id,
      purpose: request.purpose,
      targetUrl: request.targetUrl,
      status: request.status,
      desiredStart: request.desiredStart,
      desiredEnd: request.desiredEnd,
      createdAt: request.createdAt,
      app: request.app,
      requester: request.requester,
    },
    scopeVersions,
    testWindows,
  });
}
