import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  issuePendingMfaToken,
  setPendingMfaCookie,
  issueSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import { writeAudit, getClientIp } from "@/lib/audit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email dan kata sandi wajib diisi." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "active") {
    await writeAudit({
      actorId: null,
      action: "auth.login_failed",
      entityType: "user",
      entityId: null,
      metadata: { email, reason: !user ? "not_found" : "inactive" },
      ipAddress: ip,
    });
    return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await writeAudit({
      actorId: user.id,
      action: "auth.login_failed",
      entityType: "user",
      entityId: user.id,
      metadata: { email, reason: "wrong_password" },
      ipAddress: ip,
    });
    return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });
  }

  if (user.mfaEnabled) {
    const pendingToken = await issuePendingMfaToken(user.id);
    await setPendingMfaCookie(pendingToken);
    await writeAudit({
      actorId: user.id,
      action: "auth.login_password_ok_mfa_required",
      entityType: "user",
      entityId: user.id,
      metadata: {},
      ipAddress: ip,
    });
    return NextResponse.json({ mfaRequired: true });
  }

  const token = await issueSessionToken({ sub: user.id, email: user.email, name: user.name });
  await setSessionCookie(token);
  await writeAudit({
    actorId: user.id,
    action: "auth.login_success",
    entityType: "user",
    entityId: user.id,
    metadata: {},
    ipAddress: ip,
  });
  return NextResponse.json({ mfaRequired: false });
}
