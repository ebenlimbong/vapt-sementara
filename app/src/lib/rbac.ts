import type { Role, User } from "@prisma/client";
import { writeAudit } from "@/lib/audit";

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Model peran GLOBAL per user (2 peran): admin & pentester.
 *  - admin: kelola user/aplikasi/vault kredensial, approve/reject ruang lingkup, lihat audit.
 *  - pentester: ajukan permintaan, susun scope, jalankan scan, triage, CVSS, remediasi, retest, laporan.
 * Tidak ada lagi penugasan per-aplikasi (app_assignments) — role langsung menentukan
 * akses ke SELURUH aplikasi. Pemisahan tugas ditegakkan lewat pemisahan ROLE itu sendiri:
 * endpoint approval hanya menerima admin, endpoint eksekusi hanya menerima pentester,
 * sehingga satu orang tidak pernah bisa mengajukan + menyetujui scope yang sama.
 */

/** Lempar ForbiddenError (+ catat audit) kalau role user tidak termasuk yang diizinkan. */
export async function requireRole(
  user: User,
  roles: Role[],
  opts?: { action?: string; ip?: string | null }
): Promise<void> {
  if (!roles.includes(user.role)) {
    await writeAudit({
      actorId: user.id,
      action: opts?.action ?? "access.denied",
      entityType: "role_check",
      entityId: null,
      metadata: { requiredRoles: roles, actualRole: user.role },
      ipAddress: opts?.ip ?? null,
    });
    throw new ForbiddenError(
      roles.includes("admin") && !roles.includes("pentester")
        ? "Hanya Admin yang dapat melakukan aksi ini."
        : "Peran Anda (" + user.role + ") tidak diizinkan melakukan aksi ini."
    );
  }
}

export async function requireAdmin(user: User, ip?: string | null) {
  return requireRole(user, ["admin"], { action: "access.denied.admin_only", ip });
}

export async function requirePentester(user: User, ip?: string | null) {
  return requireRole(user, ["pentester"], { action: "access.denied.pentester_only", ip });
}
