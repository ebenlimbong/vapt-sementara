import { prisma } from "@/lib/db";

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 30,
  high: 15,
  medium: 7,
  low: 3,
  info: 0,
};

export function scoreToLetter(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Rating A-F per aplikasi berdasar temuan TERBUKA (status != selesai).
 * Null bila aplikasi belum pernah punya temuan sama sekali (belum ada dasar rating).
 */
export async function computeAppRating(appId: string): Promise<string | null> {
  const findings = await prisma.finding.findMany({
    where: { appId },
    select: { severity: true, status: true },
  });
  if (findings.length === 0) return null;

  const open = findings.filter((f) => f.status !== "selesai");
  let score = 100;
  for (const f of open) {
    score -= SEVERITY_WEIGHT[f.severity] ?? 0;
  }
  score = Math.max(0, score);
  return scoreToLetter(score);
}

export async function recomputeAndPersistAppRating(appId: string): Promise<string | null> {
  const rating = await computeAppRating(appId);
  await prisma.application.update({ where: { id: appId }, data: { rating } });
  return rating;
}
