# Permintaan & Izin Tes

Alur pengajuan uji keamanan sampai izinnya disetujui, sehingga tidak ada tes yang berjalan tanpa persetujuan.

## Spesifikasi

### Tujuan
Menyediakan alur resmi dari pengajuan uji keamanan sampai izinnya disetujui, sehingga tidak ada tes yang berjalan tanpa persetujuan dan jendela waktu yang sah.

### Selesai bila
- Pemilik aplikasi dapat mengajukan permintaan uji (target, tujuan, waktu yang diinginkan) dan permintaan itu langsung muncul di daftar tes dengan statusnya.
- Tester dapat menyusun ruang lingkup berversi dan membandingkannya dengan versi sebelumnya, lalu mengirimkannya untuk persetujuan.
- Koordinator dapat menyetujui atau menolak ruang lingkup; tester tidak bisa menyetujui ruang lingkup miliknya sendiri.
- Persetujuan yang sah otomatis membuat jendela waktu tes; di luar jendela itu setiap permintaan scan ditolak dengan alasan yang terlihat oleh user dan tercatat.
- Setiap langkah pengajuan, perubahan ruang lingkup, keputusan persetujuan, dan penolakan tercatat di jejak audit.

## Sub-fitur: Ajukan Permintaan

Pemilik aplikasi mengajukan uji keamanan dengan mengisi target, tujuan, dan waktu yang diinginkan.

### Tujuan
Memungkinkan pemilik aplikasi mengajukan uji keamanan secara resmi dengan target, tujuan, dan waktu yang diinginkan, sehingga setiap tes berawal dari permintaan yang terdokumentasi.

### Selesai bila
- Form pengajuan meminta target (web/API), tujuan pengujian, serta waktu mulai dan selesai yang diinginkan, dengan penanda jelas bila ada isian wajib yang kosong.
- Setelah dikirim, permintaan muncul di daftar tes dengan status awal "diajukan", nama aplikasi, dan pengaju.
- Pengajuan tercatat di jejak audit dan hanya bisa dilakukan oleh user yang berwenang atas aplikasi tersebut; tanpa penugasan, aksi ditolak dengan pesan yang jelas.

## Sub-fitur: Ruang Lingkup Berversi

Cakupan uji disusun bertahap dan tiap perubahan bisa dibandingkan dengan versi sebelumnya.

### Tujuan
Membuat cakupan uji tersusun bertahap dan dapat dibandingkan antar versi, sehingga perubahan cakupan selalu terlacak dan dapat ditinjau.

### Selesai bila
- Tester dapat membuat versi ruang lingkup baru (versi 1, 2, 3, …) berisi halaman/endpoint, akun uji, dan batasan uji.
- Setiap versi menampilkan ringkasan perbedaan terhadap versi sebelumnya dalam format yang mudah dibaca (apa yang ditambah, diubah, dihapus).
- Riwayat versi tampil berurutan dengan penyusun dan waktu pembuatan, dan versi lama tidak bisa ditimpa.
- Tester dapat menandai satu versi sebagai final untuk dikirim ke persetujuan.

## Sub-fitur: Persetujuan Berjenjang

Koordinator memeriksa dan menyetujui cakupan sebelum pekerjaan uji boleh dimulai; tester tidak dapat menyetujui cakupan miliknya sendiri.

### Tujuan
Memastikan hanya koordinator yang dapat menyetujui ruang lingkup, dengan pemisahan tugas sehingga pekerjaan uji tidak dimulai tanpa persetujuan yang sah.

### Selesai bila
- Koordinator melihat daftar ruang lingkup yang menunggu persetujuan beserta isi dan perbedaannya, lalu dapat memilih setuju atau tolak disertai alasan.
- Tester yang mencoba menyetujui ruang lingkup miliknya sendiri diblokir dengan penjelasan pemisahan tugas.
- Keputusan persetujuan mengubah status permintaan menjadi disetujui/ditolak dan tercatat di jejak audit.
- Bila belum ada persetujuan aktif, tombol menjalankan scan nonaktif dengan pesan "Belum ada ruang lingkup yang disetujui".

## Sub-fitur: Jendela Waktu Tes

Izin hanya berlaku pada rentang waktu tertentu; di luar itu scan otomatis ditolak.

### Tujuan
Membatasi izin uji hanya pada rentang waktu tertentu sehingga scan di luar jadwal otomatis ditolak dan dapat dipertanggungjawabkan.

### Selesai bila
- Persetujuan yang sah otomatis membuat jendela waktu tes dengan tanggal mulai dan selesai yang ditampilkan jelas pada halaman tes.
- Permintaan scan di luar jendela waktu ditolak disertai pesan rentang waktu yang berlaku, dan penolakan tercatat di jejak audit.
- Status jendela waktu (aktif/berakhir) terlihat oleh user, dan permintaan scan yang valid hanya bisa berjalan saat jendela aktif.

## Task

### 1. Bangun halaman daftar tes dengan data tiruan

### 2. Buat form pengajuan uji dengan validasi mock

### 3. Buat halaman detail tes dengan ruang lingkup mock

### 4. Buat komponen diff versi ruang lingkup

### 5. Buat panel persetujuan koordinator dengan data tiruan

### 6. Tampilkan jendela waktu dan status izin scan

### 7. Buat tabel permintaan tes dan migrasi

### 8. Buat tabel ruang lingkup, approval, jendela waktu

### 9. Buat service audit trail terpusat

### 10. Implementasi API pengajuan permintaan dengan RBAC aplikasi

### 11. Implementasi API versi ruang lingkup dan diff

### 12. Implementasi API persetujuan dengan pemisahan tugas

### 13. Buat service jendela waktu dan penolakan scan

### 14. Sediakan API status izin scan untuk UI
