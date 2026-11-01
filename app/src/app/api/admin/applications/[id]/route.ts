import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePlatformAdmin, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";


const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  baseUrl: z.string().trim().min(1).optional(),
  category: z.enum(["web", "api"]).optional(),
  environment: z.enum(["staging", "lab"]).optional(),
  ownerId: z.string().trim().nullable().optional(),
});

// PATCH /api/admin/applications/[id] — Admin mengubah data aplikasi.
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

  const existing = await prisma.application.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Aplikasi tidak ditemukan." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Input tidak valid.", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const updated = await prisma.application.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.baseUrl !== undefined ? { baseUrl: data.baseUrl } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.environment !== undefined ? { environment: data.environment } : {}),
      ...(data.ownerId !== undefined ? { ownerId: data.ownerId || null } : {}),
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "application.updated",
    entityType: "application",
    entityId: id,
    metadata: {
      before: { name: existing.name, baseUrl: existing.baseUrl, category: existing.category, environment: existing.environment, ownerId: existing.ownerId },
      changes: data,
    },
    ipAddress: ip,
  });

  return NextResponse.json({ item: updated });
}

// DELETE /api/admin/applications/[id] — Admin menghapus aplikasi (cascade ke
// data terkait sesuai skema). Aplikasi platform (PLATFORM_APP_ID, basis Admin
// global) tidak boleh dihapus supaya tidak ada yang kehilangan akses admin.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

  if (process.env.PLATFORM_APP_ID && id === process.env.PLATFORM_APP_ID) {
    return NextResponse.json({ error: "Aplikasi platform tidak dapat dihapus." }, { status: 400 });
  }

  const existing = await prisma.application.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Aplikasi tidak ditemukan." }, { status: 404 });

  await prisma.application.delete({ where: { id } });

  await writeAudit({
    actorId: user.id,
    action: "application.deleted",
    entityType: "application",
    entityId: id,
    metadata: { name: existing.name },
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true });
}
