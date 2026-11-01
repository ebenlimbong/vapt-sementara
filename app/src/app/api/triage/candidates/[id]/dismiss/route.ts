import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";


const schema = z.object({
  reason: z.string().min(1, "Alasan wajib diisi."),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { id } = await ctx.params;
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: { job: { select: { request: { select: { appId: true } } } } },
  });
  if (!candidate) return NextResponse.json({ error: "Kandidat tidak ditemukan." }, { status: 404 });
  if (candidate.status !== "baru") {
    return NextResponse.json({ error: "Kandidat ini sudah diproses sebelumnya (bukan status baru)." }, { status: 400 });
  }

  const appId = candidate.job.request.appId;

  try {
    await requirePentester(user, ip);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Alasan wajib diisi." }, { status: 400 });
  }

  const updated = await prisma.candidate.update({
    where: { id: candidate.id },
    data: { status: "alarm_palsu", dismissReason: parsed.data.reason },
  });

  await writeAudit({
    actorId: user.id,
    action: "candidate.dismissed",
    entityType: "candidate",
    entityId: candidate.id,
    metadata: { appId, reason: parsed.data.reason },
    ipAddress: ip,
  });

  return NextResponse.json({ candidate: updated });
}
