# Laporan PDF

Mengubah hasil uji menjadi laporan siap bagikan, baik untuk tim teknis maupun untuk pimpinan.

## Spesifikasi

### Tujuan
Mengubah hasil uji keamanan menjadi laporan PDF siap bagikan — versi teknis untuk tim dan versi eksekutif untuk pimpinan — dengan data sensitif tersamarkan.
### Selesai bila
- Tester dapat membuat dua jenis laporan (teknis dan eksekutif) dari satu permintaan uji yang memiliki temuan, dan keduanya muncul di daftar laporan dengan jenis, aplikasi, pembuat, serta waktu.
- Setiap laporan menghasilkan berkas PDF yang bisa diunduh ulang, dengan sidik digital SHA-256 tercatat dan ditampilkan singkat.
- Isi laporan mengikuti data temuan saat pembuatan — severity, status, dan bukti versi terakhir — serta halaman daftar laporan memiliki empty, loading, dan error state yang jelas.
- Token dan kata sandi tidak pernah muncul di PDF maupun pratinjau; bagian sensitif tampil tersamarkan.
- Setiap pembuatan dan unduhan laporan tercatat di jejak audit.

## Sub-fitur: Laporan Teknis

Laporan rinci per temuan berisi bukti dan cara perbaikannya untuk tim teknis.

### Tujuan
Menyajikan rincian tiap temuan beserta bukti dan cara perbaikannya untuk tim teknis.
### Selesai bila
- Laporan memuat daftar temuan per aplikasi dengan judul, severity berwarna konsisten, skor/vektor CVSS, status, dan deskripsi.
- Tiap temuan menyertakan bukti versi terakhir dan langkah perbaikan yang bisa dibaca tim teknis.
- Laporan dapat dibuat dan diunduh sebagai PDF oleh Tester; PDF yang sudah dibuat tetap sama isinya meski data temuan diperbarui kemudian.

## Sub-fitur: Laporan Eksekutif

Ringkasan singkat berisi rating keamanan dan risiko utama untuk pimpinan.

### Tujuan
Memberi ringkasan kondisi keamanan dan risiko utama bagi pimpinan.
### Selesai bila
- Laporan menampilkan rating keamanan A–F aplikasi, jumlah temuan per severity, dan ringkasan total temuan terbuka vs selesai.
- Laporan menyorot maksimal beberapa risiko utama (critical/high) dengan bahasa ringkas non-teknis.
- Laporan dapat dibuat dan diunduh sebagai PDF terpisah dari versi teknis, dengan halaman sampul berisi nama aplikasi, periode uji, dan tanggal cetak.

## Sub-fitur: Penyamaran Data Sensitif

Token dan kata sandi otomatis disamarkan sehingga tidak pernah ikut tercetak di laporan.

### Tujuan
Memastikan token dan kata sandi tidak pernah ikut tercetak di laporan.
### Selesai bila
- Setiap nilai yang dikenali sebagai token, kata sandi, atau kredensial tampil sebagai masker (mis. `••••` atau `[DISAMARKAN]`) di pratinjau dan PDF.
- Penyamaran berlaku pada isi temuan, bukti mentah, log, dan metadata laporan tanpa mengubah data asli di database.
- Ada pengecekan/indikator bahwa tidak ada pola token atau kata sandi yang lolos ke PDF sebelum laporan disimpan.

## Task

### 1. Buat halaman daftar laporan dengan data tiruan

### 2. Buat pratinjau laporan teknis dengan data tiruan

### 3. Buat pratinjau laporan eksekutif dengan data tiruan

### 4. Terapkan penyamaran data sensitif di pratinjau

### 5. Buat dialog pembuatan laporan dan unduhan

### 6. Tambahkan indikator bebas token pada pratinjau

### 7. Buat tabel laporan dan migrasinya

### 8. Buat layanan penyamaran data sensitif

### 9. Susun snapshot laporan teknis dari temuan

### 10. Susun snapshot laporan eksekutif dari temuan

### 11. Buat generator PDF dan sidik SHA-256

### 12. Buat endpoint daftar dan pembuatan laporan

### 13. Buat endpoint unduh laporan dan hash

### 14. Validasi PDF bebas token sebelum disimpan

### 15. Catat audit pembuatan dan unduhan laporan
