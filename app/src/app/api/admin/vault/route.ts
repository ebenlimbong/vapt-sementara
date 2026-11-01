import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePlatformAdmin, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { maskLabelValue } from "@/lib/mask";


// GET /api/admin/vault — daftar kredensial per aplikasi. Nilai asli TIDAK
// PERNAH dikembalikan — hanya label aplikasi dan placeholder tersamar.
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

  const rows = await prisma.credentialVaultEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      app: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      testAccount: { select: { id: true, roleLabel: true } },
    },
  });

  const items = rows.map((r) => ({
    id: r.id,
    label: r.label,
    maskedValue: maskLabelValue(),
    app: r.app,
    creator: r.creator,
    testAccount: r.testAccount,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ items });
}

const createSchema = z.object({
  appId: z.string().trim().min(1, "Aplikasi wajib dipilih."),
  label: z.string().trim().min(1, "Label kredensial wajib diisi."),
  value: z.string().min(1, "Nilai kredensial wajib diisi."),
});

// POST /api/admin/vault — tambah kredensial baru untuk satu aplikasi. Nilai
// dienkripsi (AES-256-GCM via src/lib/crypto.ts) sebelum disimpan; nilai
// plaintext TIDAK PERNAH masuk ke audit log (hanya label yang dicatat).
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
  const { appId, label, value } = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app) return NextResponse.json({ error: "Aplikasi tidak ditemukan." }, { status: 404 });

  const created = await prisma.credentialVaultEntry.create({
    data: { appId, label, encryptedValue: encryptSecret(value), createdBy: user.id },
  });

  await writeAudit({
    actorId: user.id,
    action: "vault.created",
    entityType: "credential_vault",
    entityId: created.id,
    metadata: { appId, appName: app.name, label },
    ipAddress: ip,
  });

  return NextResponse.json(
    { item: { id: created.id, label: created.label, maskedValue: maskLabelValue(), appId } },
    { status: 201 }
  );
}
