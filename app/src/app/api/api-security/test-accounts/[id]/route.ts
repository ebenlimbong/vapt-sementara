import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { handleApiError } from "@/lib/api-security";


/** DELETE /api/api-security/test-accounts/[id] — hapus akun uji + entri vault-nya. */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req.headers);
  try {
    const user = await requireCurrentUser();
    const { id } = await ctx.params;

    const account = await prisma.testAccount.findUnique({
      where: { id },
      select: { id: true, appId: true, roleLabel: true, credentialRef: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Akun uji tidak ditemukan." }, { status: 404 });
    }

    await requirePentester(user, ip);

    await prisma.$transaction([
      prisma.testAccount.delete({ where: { id } }),
      prisma.credentialVaultEntry.delete({ where: { id: account.credentialRef } }),
    ]);

    await writeAudit({
      actorId: user.id,
      action: "testaccount.deleted",
      entityType: "test_account",
      entityId: id,
      metadata: { appId: account.appId, roleLabel: account.roleLabel },
      ipAddress: ip,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
