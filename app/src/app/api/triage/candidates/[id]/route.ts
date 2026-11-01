import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, ForbiddenError } from "@/lib/rbac";
import { getClientIp } from "@/lib/audit";
import { maskJson } from "@/lib/mask";


export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  try {
    await requireRole(user, ["admin", "pentester"], { action: "triage.candidate.view_denied", ip });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const { id } = await ctx.params;
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      job: {
        select: {
          id: true,
          jobType: true,
          request: { select: { id: true, appId: true, app: { select: { id: true, name: true, category: true } } } },
        },
      },
      endpoint: { select: { id: true, method: true, path: true } },
      finding: { select: { id: true } },
    },
  });
  if (!candidate) return NextResponse.json({ error: "Kandidat tidak ditemukan." }, { status: 404 });

  return NextResponse.json({
    id: candidate.id,
    title: candidate.title,
    category: candidate.category,
    normalizedKey: candidate.normalizedKey,
    status: candidate.status,
    dismissReason: candidate.dismissReason,
    createdAt: candidate.createdAt,
    rawPayload: maskJson(candidate.rawPayload),
    endpoint: candidate.endpoint,
    findingId: candidate.finding?.id ?? null,
    job: { id: candidate.job.id, jobType: candidate.job.jobType },
    app: candidate.job.request.app,
  });
}
