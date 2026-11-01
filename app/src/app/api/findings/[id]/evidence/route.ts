import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requireRole, requirePentester, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { saveImmutableFile } from "@/lib/storage";


export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  try {
    await requireRole(user, ["admin", "pentester"], { action: "evidence.list_denied", ip });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const { id } = await ctx.params;
  const finding = await prisma.finding.findUnique({ where: { id }, select: { id: true, appId: true } });
  if (!finding) return NextResponse.json({ error: "Temuan tidak ditemukan." }, { status: 404 });

  const items = await prisma.evidence.findMany({
    where: { findingId: finding.id },
    orderBy: { versionNo: "desc" },
    include: { uploader: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Berkas bukti wajib diunggah." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || "";

  const last = await prisma.evidence.findFirst({
    where: { findingId: finding.id },
    orderBy: { versionNo: "desc" },
    select: { versionNo: true },
  });
  const versionNo = (last?.versionNo ?? 0) + 1;

  const { relativePath, sha256 } = await saveImmutableFile("evidence", finding.id, buffer, ext);

  const evidence = await prisma.evidence.create({
    data: {
      findingId: finding.id,
      versionNo,
      filePath: relativePath,
      sha256,
      mimeType: file.type || "application/octet-stream",
      uploadedBy: user.id,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "evidence.uploaded",
    entityType: "finding",
    entityId: finding.id,
    metadata: { evidenceId: evidence.id, versionNo, sha256 },
    ipAddress: ip,
  });

  return NextResponse.json({ evidence }, { status: 201 });
}
