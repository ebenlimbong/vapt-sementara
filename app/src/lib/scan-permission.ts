import { prisma } from "@/lib/db";

export type ScanPermissionResult =
  | { allowed: true; scopeVersionId: string; windowStart: Date; windowEnd: Date }
  | { allowed: false; reason: string };

/**
 * Gerbang izin tunggal: scan/retest/uji-akses HANYA boleh di-enqueue bila
 *  1. Ada scope version yang disetujui (ScopeApproval.decision = approved) untuk request ini, DAN
 *  2. TestWindow dari approval itu aktif (is_active) dan waktu SEKARANG berada di [start_at, end_at].
 *
 * Dipakai oleh: POST /api/requests/[id]/scan-permission (untuk tombol di UI),
 * endpoint pembuat ScanJob di modul scan-web & api-security, dan endpoint retest.
 * Worker (worker/index.ts) melakukan pengecekan ULANG yang sama saat eksekusi
 * (defense in depth: approval bisa dicabut / jendela berakhir di antara enqueue dan run).
 */
export async function checkScanPermission(requestId: string): Promise<ScanPermissionResult> {
  const now = new Date();

  const latestApproval = await prisma.scopeApproval.findFirst({
    where: { decision: "approved", scopeVersion: { requestId } },
    orderBy: { decidedAt: "desc" },
    include: { scopeVersion: true, testWindow: true },
  });

  if (!latestApproval) {
    return { allowed: false, reason: "Belum ada ruang lingkup yang disetujui." };
  }

  const window = latestApproval.testWindow;
  if (!window || !window.isActive) {
    return { allowed: false, reason: "Jendela waktu tes untuk persetujuan ini sudah tidak aktif." };
  }

  if (now < window.startAt || now > window.endAt) {
    return {
      allowed: false,
      reason: `Di luar jendela waktu tes yang berlaku (${window.startAt.toISOString()} s.d. ${window.endAt.toISOString()}).`,
    };
  }

  return {
    allowed: true,
    scopeVersionId: latestApproval.scopeVersionId,
    windowStart: window.startAt,
    windowEnd: window.endAt,
  };
}
