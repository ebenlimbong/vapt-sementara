import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { getClientIp } from "@/lib/audit";
import { maskJson } from "@/lib/mask";


export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  try {
    await requireRole(user, ["admin", "pentester"], { action: "triage.candidates.list_denied", ip });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId") || "";
  const category = searchParams.get("category") || "";
  const status = searchParams.get("status") || "baru";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));

  // Tidak ada lagi visibilitas per-aplikasi: admin & pentester melihat SEMUA aplikasi.
  // appId di sini murni filter opsional, bukan gerbang akses.
  const jobWhere: Record<string, unknown> = {
    request: appId ? { appId } : {},
  };

  const where: Record<string, unknown> = { job: jobWhere };
  if (status) where.status = status;
  if (category) where.category = category;

  const [total, rows] = await Promise.all([
    prisma.candidate.count({ where }),
    prisma.candidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        job: {
          select: {
            id: true,
            jobType: true,
            request: { select: { id: true, appId: true, app: { select: { id: true, name: true, category: true } } } },
          },
        },
      },
    }),
  ]);

  const items = rows.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    status: c.status,
    normalizedKey: c.normalizedKey,
    createdAt: c.createdAt,
    job: { id: c.job.id, jobType: c.job.jobType },
    app: c.job.request.app,
    rawPayloadPreview: maskJson(c.rawPayload),
  }));

  return NextResponse.json({ items, total, page, pageSize });
}
