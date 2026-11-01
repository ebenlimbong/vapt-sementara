import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { recomputeAndPersistAppRating } from "@/lib/rating";
import { findActiveApprovedRequest } from "@/lib/finding-helpers";
// worker/checks.ts di luar src/ -> path relatif, bukan alias @/
import { checkResponseHeaders, checkResponseBody } from "../../../../../../worker/checks";


const AUTO_RECHECK_CATEGORIES = ["header", "cookie", "info_disclosure"];

const manualSchema = z.object({
  result: z.enum(["tertutup", "masih_terbuka"]),
  note: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { id } = await ctx.params;
  const finding = await prisma.finding.findUnique({
    where: { id },
    include: { candidate: true },
  });
  if (!finding) return NextResponse.json({ error: "Temuan tidak ditemukan." }, { status: 404 });

  // Hanya role pentester yang diizinkan menjalankan retest.
  try {
    await requirePentester(user, ip);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  if (finding.status !== "menunggu_retest") {
    return NextResponse.json({ error: "Temuan harus berstatus 'menunggu_retest' sebelum bisa diuji ulang." }, { status: 400 });
  }

  // Retest tunduk aturan izin yang sama dengan scan: harus ada approval + jendela waktu aktif.
  const active = await findActiveApprovedRequest(finding.appId);
  if (!active) {
    return NextResponse.json({ error: "Retest tidak bisa dijalankan: tidak ada izin aktif." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  let result: "tertutup" | "masih_terbuka" | null = null;
  let note: string | null = body?.note ?? null;
  let autoRechecked = false;

  const candidate = finding.candidate;
  if (candidate && AUTO_RECHECK_CATEGORIES.includes(candidate.category)) {
    try {
      const resp = await fetch(active.request.targetUrl, { redirect: "follow" });
      const bodyText = await resp.text();
      const rechecked = [
        ...checkResponseHeaders(active.request.targetUrl, resp.headers),
        ...checkResponseBody(active.request.targetUrl, bodyText),
      ];
      const stillPresent = rechecked.some((r) => r.normalizedKey === candidate.normalizedKey);
      result = stillPresent ? "masih_terbuka" : "tertutup";
      autoRechecked = true;
      note = note ?? (stillPresent
        ? "Retest otomatis: indikator yang sama masih terdeteksi pada target."
        : "Retest otomatis: indikator yang sama tidak lagi terdeteksi pada target.");
    } catch {
      autoRechecked = false;
    }
  }

  if (!autoRechecked) {
    const parsed = manualSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: candidate
            ? "Retest otomatis gagal/tidak tersedia untuk kandidat ini. Isi hasil manual: {result:'tertutup'|'masih_terbuka', note}."
            : "Temuan manual tidak bisa direcheck otomatis. Isi hasil manual: {result:'tertutup'|'masih_terbuka', note}.",
        },
        { status: 400 }
      );
    }
    result = parsed.data.result;
    note = parsed.data.note ?? null;
  }

  const fromStatus = finding.status;
  const toStatus = result === "tertutup" ? "selesai" : "dikerjakan";

  const [updatedFinding, retest] = await prisma.$transaction([
    prisma.finding.update({ where: { id: finding.id }, data: { status: toStatus } }),
    prisma.retest.create({
      data: {
        findingId: finding.id,
        result: result!,
        note,
        verifiedBy: user.id,
      },
    }),
    prisma.remediationEvent.create({
      data: {
        findingId: finding.id,
        fromStatus,
        toStatus,
        note: `Retest: ${result}`,
        actorId: user.id,
      },
    }),
  ]);

  await writeAudit({
    actorId: user.id,
    action: "finding.retested",
    entityType: "finding",
    entityId: finding.id,
    metadata: { result, autoRechecked, fromStatus, toStatus },
    ipAddress: ip,
  });

  await recomputeAndPersistAppRating(finding.appId);

  return NextResponse.json({ finding: updatedFinding, retest, autoRechecked });
}
