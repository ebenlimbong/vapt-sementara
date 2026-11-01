import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { getClientIp } from "@/lib/audit";


export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  try {
    await requireRole(user, ["admin", "pentester"], { action: "finding.view_denied", ip });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const { id } = await ctx.params;
  const finding = await prisma.finding.findUnique({
    where: { id },
    include: {
      app: { select: { id: true, name: true, category: true } },
      creator: { select: { id: true, name: true } },
      evidence: { orderBy: { versionNo: "desc" }, include: { uploader: { select: { id: true, name: true } } } },
      remediationEvents: { orderBy: { createdAt: "asc" }, include: { actor: { select: { id: true, name: true } } } },
      retests: { orderBy: { createdAt: "desc" }, include: { verifier: { select: { id: true, name: true } } } },
      candidate: { select: { id: true, title: true, category: true, normalizedKey: true } },
    },
  });
  if (!finding) return NextResponse.json({ error: "Temuan tidak ditemukan." }, { status: 404 });

  // RemediationEvent.id bertipe BigInt (bigserial) -> harus di-string-kan sebelum JSON.stringify.
  const remediationEvents = finding.remediationEvents.map((e) => ({ ...e, id: String(e.id) }));

  return NextResponse.json({
    finding: { ...finding, remediationEvents },
    source: finding.candidateId ? "scan" : "manual",
    // Peran sekarang global (bukan per-aplikasi) -> langsung pakai role user saat ini.
    userRoles: [user.role],
  });
}
