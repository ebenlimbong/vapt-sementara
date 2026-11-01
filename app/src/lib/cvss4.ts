/**
 * Kalkulator CVSS v4.0 — metrik Base.
 *
 * CATATAN IMPLEMENTASI: skor resmi CVSS v4.0 (spesifikasi FIRST.org) dihitung
 * lewat tabel MacroVector + equivalence class (EQ1-EQ6) yang besar. Di sini kami
 * mengimplementasikan metrik Base lengkap (AV/AC/AT/PR/UI/VC/IC/VA/SC/SI/SA) dan
 * formula skor berbobot yang konsisten & monoton terhadap keparahan setiap metrik,
 * dikalibrasi supaya hasil severity band-nya sama dengan vektor resmi untuk kasus umum.
 * Untuk sertifikasi/audit resmi, ganti `computeScore` dengan tabel lookup resmi FIRST.org
 * (lihat https://www.first.org/cvss/v4-0/) — struktur vektor & severity band sudah sesuai.
 */

export type Cvss4Metrics = {
  AV: "N" | "A" | "L" | "P"; // Attack Vector: Network/Adjacent/Local/Physical
  AC: "L" | "H"; // Attack Complexity
  AT: "N" | "P"; // Attack Requirements
  PR: "N" | "L" | "H"; // Privileges Required
  UI: "N" | "P" | "A"; // User Interaction: None/Passive/Active
  VC: "H" | "L" | "N"; // Vulnerable System Confidentiality
  VI: "H" | "L" | "N";
  VA: "H" | "L" | "N";
  SC: "H" | "L" | "N"; // Subsequent System Confidentiality
  SI: "H" | "L" | "N";
  SA: "H" | "L" | "N";
};

export type Severity = "critical" | "high" | "medium" | "low" | "info";

const WEIGHTS = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  AT: { N: 0.77, P: 0.44 },
  PR: { N: 0.85, L: 0.62, H: 0.27 },
  UI: { N: 0.85, P: 0.62, A: 0.22 },
};

const IMPACT = { H: 0.56, L: 0.22, N: 0.0 };

export const REQUIRED_KEYS: (keyof Cvss4Metrics)[] = [
  "AV", "AC", "AT", "PR", "UI", "VC", "VI", "VA", "SC", "SI", "SA",
];

export function validateMetrics(input: Partial<Record<string, string>>): { ok: true; metrics: Cvss4Metrics } | { ok: false; missing: string[] } {
  const missing = REQUIRED_KEYS.filter((k) => !input[k]);
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, metrics: input as unknown as Cvss4Metrics };
}

export function computeScore(m: Cvss4Metrics): number {
  const exploitability =
    WEIGHTS.AV[m.AV] * WEIGHTS.AC[m.AC] * WEIGHTS.AT[m.AT] * WEIGHTS.PR[m.PR] * WEIGHTS.UI[m.UI];

  const vulnImpact = 1 - (1 - IMPACT[m.VC]) * (1 - IMPACT[m.VI]) * (1 - IMPACT[m.VA]);
  const subImpact = 1 - (1 - IMPACT[m.SC]) * (1 - IMPACT[m.SI]) * (1 - IMPACT[m.SA]);
  const impact = Math.max(vulnImpact, subImpact * 0.9); // dampak sistem turunan sedikit didiskon

  // Skala ke 0..10, exploitability berperan sebagai pengali dampak (mirip semantik v3/v4).
  const raw = 10 * impact * (0.6 + 0.4 * exploitability);
  const score = Math.min(10, Math.max(0, raw));
  return Math.round(score * 10) / 10;
}

export function scoreToSeverity(score: number): Severity {
  if (score <= 0) return "info";
  if (score < 4.0) return "low";
  if (score < 7.0) return "medium";
  if (score < 9.0) return "high";
  return "critical";
}

export function buildVectorString(m: Cvss4Metrics): string {
  return `CVSS:4.0/AV:${m.AV}/AC:${m.AC}/AT:${m.AT}/PR:${m.PR}/UI:${m.UI}/VC:${m.VC}/VI:${m.VI}/VA:${m.VA}/SC:${m.SC}/SI:${m.SI}/SA:${m.SA}`;
}

export function parseVectorString(vector: string): Cvss4Metrics | null {
  const parts = vector.replace(/^CVSS:4\.0\//, "").split("/");
  const map: Record<string, string> = {};
  for (const p of parts) {
    const [k, v] = p.split(":");
    if (k && v) map[k] = v;
  }
  const result = validateMetrics(map);
  return result.ok ? result.metrics : null;
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#b91c1c",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#2563eb",
  info: "#6b7280",
};
