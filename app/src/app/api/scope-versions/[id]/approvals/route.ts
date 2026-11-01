import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireAdmin, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";


const decisionSchema = z
  .object({
    decision: z.enum(["approved", "rejected"], { error: "Keputusan wajib 'approved' atau 'rejected'." }),
    reason: z.string().trim().optional(),
  })
  .refine((v) => v.decision !== "rejected" || (v.reason && v.reason.length > 0), {
    message: "Alasan wajib diisi saat menolak ruang lingkup.",
    path: ["reason"],
  });

/**
 * POST /api/scope-versions/[id]/approvals — Admin menyetujui/menolak satu
 * versi ruang lingkup final.
 *
 * Pemisahan tugas (model peran global): endpoint ini hanya menerima role admin
 * (requireAdmin), sedangkan yang menyusun & memfinalkan scope adalah pentester
 * (lihat scope-versions/route.ts & finalize/route.ts yang memakai
 * requirePentester). Karena satu user cuma punya SATU role global, admin dan
 * pentester TIDAK PERNAH orang yang sama — jadi "self-approve" otomatis
 * mustahil terjadi secara struktural, tanpa perlu cek approverId vs createdBy.
 *
 * Keputusan "approved" otomatis membuat TestWindow baru. Sumber startAt/endAt:
 * KAMI PAKAI TestRequest.desiredStart/desiredEnd (bukan field di dalam content
 * JSON scope version), karena dua kolom itu sudah terstruktur sebagai DateTime
 * di skema sejak permintaan diajukan, sehingga jendela waktu selalu konsisten
 * dengan apa yang diminta Pentester di awal — content JSON scope version bebas
 * bentuknya dan tidak dijamin punya field tanggal. Jendela aktif sebelumnya pada
 * request yang sama otomatis dinonaktifkan supaya hanya ada satu jendela aktif.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: versionId } = await ctx.params;
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  const ip = getClientIp(req.headers);
  const version = await prisma.scopeVersion.findUnique({
    where: { id: versionId },
    include: { request: true },
  });
  if (!version) return NextResponse.json({ error: "Versi ruang lingkup tidak ditemukan." }, { status: 404 });

  try {
    await requireAppRole(user, version.request.appId, ["coordinator"], {
      action: "scope_approval.decide.denied",
      ip,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  if (user.id === version.createdBy) {
    await writeAudit({
      actorId: user.id,
      action: "scope_approval.self_approve_blocked",
      entityType: "scope_version",
      entityId: version.id,
      metadata: { requestId: version.requestId },
      ipAddress: ip,
    });
    return NextResponse.json(
      { error: "Anda tidak dapat menyetujui ruang lingkup yang Anda buat sendiri (pemisahan tugas)." },
      { status: 403 }
    );
  }

  if (!version.isFinal) {
    return NextResponse.json({ error: "Versi ini belum ditandai final oleh Tester." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Input tidak valid.", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { decision, reason } = parsed.data;

  const existing = await prisma.scopeApproval.findFirst({ where: { scopeVersionId: version.id } });
  if (existing) {
    return NextResponse.json({ error: "Ruang lingkup ini sudah diputuskan sebelumnya." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const approval = await tx.scopeApproval.create({
      data: {
        scopeVersionId: version.id,
        approverId: user.id,
        decision,
        reason: reason || null,
      },
    });

    if (decision === "approved") {
      await tx.testWindow.updateMany({
        where: { requestId: version.requestId, isActive: true },
        data: { isActive: false },
      });
      await tx.testWindow.create({
        data: {
          requestId: version.requestId,
          approvedScopeId: approval.id,
          scopeVersionId: version.id,
          startAt: version.request.desiredStart,
          endAt: version.request.desiredEnd,
          isActive: true,
        },
      });
      await tx.testRequest.update({ where: { id: version.requestId }, data: { status: "disetujui" } });
    } else {
      await tx.testRequest.update({ where: { id: version.requestId }, data: { status: "ditolak" } });
    }

    return approval;
  });

  await writeAudit({
    actorId: user.id,
    action: decision === "approved" ? "scope_approval.approved" : "scope_approval.rejected",
    entityType: "scope_version",
    entityId: version.id,
    metadata: { requestId: version.requestId, decision, reason },
    ipAddress: ip,
  });

  return NextResponse.json({ item: result }, { status: 201 });
}
