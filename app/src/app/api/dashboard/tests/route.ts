import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status") || "";
  const appId = searchParams.get("appId") || "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));

  // Role global (admin/pentester) — keduanya lihat semua aplikasi, tidak ada lagi
  // pembatasan per-aplikasi (app_assignments sudah dihapus).
  const where: Record<string, unknown> = {};
  if (appId) where.appId = appId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { purpose: { contains: search, mode: "insensitive" } },
      { targetUrl: { contains: search, mode: "insensitive" } },
      { app: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.testRequest.count({ where }),
    prisma.testRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        app: { select: { id: true, name: true, category: true, rating: true } },
        requester: { select: { id: true, name: true } },
        scanJobs: {
          orderBy: { queuedAt: "desc" },
          take: 1,
          select: { id: true, status: true, currentStage: true, progressPct: true, jobType: true },
        },
      },
    }),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    purpose: r.purpose,
    targetUrl: r.targetUrl,
    status: r.status,
    createdAt: r.createdAt,
    app: r.app,
    requester: r.requester,
    latestJob: r.scanJobs[0] ?? null,
  }));

  return NextResponse.json({ items, total, page, pageSize });
}
