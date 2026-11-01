import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePlatformAdmin, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { maskLabelValue } from "@/lib/mask";


const updateSchema = z.object({
  label: z.string().trim().min(1).optional(),
  value: z.string().min(1).optional(),
});

// PATCH /api/admin/vault/[id] — ganti label dan/atau nilai kredensial. Nilai
// baru dienkripsi ulang; nilai lama tertimpa (vault menyimpan SATU nilai aktif
// per entry — ini bukan evidence/bukti temuan yang wajib berversi, jadi
// penimpaan di sini sesuai feature 08: "menambah ... dan mengganti kredensial").
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

  const existing = await prisma.credentialVaultEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Kredensial tidak ditemukan." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Input tidak valid.", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { label, value } = parsed.data;
  if (!label && !value) {
    return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
  }

  const updated = await prisma.credentialVaultEntry.update({
    where: { id },
    data: {
      ...(label !== undefined ? { label } : {}),
      ...(value !== undefined ? { encryptedValue: encryptSecret(value) } : {}),
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "vault.updated",
    entityType: "credential_vault",
    entityId: id,
    metadata: { labelChanged: label !== undefined, valueChanged: value !== undefined, label: updated.label },
    ipAddress: ip,
  });

  return NextResponse.json({ item: { id: updated.id, label: updated.label, maskedValue: maskLabelValue() } });
}
