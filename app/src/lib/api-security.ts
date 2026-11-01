import { NextResponse } from "next/server";
import { ForbiddenError } from "@/lib/rbac";
import type { Role } from "@prisma/client";

/**
 * Helper khusus modul Uji Akses API (src/app/api/api-security/**, src/app/(app)/api-security/**).
 * Tidak mengubah src/lib/auth.ts / rbac.ts / audit.ts — hanya membungkus pola error yang
 * berulang di semua route handler modul ini supaya konsisten.
 *
 * Model peran GLOBAL (2 peran): admin & pentester, tidak ada lagi penugasan per-aplikasi.
 * Admin = oversight read-only (lihat semua aplikasi/spec/endpoint/akun uji/skenario).
 * Pentester = satu-satunya role yang menjalankan aksi teknis (import, toggle in_scope,
 * CRUD akun uji, CRUD skenario, jalankan pengujian).
 */

/** Role yang boleh MELIHAT modul ini (GET/list/detail). */
export const VIEW_ROLES: Role[] = ["admin", "pentester"];

/** Role yang boleh MENGUBAH (import spec, toggle in_scope, CRUD akun uji, CRUD skenario,
 * jalankan pengujian). Admin TIDAK menjalankan aksi teknis apapun di modul ini. */
export const TESTER_ONLY: Role[] = ["pentester"];

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof Error && err.name === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  // Prisma foreign key constraint (P2003) — mis. hapus akun uji yang masih dipakai skenario.
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: string }).code === "P2003"
  ) {
    return NextResponse.json(
      { error: "Data masih dipakai oleh data lain yang terkait, tidak bisa dihapus." },
      { status: 409 }
    );
  }
  console.error("[api-security]", err);
  return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
}
