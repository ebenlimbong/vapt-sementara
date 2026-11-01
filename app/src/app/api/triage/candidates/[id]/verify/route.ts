import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { recomputeAndPersistAppRating } from "@/lib/rating";
import { defaultDueDate } from "@/lib/finding-helpers";


const schema = z.object({
  title: z.string().min(1, "Judul wajib diisi."),
  description: z.string().min(1, "Deskripsi wajib diisi."),
  steps: z.string().min(1, "Langkah reproduksi wajib diisi."),
  impact: z.string().min(1, "Dampak wajib diisi."),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { id } = await ctx.params;
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: { job: { select: { request: { select: { appId: true } } } }, finding: { select: { id: true } } },
  });
  if (!candidate) return NextResponse.json({ error: "Kandidat tidak ditemukan." }, { status: 404 });
  if (candidate.status !== "baru") {
    return NextResponse.json({ error: "Kandidat ini sudah diproses sebelumnya (bukan status baru)." }, { status: 400 });
  }
  if (candidate.finding) {
    return NextResponse.json({ error: "Kandidat ini sudah memiliki temuan." }, { status: 400 });
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
    return NextResponse.json(
      { error: "Data temuan belum lengkap.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { title, description, steps, impact, severity } = parsed.data;

  const finding = await prisma.$transaction(async (tx) => {
    const created = await tx.finding.create({
      data: {
        appId,
        candidateId: candidate.id,
        title,
        description,
        steps,
        impact,
        severity,
        status: "baru",
        createdBy: user.id,
        dueDate: defaultDueDate(severity),
      },
    });
    await tx.candidate.update({ where: { id: candidate.id }, data: { status: "terverifikasi_jadi_temuan" } });
    return created;
  });

  await writeAudit({
    actorId: user.id,
    action: "candidate.verified",
    entityType: "candidate",
    entityId: candidate.id,
    metadata: { findingId: finding.id, appId, severity },
    ipAddress: ip,
  });

  await recomputeAndPersistAppRating(appId);

  return NextResponse.json({ finding });
}
