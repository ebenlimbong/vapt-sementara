import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePlatformAdmin, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";


// GET /api/admin/applications — daftar semua aplikasi (hanya Admin platform).
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

  const items = await prisma.application.findMany({
    orderBy: { name: "asc" },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ items });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Nama aplikasi wajib diisi."),
  baseUrl: z.string().trim().min(1, "Base URL wajib diisi."),
  category: z.enum(["web", "api"], { error: "Kategori wajib web atau api." }),
  environment: z.enum(["staging", "lab"], { error: "Environment wajib staging atau lab." }),
  ownerId: z.string().trim().optional().nullable(),
});

// POST /api/admin/applications — Admin menambah aplikasi baru.
export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Input tidak valid.", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { name, baseUrl, category, environment, ownerId } = parsed.data;

  const created = await prisma.application.create({
    data: { name, baseUrl, category, environment, ownerId: ownerId || null },
  });

  await writeAudit({
    actorId: user.id,
    action: "application.created",
    entityType: "application",
    entityId: created.id,
    metadata: { name, baseUrl, category, environment, ownerId },
    ipAddress: ip,
  });

  return NextResponse.json({ item: created }, { status: 201 });
}
