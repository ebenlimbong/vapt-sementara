import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { diff } from "jsondiffpatch";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";


const scopeContentSchema = z.object({
  targetUrl: z.string().trim().min(1, "Target URL wajib diisi."),
  allowedHosts: z.array(z.string().trim().min(1)).min(1, "Minimal satu host yang diizinkan."),
  pagesOrEndpoints: z.array(z.string().trim().min(1)).default([]),
  testAccounts: z.string().trim().default(""),
  constraints: z.string().trim().default(""),
});

// POST /api/requests/[id]/scope-versions — Pentester menyusun versi ruang lingkup
// baru (versionNo = max+1 untuk request ini). diffSummary dihitung via
// jsondiffpatch terhadap content versi sebelumnya; null bila versi pertama.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  const ip = getClientIp(req.headers);
  const testRequest = await prisma.testRequest.findUnique({ where: { id } });
  if (!testRequest) return NextResponse.json({ error: "Permintaan tidak ditemukan." }, { status: 404 });

  try {
    // Hanya Pentester yang boleh menyusun ruang lingkup (Admin tidak bisa).
    await requirePentester(user, ip);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = scopeContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Input tidak valid.", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const content = parsed.data;

  const previous = await prisma.scopeVersion.findFirst({
    where: { requestId: id },
    orderBy: { versionNo: "desc" },
  });

  const nextVersionNo = (previous?.versionNo ?? 0) + 1;
  // diff() balik `undefined` kalau tidak ada perbedaan (atau tidak ada versi
  // sebelumnya) — di-skip dari payload create supaya kolom tetap NULL di DB.
  const diffSummaryRaw = previous ? diff(previous.content, content) : undefined;

  const created = await prisma.scopeVersion.create({
    data: {
      requestId: id,
      versionNo: nextVersionNo,
      content: content as Prisma.InputJsonValue,
      ...(diffSummaryRaw !== undefined ? { diffSummary: diffSummaryRaw as Prisma.InputJsonValue } : {}),
      isFinal: false,
      createdBy: user.id,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "scope_version.created",
    entityType: "scope_version",
    entityId: created.id,
    metadata: { requestId: id, versionNo: nextVersionNo, content },
    ipAddress: ip,
  });

  return NextResponse.json({ item: created }, { status: 201 });
}
