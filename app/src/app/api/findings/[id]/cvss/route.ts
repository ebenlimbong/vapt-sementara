import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { recomputeAndPersistAppRating } from "@/lib/rating";
import { validateMetrics, computeScore, scoreToSeverity, buildVectorString } from "@/lib/cvss4";


export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { id } = await ctx.params;
  const finding = await prisma.finding.findUnique({ where: { id }, select: { id: true, appId: true } });
  if (!finding) return NextResponse.json({ error: "Temuan tidak ditemukan." }, { status: 404 });

  try {
    await requirePentester(user, ip);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Komponen CVSS belum lengkap.", missing: ["AV", "AC", "AT", "PR", "UI", "VC", "VI", "VA", "SC", "SI", "SA"] }, { status: 400 });
  }

  const validated = validateMetrics(body as Record<string, string>);
  if (!validated.ok) {
    return NextResponse.json({ error: "Komponen CVSS belum lengkap", missing: validated.missing }, { status: 400 });
  }

  const score = computeScore(validated.metrics);
  const severity = scoreToSeverity(score);
  const vector = buildVectorString(validated.metrics);

  const updated = await prisma.finding.update({
    where: { id: finding.id },
    data: { cvssScore: score, cvssVector: vector, severity },
  });

  await writeAudit({
    actorId: user.id,
    action: "finding.cvss_scored",
    entityType: "finding",
    entityId: finding.id,
    metadata: { score, severity, vector },
    ipAddress: ip,
  });

  await recomputeAndPersistAppRating(finding.appId);

  return NextResponse.json({ finding: updated, score, severity, vector });
}
