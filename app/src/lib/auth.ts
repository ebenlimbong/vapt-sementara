import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { generateSecret as otpGenerateSecret, generateURI as otpGenerateURI, verify as otpVerify } from "otplib";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "vapt_session";
const PENDING_MFA_COOKIE = "vapt_pending_mfa";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 jam
const PENDING_MFA_TTL_SECONDS = 60 * 5; // 5 menit untuk masukkan kode MFA

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET belum diset atau terlalu pendek. Set di .env");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string; // user id
  email: string;
  name: string;
};

// ---------- Password ----------
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------- MFA (TOTP) ----------
// otplib v13: API fungsional (bukan lagi object `authenticator` dari v12).
export function generateMfaSecret(): string {
  return otpGenerateSecret();
}

export function buildMfaUri(email: string, secret: string): string {
  return otpGenerateURI({ issuer: "VAPT ITERA", label: email, secret });
}

export async function verifyMfaToken(secret: string, token: string): Promise<boolean> {
  try {
    const result = await otpVerify({ secret, token: token.trim() });
    return result.valid;
  } catch {
    return false;
  }
}

// ---------- Pending-MFA short-lived token (antara step password & step OTP) ----------
export async function issuePendingMfaToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, kind: "pending_mfa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_MFA_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyPendingMfaToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind !== "pending_mfa" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export async function setPendingMfaCookie(token: string) {
  const store = await cookies();
  store.set(PENDING_MFA_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_MFA_TTL_SECONDS,
  });
}

export async function getPendingMfaCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(PENDING_MFA_COOKIE)?.value ?? null;
}

export async function clearPendingMfaCookie() {
  const store = await cookies();
  store.delete(PENDING_MFA_COOKIE);
}

// ---------- Full session ----------
export async function issueSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, kind: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind !== "session" || typeof payload.sub !== "string") return null;
    return { sub: payload.sub, email: payload.email as string, name: payload.name as string };
  } catch {
    return null;
  }
}

/** Ambil user aktif (status=active) dari session saat ini, atau null. */
export async function getCurrentUser() {
  const session = await getSessionFromCookies();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user || user.status !== "active") return null;
  return user;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("UNAUTHENTICATED");
    err.name = "UNAUTHENTICATED";
    throw err;
  }
  return user;
}
