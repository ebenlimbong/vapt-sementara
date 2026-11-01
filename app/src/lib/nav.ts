export type NavItem = { href: string; label: string; group: string };

// Navigasi utama — dibagi per subsistem PRD. Rute yang belum dibangun subagent
// tetap dicantumkan supaya information architecture tidak berubah saat modul menyusul.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", group: "Utama" },

  { href: "/requests", label: "Permintaan Tes", group: "Izin Tes" },
  { href: "/scope-approvals", label: "Persetujuan Scope", group: "Izin Tes" },

  { href: "/scan-web", label: "Scan Otomatis Web", group: "Pengujian" },
  { href: "/api-security", label: "Uji Akses API", group: "Pengujian" },

  { href: "/triage", label: "Triage Kandidat", group: "Temuan" },
  { href: "/findings", label: "Daftar Temuan", group: "Temuan" },
  { href: "/remediation", label: "Papan Perbaikan", group: "Temuan" },
  { href: "/reports", label: "Laporan PDF", group: "Temuan" },

  { href: "/admin/applications", label: "Aplikasi", group: "Administrasi" },
  { href: "/admin/users", label: "Pengguna & Peran", group: "Administrasi" },
  { href: "/admin/vault", label: "Vault Kredensial", group: "Administrasi" },
  { href: "/audit-log", label: "Jejak Audit", group: "Administrasi" },
];

export const NAV_GROUPS = ["Utama", "Izin Tes", "Pengujian", "Temuan", "Administrasi"];
