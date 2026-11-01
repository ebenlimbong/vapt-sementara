import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { requirePentester, requireRole, ForbiddenError } from "@/lib/rbac";
import { writeAudit, getClientIp } from "@/lib/audit";
import { saveImmutableFile } from "@/lib/storage";
import { sha256Hex } from "@/lib/crypto";
import { buildTechnicalReportPdf, buildExecutiveReportPdf } from "@/lib/report-pdf";


export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  // List/download laporan: read-only oversight, boleh admin ATAU pentester.
  try {
    await requireRole(user, ["admin", "pentester"], { action: "report.list_denied", ip });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId") || "";

  // Tidak ada lagi visibilitas per-aplikasi: admin & pentester melihat SEMUA laporan.
  const where: Record<string, unknown> = {};
  if (appId) where.appId = appId;

  const items = await prisma.report.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      app: { select: { id: true, name: true } },
      generator: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ items });
}

const createSchema = z.object({
  requestId: z.string().min(1, "Permintaan uji wajib dipilih."),
  reportType: z.enum(["technical", "executive"]),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Permintaan uji dan jenis laporan wajib dipilih." }, { status: 400 });
  }
  const { requestId, reportType } = parsed.data;

  const testRequest = await prisma.testRequest.findUnique({
    where: { id: requestId },
    include: { app: true },
  });
  if (!testRequest) return NextResponse.json({ error: "Permintaan uji tidak ditemukan." }, { status: 404 });

  const appId = testRequest.appId;

  try {
    await requireAppRole(user, appId, ["tester"], { action: "report.generate_denied", ip });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const findings = await prisma.finding.findMany({
    where: { appId },
    orderBy: { createdAt: "asc" },
    include: { evidence: { orderBy: { versionNo: "desc" }, take: 1 } },
  });

  const generatedAt = new Date();
  let buffer: Buffer;

  if (reportType === "technical") {
    buffer = await buildTechnicalReportPdf({
      appName: testRequest.app.name,
      generatedAt,
      findings: findings.map((f) => ({
        title: f.title,
        severity: f.severity,
        status: f.status,
        cvssScore: f.cvssScore,
        cvssVector: f.cvssVector,
        description: f.description,
        steps: f.steps,
        impact: f.impact,
        latestEvidence: f.evidence[0]
          ? { versionNo: f.evidence[0].versionNo, sha256: f.evidence[0].sha256, createdAt: f.evidence[0].createdAt }
          : null,
      })),
    });
  } else {
    const severityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) severityCounts[f.severity] = (severityCounts[f.severity] ?? 0) + 1;
    const openCount = findings.filter((f) => f.status !== "selesai").length;
    const doneCount = findings.filter((f) => f.status === "selesai").length;
    const topFindings = findings
      .filter((f) => f.severity === "critical" || f.severity === "high")
      .sort((a, b) => (b.cvssScore ?? 0) - (a.cvssScore ?? 0))
      .slice(0, 5)
      .map((f) => ({ title: f.title, severity: f.severity, impact: f.impact }));

    buffer = await buildExecutiveReportPdf({
      appName: testRequest.app.name,
      rating: testRequest.app.rating,
      periodStart: testRequest.desiredStart,
      periodEnd: testRequest.desiredEnd,
      printedAt: generatedAt,
      severityCounts,
      openCount,
      doneCount,
      topFindings,
    });
  }

  const sha256 = sha256Hex(buffer);
  const { relativePath } = await saveImmutableFile("reports", appId, buffer, ".pdf");

  const report = await prisma.report.create({
    data: {
      requestId: testRequest.id,
      appId,
      reportType,
      filePath: relativePath,
      sha256,
      generatedBy: user.id,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "report.generated",
    entityType: "report",
    entityId: report.id,
    metadata: { appId, reportType, sha256 },
    ipAddress: ip,
  });

  return NextResponse.json({ report, tokenFreeChecked: true }, { status: 201 });
}
