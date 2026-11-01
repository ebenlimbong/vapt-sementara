import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePlatformAdmin, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";


const bodySchema = z.object({
  appId: z.string().trim().min(1, "Aplikasi wajib dipilih."),
  role: z.enum(["admin", "coordinator", "tester", "app_owner"], { error: "Peran tidak valid." }),
});

// POST /api/admin/users/[id]/assignments — Admin menugaskan satu peran pada
// satu aplikasi untuk user ini (deny-by-default: tanpa baris ini, user tidak
// punya akses apa pun ke aplikasi tersebut).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let admin;
  try {
    admin = await requireCurrentUser();
  } catch {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  const ip = getClientIp(req.headers);
  try {
    await requirePlatformAdmin(admin, ip);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Input tidak valid.", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { appId, role } = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app) return NextResponse.json({ error: "Aplikasi tidak ditemukan." }, { status: 404 });

  const created = await prisma.appAssignment.upsert({
    where: { appId_userId_role: { appId, userId: id, role } },
    update: {},
    create: { appId, userId: id, role, assignedBy: admin.id },
  });

  await writeAudit({
    actorId: admin.id,
    action: "assignment.created",
    entityType: "app_assignment",
    entityId: created.id,
    metadata: { userId: id, userEmail: target.email, appId, appName: app.name, role },
    ipAddress: ip,
  });

  return NextResponse.json({ item: created }, { status: 201 });
}

// DELETE /api/admin/users/[id]/assignments — Admin mencabut satu peran pada
// satu aplikasi dari user ini. Body: { appId, role }.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let admin;
  try {
    admin = await requireCurrentUser();
  } catch {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  const ip = getClientIp(req.headers);
  try {
    await requirePlatformAdmin(admin, ip);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Input tidak valid.", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { appId, role } = parsed.data;

  const existing = await prisma.appAssignment.findUnique({
    where: { appId_userId_role: { appId, userId: id, role } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Penugasan tidak ditemukan." }, { status: 404 });
  }

  await prisma.appAssignment.delete({ where: { id: existing.id } });

  await writeAudit({
    actorId: admin.id,
    action: "assignment.revoked",
    entityType: "app_assignment",
    entityId: existing.id,
    metadata: { userId: id, appId, role },
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true });
}
