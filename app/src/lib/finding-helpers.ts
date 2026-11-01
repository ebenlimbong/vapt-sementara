import { prisma } from "@/lib/db";
import { checkScanPermission } from "@/lib/scan-permission";

/**
 * Helper kecil yang dipakai berulang di route-route triage/findings/remediation/reports.
 * Tidak mengubah lib yang sudah ada (auth/rbac/dll) — cuma komposisi di atasnya.
 *
 * Catatan: model peran sekarang GLOBAL (admin/pentester) — tidak ada lagi penugasan
 * per-aplikasi, jadi tidak ada lagi helper "canViewApp". Visibilitas aplikasi/temuan
 * ditentukan murni oleh role (requireRole/requireAdmin/requirePentester di setiap route).
 */

/** Default tenggat perbaikan berdasarkan severity saat temuan pertama kali dibuat. */
export function defaultDueDate(severity: string): Date | null {
  const days: Record<string, number> = { critical: 3, high: 7, medium: 14, low: 30 };
  const d = days[severity];
  if (!d) return null; // info / tak dikenal -> tanpa tenggat otomatis
  const due = new Date();
  due.setDate(due.getDate() + d);
  return due;
}

/**
 * Cari TestRequest milik appId yang approval-nya masih aktif (lolos checkScanPermission),
 * dipakai sebagai syarat gerbang izin sebelum retest dijalankan. Mengambil request
 * ber-status 'disetujui' terbaru dulu, longgar ke semua request bila belum ada yang cocok.
 */
export async function findActiveApprovedRequest(appId: string) {
  const candidates = await prisma.testRequest.findMany({
    where: { appId, status: { in: ["disetujui", "berjalan"] } },
    orderBy: { createdAt: "desc" },
  });
  for (const req of candidates) {
    const perm = await checkScanPermission(req.id);
    if (perm.allowed) return { request: req, permission: perm };
  }
  return null;
}
