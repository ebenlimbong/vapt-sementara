# Triage & Temuan

Memilah hasil scan menjadi temuan resmi yang terbukti, lengkap dengan tingkat bahaya dan bukti yang tidak bisa diubah.

## Spesifikasi

### Tujuan
Memilah hasil mentah scan menjadi temuan resmi yang terbukti agar tim hanya menindaklanjuti masalah nyata, lengkap dengan tingkat bahaya dan bukti yang tidak bisa diubah.

### Selesai bila
- User dapat melihat daftar kandidat hasil scan dengan judul, kategori, dan statusnya (baru, jadi temuan, alarm palsu).
- Kandidat yang diverifikasi sebagai temuan nyata berubah menjadi temuan resmi, sedangkan alarm palsu ditandai dan tidak dihitung sebagai temuan.
- Setiap temuan resmi memiliki tingkat bahaya (skor CVSS v4.0) dan minimal satu bukti yang tersimpan dengan sidik digital SHA-256.
- Temuan manual dapat dicatat lengkap dengan deskripsi, langkah reproduksi, dan dampaknya.
- Setiap keputusan verifikasi, pembuatan temuan, dan unggahan bukti tercatat di jejak audit.

## Sub-fitur: Verifikasi Kandidat

User memutuskan kandidat mana yang benar-benar temuan dan mana yang hanya alarm palsu.

### Tujuan
Memungkinkan user memutuskan kandidat hasil scan mana yang benar-benar temuan dan mana yang hanya alarm palsu, sehingga tidak ada temuan yang muncul tanpa pemeriksaan manusia.

### Selesai bila
- Tiap kandidat menampilkan ringkasan, kategori, dan detail mentah yang sudah disamarkan, dengan pilihan tindakan "Jadikan Temuan" atau "Tandai Alarm Palsu".
- Kandidat yang ditandai alarm palsu tidak lagi muncul di antrean kandidat baru dan tidak dihitung sebagai temuan.
- Daftar kandidat memiliki empty state, loading state, dan error state yang jelas, serta keputusan verifikasi tercatat di jejak audit.

## Sub-fitur: Temuan Manual

Temuan dari pengujian tangan dicatat dengan deskripsi, langkah, dan dampaknya.

### Tujuan
Memungkinkan user mencatat temuan yang ditemukan lewat pengujian tangan, karena tidak semua masalah keamanan berasal dari hasil scan otomatis.

### Selesai bila
- Formulir temuan manual menerima judul, deskripsi, langkah reproduksi, dan dampak, lalu menyimpannya sebagai temuan resmi tanpa kandidat asal.
- Temuan manual tampil di daftar temuan yang sama dengan temuan hasil verifikasi kandidat, ditandai sebagai temuan manual.
- Temuan manual wajib mengisi kolom yang ditentukan; bila ada yang kosong, muncul pesan error yang jelas dan data tidak tersimpan.

## Sub-fitur: Skor CVSS

Setiap temuan diberi nilai tingkat bahaya memakai standar CVSS v4.0.

### Tujuan
Memberi setiap temuan satu nilai tingkat bahaya standar CVSS v4.0 agar prioritas perbaikan bisa dibandingkan secara objektif.

### Selesai bila
- User dapat mengisi komponen CVSS v4.0 pada temuan dan sistem menampilkan skor 0.0–10.0 beserta label severity (critical/high/medium/low/info).
- Skor dan severity tersimpan pada temuan dan tampil konsisten dengan skema warna severity yang sama di seluruh halaman.
- Bila komponen CVSS belum lengkap atau tidak valid, skor tidak disimpan dan muncul pesan error yang menjelaskan bagian yang kurang.

## Sub-fitur: Bukti Berversi

Bukti berupa tangkapan layar atau log disimpan berversi dengan sidik digital SHA-256 sehingga tidak bisa ditimpa.

### Tujuan
Menyimpan bukti temuan berupa tangkapan layar atau log secara berversi dengan sidik digital SHA-256 sehingga bukti lama tidak pernah hilang atau tertimpa.

### Selesai bila
- Setiap unggahan bukti pada satu temuan tersimpan sebagai versi baru dengan nomor versi berurutan, dan versi lama tetap dapat dilihat.
- Tiap versi menampilkan sidik digital SHA-256 beserta waktu unggah dan nama pengunggah, dan tidak ada cara menimpa atau menghapus versi yang sudah ada.
- Halaman bukti memiliki empty state, loading state, dan error state yang jelas, serta setiap unggahan tercatat di jejak audit.

## Task

### 1. Bangun halaman antrean triage kandidat

### 2. Buat panel detail kandidat dan aksi verifikasi

### 3. Buat daftar temuan gabungan dengan badge sumber

### 4. Buat formulir temuan manual dengan validasi

### 5. Buat kalkulator CVSS v4.0 interaktif

### 6. Buat halaman bukti berversi dengan metadata SHA-256

### 7. Buat skema dan migrasi triage temuan bukti

### 8. Buat API daftar dan detail kandidat tersamarkan

### 9. Buat API verifikasi kandidat dan pencatatan audit

### 10. Buat API temuan manual dengan validasi wajib

### 11. Buat service perhitungan CVSS v4.0 tervalidasi

### 12. Buat API unggah bukti berversi SHA-256

### 13. Buat API daftar versi bukti immutable

### 14. Tambahkan pencatatan audit alur triage menyeluruh
