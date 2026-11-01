import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  // Role global (admin/pentester) — keduanya lihat semua aplikasi.
  const severityGroups = await prisma.finding.groupBy({
    by: ["severity"],
    where: { status: { not: "selesai" } },
    _count: { _all: true },
  });
  const severityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const g of severityGroups) severityCounts[g.severity] = g._count._all;

  const apps = await prisma.application.findMany({
    select: { id: true, name: true, rating: true, category: true },
    orderBy: { name: "asc" },
  });

  const runningJobs = await prisma.scanJob.findMany({
    where: { status: { in: ["queued", "running"] } },
    orderBy: { queuedAt: "asc" },
    take: 20,
    select: {
      id: true,
      status: true,
      currentStage: true,
      progressPct: true,
      jobType: true,
      queuedAt: true,
      request: { select: { app: { select: { name: true } } } },
    },
  });

  return NextResponse.json({
    severityCounts,
    apps,
    runningJobs: runningJobs.map((j) => ({
      id: j.id,
      status: j.status,
      currentStage: j.currentStage,
      progressPct: j.progressPct,
      jobType: j.jobType,
      appName: j.request.app.name,
    })),
  });
}
