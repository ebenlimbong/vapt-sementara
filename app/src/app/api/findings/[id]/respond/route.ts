import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";


// Catatan remediasi: dulu diisi App Owner (peran itu sudah dihapus). Sekarang pentester
// sendiri yang memegang seluruh bagian remediasi, termasuk catatan rencana perbaikan ini
// sebagai catatan kerja internal. Kolom DB tetap `ownerResponse` (schema tidak diubah),
// tapi secara konsep ini "Catatan Remediasi (Pentester)".
// Whitelist ketat: HANYA boleh memindahkan ke dua status ini lewat endpoint ini.
const schema = z.object({
  ownerResponse: z.string().min(1, "Catatan remediasi wajib diisi."),
  nextStatus: z.enum(["dikerjakan", "menunggu_retest"]),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { id } = await ctx.params;
  const finding = await prisma.finding.findUnique({ where: { id } });
  if (!finding) return NextResponse.json({ error: "Temuan tidak ditemukan." }, { status: 404 });

  try {
    await requirePentester(user, ip);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  if (finding.status === "selesai") {
    return NextResponse.json({ error: "Temuan sudah selesai, tidak bisa diberi catatan remediasi lagi." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Catatan remediasi wajib diisi dan status tujuan harus 'dikerjakan' atau 'menunggu_retest'.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { ownerResponse, nextStatus } = parsed.data;
  const fromStatus = finding.status;

  const [updated] = await prisma.$transaction([
    prisma.finding.update({ where: { id: finding.id }, data: { ownerResponse, status: nextStatus } }),
    prisma.remediationEvent.create({
      data: {
        findingId: finding.id,
        fromStatus,
        toStatus: nextStatus,
        note: "Catatan remediasi pentester",
        actorId: user.id,
      },
    }),
  ]);

  await writeAudit({
    actorId: user.id,
    action: "finding.status_changed",
    entityType: "finding",
    entityId: finding.id,
    metadata: { fromStatus, toStatus: nextStatus, viaRemediationNote: true },
    ipAddress: ip,
  });

  return NextResponse.json({ finding: updated });
}
