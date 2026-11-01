import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser, hashPassword } from "@/lib/auth";
import { requirePlatformAdmin, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { randomToken } from "@/lib/crypto";


// GET /api/admin/users — daftar + cari user (Admin platform saja).
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
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status") || "";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      mfaEnabled: true,
      createdAt: true,
      _count: { select: { assignments: true } },
    },
  });

  return NextResponse.json({ items: rows });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi."),
  email: z.string().trim().email("Email tidak valid."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").optional(),
});

// POST /api/admin/users — Admin menambah user baru. Jika password tidak
// dikirim, sistem men-generate kata sandi sementara acak dan mengembalikannya
// SEKALI SAJA di response (tidak pernah disimpan dalam bentuk plain di mana pun
// setelah ini, dan tidak pernah dicatat ke audit log).
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
  const { name, email } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email sudah digunakan user lain." }, { status: 400 });
  }

  const generated = !parsed.data.password;
  const tempPassword = parsed.data.password ?? randomToken(9);
  const passwordHash = await hashPassword(tempPassword);

  const created = await prisma.user.create({
    data: { name, email, passwordHash, status: "active" },
  });

  await writeAudit({
    actorId: user.id,
    action: "user.created",
    entityType: "user",
    entityId: created.id,
    metadata: { name, email, passwordGenerated: generated },
    ipAddress: ip,
  });

  return NextResponse.json(
    {
      item: { id: created.id, name: created.name, email: created.email, status: created.status },
      temporaryPassword: generated ? tempPassword : undefined,
    },
    { status: 201 }
  );
}
