import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePlatformAdmin, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";


// GET /api/admin/users/[id] — detail user + seluruh penugasan (appId x role),
// dipakai halaman matrix peran per aplikasi.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
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

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, status: true, mfaEnabled: true, createdAt: true },
  });
  if (!target) return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });

  const assignments = await prisma.appAssignment.findMany({
    where: { userId: id },
    include: { app: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ item: target, assignments });
}

const updateSchema = z.object({
  status: z.enum(["active", "inactive"], { error: "Status wajib active atau inactive." }),
});

// PATCH /api/admin/users/[id] — Admin mengaktifkan/menonaktifkan user.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
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

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Input tidak valid.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({ where: { id }, data: { status: parsed.data.status } });

  await writeAudit({
    actorId: user.id,
    action: parsed.data.status === "active" ? "user.activated" : "user.deactivated",
    entityType: "user",
    entityId: id,
    metadata: { email: target.email, from: target.status, to: parsed.data.status },
    ipAddress: ip,
  });

  return NextResponse.json({ item: { id: updated.id, status: updated.status } });
}
