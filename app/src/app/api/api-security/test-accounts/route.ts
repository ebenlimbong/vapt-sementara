import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, requirePentester } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { maskLabelValue } from "@/lib/mask";
import { handleApiError, VIEW_ROLES } from "@/lib/api-security";


const createSchema = z.object({
  appId: z.string().uuid(),
  roleLabel: z.string().trim().min(1).max(100),
  secretValue: z.string().min(1),
});

/** GET /api/api-security/test-accounts?appId=... — list, NILAI SELALU TERSAMAR. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const { searchParams } = new URL(req.url);
    const appId = searchParams.get("appId");
    if (!appId) {
      return NextResponse.json({ error: "appId wajib diisi." }, { status: 400 });
    }
    await requireRole(user, VIEW_ROLES, {
      action: "testaccount.list_denied",
      ip: getClientIp(req.headers),
    });

    // Select eksplisit TANPA menyentuh encrypted_value — kredensial asli tidak pernah lewat sini.
    const accounts = await prisma.testAccount.findMany({
      where: { appId },
      orderBy: { createdAt: "desc" },
      select: { id: true, roleLabel: true, createdAt: true },
    });

    return NextResponse.json({
      items: accounts.map((a) => ({
        id: a.id,
        roleLabel: a.roleLabel,
        createdAt: a.createdAt,
        maskedValue: maskLabelValue(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** POST /api/api-security/test-accounts — buat akun uji; secretValue dienkripsi di vault. */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  try {
    const user = await requireCurrentUser();
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "appId, roleLabel, dan secretValue wajib diisi." },
        { status: 400 }
      );
    }
    const { appId, roleLabel, secretValue } = parsed.data;

    const app = await prisma.application.findUnique({ where: { id: appId } });
    if (!app) {
      return NextResponse.json({ error: "Aplikasi tidak ditemukan." }, { status: 404 });
    }

    await requirePentester(user, ip);

    const encryptedValue = encryptSecret(secretValue);

    const account = await prisma.$transaction(async (tx) => {
      const entry = await tx.credentialVaultEntry.create({
        data: { appId, label: roleLabel, encryptedValue, createdBy: user.id },
      });
      return tx.testAccount.create({
        data: { appId, roleLabel, credentialRef: entry.id },
      });
    });

    // Metadata sengaja TIDAK menyertakan secretValue mentah.
    await writeAudit({
      actorId: user.id,
      action: "testaccount.created",
      entityType: "test_account",
      entityId: account.id,
      metadata: { appId, roleLabel },
      ipAddress: ip,
    });

    return NextResponse.json(
      {
        id: account.id,
        roleLabel: account.roleLabel,
        createdAt: account.createdAt,
        maskedValue: maskLabelValue(),
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
