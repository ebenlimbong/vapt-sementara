import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePlatformAdmin, ForbiddenError } from "@/lib/rbac";
import { getClientIp } from "@/lib/audit";


// GET /api/audit-log — tabel audit log READ-ONLY (tidak ada PATCH/DELETE di
// mana pun untuk tabel ini — append only). Dibatasi untuk Admin platform karena
// bisa memuat aktivitas lintas semua aplikasi.
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  const ip = getClientIp(req.headers);
  try {
    await requirePlatformAdmin(user, ip);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action")?.trim() || "";
  const entityType = searchParams.get("entityType")?.trim() || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "25")));

  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (entityType) where.entityType = entityType;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const items = rows.map((r) => ({
    id: r.id.toString(),
    actor: r.actor,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    metadata: r.metadata,
    ipAddress: r.ipAddress,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ items, total, page, pageSize });
}
