# VAPT ITERA — Platform Uji Keamanan Internal

Platform manajemen siklus VAPT (Vulnerability Assessment & Penetration Testing) internal
untuk UPA TIK ITERA: **permintaan → ruang lingkup berversi → persetujuan → scan →
triage → remediasi → retest → laporan PDF**, dengan RBAC per-aplikasi (deny by default),
audit log append-only, dan bukti temuan tamper-evident (SHA-256).

Lihat `PRD.md` dan `features/*.md` untuk spesifikasi lengkap.

## Stack

- **Frontend+Backend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4, satu
  codebase (`app/`). API routes Node.js di `app/src/app/api/**`.
- **Database:** PostgreSQL (Prisma ORM, driver adapter `@prisma/adapter-pg`). Tabel
  `scan_jobs` juga berfungsi sebagai antrean pekerjaan (tanpa broker tambahan).
- **Worker:** proses Node.js terpisah (`app/worker/`) yang polling antrean, menjalankan
  pemeriksaan header/cookie/info-disclosure + spider terbatas, **fingerprint teknologi
  (httpx, dataset Wappalyzer)**, dan **kerentanan tervalidasi via `nuclei`** (template
  komunitas: CVE versi-spesifik, exposure, misconfig — tag intrusif/DoS/fuzzing/bruteforce
  dikecualikan), plus skenario uji akses API, dengan guard anti-SSRF
  (`app/src/lib/ssrf-guard.ts`). Lihat `app/worker/realtools.ts`. Kedua tool bersifat
  **opsional**: kalau binary tidak ada di PATH worker, stage-nya dilewati (tercatat jelas
  di event, job tidak gagal).
- **Target lab:** OWASP Juice Shop, DVWA, VAmPI, crAPI (via Docker Compose, jaringan
  terisolasi) — sengaja vulnerable, HANYA untuk staging/lab internal.
- **Target "web asli" tanpa Docker:** `demo.owasp-juice.shop` — demo publik **resmi OWASP**
  (app rentan yang sama, dihost online, legal diuji tanpa izin tambahan), sudah di-seed
  sebagai aplikasi contoh. Host lain boleh ditambahkan via `ALLOWED_SCAN_HOSTS` + scope
  version `allowedHosts` — **hanya untuk target yang memang berwenang diuji**; worker
  memblokir loopback/link-local/metadata secara permanen apa pun isi allowlist-nya.

## Menjalankan — Mode Development (tanpa Docker)

1. Pastikan PostgreSQL 16 lokal berjalan dan database `vapt` + role `vapt` sudah dibuat:
   ```
   sudo -u postgres psql -c "CREATE ROLE vapt WITH LOGIN PASSWORD 'vapt_dev_password' CREATEDB;" \
                          -c "CREATE DATABASE vapt OWNER vapt;"
   ```
2. `cd app && npm install` (sekali saja; `postinstall` otomatis menjalankan `prisma generate`).
3. Salin `.env.example` ke `.env` kalau belum ada, isi `DATABASE_URL`/`AUTH_SECRET`/`VAULT_KEY`.
4. `npm run db:migrate` — membuat seluruh tabel dari `prisma/schema.prisma`.
5. `npm run db:seed` — membuat akun demo (admin/coordinator/tester/app_owner) + 4 aplikasi
   lab, dan menulis `PLATFORM_APP_ID` ke `.env` (menentukan aplikasi mana yang role admin-nya
   dianggap Admin platform/global).
6. `npm run dev` — jalankan aplikasi di http://localhost:3000.
7. Di terminal lain: `npm run worker` — jalankan worker scan (butuh `.env` yang sama).

Akun demo (password sama semua: `Password123!`):

| Role | Email |
|---|---|
| Admin | admin@itera.ac.id |
| Coordinator | koordinator@itera.ac.id |
| Tester | tester@itera.ac.id |
| App Owner | owner@itera.ac.id |

## Menjalankan — Docker Compose (termasuk target lab)

```
docker compose up -d --build
```

Ini menjalankan: `db` (Postgres), `app` (Next.js, otomatis `prisma migrate deploy` saat start),
`worker`, dan 4 target lab (`juice-shop`, `dvwa`, `vampi`, `crapi-api`) di jaringan `lab-net`
yang terisolasi dari jaringan `vapt-net`. Jalankan seed secara manual sekali setelah container
`app` sehat:

```
docker compose exec app npx tsx prisma/seed.ts
```

**Catatan crAPI:** image `crapi/crapi-identity` di compose ini hanya representasi minimal
satu service dari stack crAPI yang sesungguhnya (yang aslinya multi-container: identity,
community, workshop, mailhog, mongo, dst). Untuk pengujian API yang lebih representatif,
pertimbangkan menjalankan docker-compose resmi crAPI secara terpisah dan mendaftarkan
base URL-nya sebagai `Application` baru di platform ini.

## Struktur Kerja

- `app/prisma/schema.prisma` — skema database (18 tabel, sesuai PRD §6). **Jangan diubah**
  tanpa migrasi baru yang terkoordinasi.
- `app/src/lib/` — pustaka inti bersama: auth+MFA, RBAC deny-by-default, audit log
  append-only, masking data sensitif, vault kredensial (AES-256-GCM), CVSS v4.0 calculator,
  anti-SSRF guard, rating A-F, penyimpanan bukti/laporan immutable (hash-addressed).
- `app/worker/` — worker scan (polling `scan_jobs`, eksekusi tahap, anti-SSRF, simpan
  kandidat). Berjalan sebagai proses terpisah dari aplikasi web.
- `app/src/app/(app)/` — halaman terproteksi (dashboard, requests, scan-web, api-security,
  triage, findings, remediation, reports, admin, audit-log).

## Keamanan & Batasan yang Disengaja

- Target scan **hanya** host yang ada di allowlist scope yang disetujui — di luar itu
  ditolak (anti-SSRF, lihat `src/lib/ssrf-guard.ts`).
- Tidak ada scan/retest yang berjalan tanpa `TestWindow` aktif dan approval yang sah
  (`src/lib/scan-permission.ts`) — dicek baik di API (sebelum enqueue) maupun di worker
  (saat eksekusi).
- Kredensial uji & token selalu dienkripsi di database dan disamarkan di UI/log/laporan;
  nilai asli hanya pernah ada di memori worker selama job berjalan.
- Bukti (`evidence`) dan laporan (`reports`) disimpan dengan nama file = SHA-256 kontennya —
  tidak ada endpoint update/delete untuk keduanya.
- Audit log (`audit_logs`) append-only — tidak ada endpoint ubah/hapus.

Di luar cakupan (sesuai PRD): SSO, notifikasi eksternal, network/port scan, brute force, DoS,
pengujian terhadap production.
