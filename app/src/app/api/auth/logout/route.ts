import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function POST() {
  const user = await getCurrentUser();
  await clearSessionCookie();
  if (user) {
    await writeAudit({ actorId: user.id, action: "auth.logout", entityType: "user", entityId: user.id, metadata: {} });
  }
  return NextResponse.json({ ok: true });
}
