import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getPendingMfaCookie,
  verifyPendingMfaToken,
  verifyMfaToken,
  issueSessionToken,
  setSessionCookie,
  clearPendingMfaCookie,
} from "@/lib/auth";
import { writeAudit, getClientIp } from "@/lib/audit";

const schema = z.object({ code: z.string().min(6).max(8) });

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const pending = await getPendingMfaCookie();
  if (!pending) {
    return NextResponse.json({ error: "Sesi verifikasi kedaluwarsa, silakan masuk ulang." }, { status: 401 });
  }
  const userId = await verifyPendingMfaToken(pending);
  if (!userId) {
    return NextResponse.json({ error: "Sesi verifikasi kedaluwarsa, silakan masuk ulang." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Kode verifikasi tidak valid." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaSecret || user.status !== "active") {
    return NextResponse.json({ error: "Akun tidak valid." }, { status: 401 });
  }

  const ok = await verifyMfaToken(user.mfaSecret, parsed.data.code);
  if (!ok) {
    await writeAudit({
      actorId: user.id,
      action: "auth.mfa_failed",
      entityType: "user",
      entityId: user.id,
      metadata: {},
      ipAddress: ip,
    });
    return NextResponse.json({ error: "Kode verifikasi salah atau sudah kedaluwarsa." }, { status: 401 });
  }

  await clearPendingMfaCookie();
  const token = await issueSessionToken({ sub: user.id, email: user.email, name: user.name });
  await setSessionCookie(token);
  await writeAudit({
    actorId: user.id,
    action: "auth.login_success",
    entityType: "user",
    entityId: user.id,
    metadata: { via: "mfa" },
    ipAddress: ip,
  });
  return NextResponse.json({ ok: true });
}
