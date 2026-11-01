# Akun & Hak Akses

Mengatur siapa boleh masuk dan boleh berbuat apa pada tiap aplikasi, plus catatan semua aksi yang terjadi.

## Spesifikasi

### Tujuan
Fitur ini ada agar setiap orang hanya bisa masuk dan melakukan hal yang sesuai perannya pada aplikasi tertentu, sementara semua aksi penting terekam rapi untuk diaudit.

### Selesai bila
- Pengguna dapat masuk dengan aman dan verifikasi dua langkah sesuai pengaturan akunnya.
- Admin dapat mengelola akun pengguna dan menetapkan peran hanya pada aplikasi yang ditugaskan.
- Tanpa penugasan aplikasi, pengguna tidak melihat data dan tidak bisa menjalankan aksi pada aplikasi tersebut; pesan kosong yang jelas ditampilkan.
- Kredensial pengujian tersimpan aman, tidak pernah tampil mentah, dan hanya digunakan saat scan berjalan.
- Setiap aksi penting seperti login, perubahan akun atau peran, approval, scan, verifikasi temuan, dan unduhan laporan tercatat permanen di jejak audit.

## Sub-fitur: Masuk & MFA

User masuk ke aplikasi dengan verifikasi dua langkah demi keamanan akun.

### Tujuan
Memastikan hanya pengguna yang sah dapat masuk, dengan verifikasi dua langkah untuk melindungi akun.

### Selesai bila
- Pengguna bisa masuk dengan email dan kata sandi, lalu diminta kode verifikasi dua langkah bila fitur itu aktif untuk akunnya.
- Kode verifikasi yang salah atau kedaluwarsa ditolak dengan pesan jelas, dan percobaan masuk yang gagal tercatat.
- Setelah berhasil masuk, pengguna diarahkan ke dashboard dan sesi dapat diakhiri dengan keluar.

## Sub-fitur: Kelola Pengguna

Admin menambah, menonaktifkan, dan mengatur akun pengguna.

### Tujuan
Memberi Admin cara menambah, menonaktifkan, dan mengatur akun pengguna agar akses tetap terkendali.

### Selesai bila
- Admin dapat melihat daftar pengguna beserta status aktif atau nonaktif dan mencari pengguna tertentu.
- Admin dapat menambah pengguna baru serta menonaktifkan atau mengaktifkan kembali akun.
- Perubahan akun langsung tercatat di jejak audit dan pengguna nonaktif tidak bisa masuk.

## Sub-fitur: Peran & Penugasan

Peran diatur per aplikasi; tanpa penugasan, seseorang tidak punya akses apa pun.

### Tujuan
Mengatur peran setiap pengguna per aplikasi sehingga akses hanya diberikan bila ada penugasan eksplisit.

### Selesai bila
- Admin dapat menetapkan peran Admin, Coordinator, Tester, atau App Owner pada pengguna untuk aplikasi tertentu.
- Pengguna tanpa penugasan pada suatu aplikasi tidak bisa melihat data maupun menjalankan aksi di aplikasi itu, dengan pesan bahwa pengguna belum punya akses ke aplikasi ini.
- Aksi yang tidak sesuai peran, misalnya Tester menyetujui scope sendiri atau App Owner menjalankan scan, diblokir dengan penjelasan.

## Sub-fitur: Vault Kredensial

Kredensial untuk pengujian tersimpan aman dan hanya dipakai saat scan berjalan.

### Tujuan
Menyimpan kredensial pengujian secara aman agar hanya dipakai saat scan berjalan dan tidak pernah terekspos ke pengguna.

### Selesai bila
- Admin atau pihak berwenang dapat menambah, melihat label, dan mengganti kredensial uji tanpa pernah melihat nilai aslinya setelah disimpan.
- Nilai kredensial hanya dapat dipakai oleh proses scan yang sah dan tidak muncul di tampilan, log, maupun laporan.
- Setiap perubahan kredensial tercatat di jejak audit dengan nilai yang disamarkan.

## Sub-fitur: Jejak Audit

Semua aksi penting tercatat permanen dan tidak bisa diubah atau dihapus.

### Tujuan
Mencatat semua aksi penting secara permanen agar aktivitas keamanan dapat ditelusuri dan dipertanggungjawabkan.

### Selesai bila
- Jejak audit menampilkan daftar aksi penting lengkap dengan pelaku, waktu, objek terkait, dan keterangan singkat.
- Catatan audit bersifat append-only: tidak ada tombol ubah atau hapus, dan isinya tetap sama setelah dibuat.
- Token, kata sandi, dan data sensitif lain selalu tersamar di jejak audit; unduhan atau ekspor catatan juga tercatat.

## Task

### 1. Bangun layout utama & halaman login mock

### 2. Buat halaman verifikasi MFA mock

### 3. Buat halaman kelola pengguna mock

### 4. Buat form tambah pengguna mock

### 5. Buat halaman peran penugasan aplikasi mock

### 6. Buat komponen empty state akses ditolak

### 7. Buat halaman vault kredensial mock

### 8. Buat halaman jejak audit mock

### 9. Buat filter dan detail audit mock

### 10. Buat skema migrasi pengguna sesi MFA

### 11. Buat skema penugasan peran aplikasi

### 12. Buat skema vault kredensial terenkripsi

### 13. Buat skema jejak audit append-only

### 14. Implementasi login password dan pembuatan sesi

### 15. Implementasi verifikasi MFA dan penolakan kode

### 16. Buat endpoint login MFA logout dan middleware sesi

### 17. Catat percobaan login gagal ke audit

### 18. Buat API daftar cari dan status pengguna

### 19. Buat API tambah nonaktifkan dan aktifkan pengguna

### 20. Catat perubahan akun pengguna ke audit

### 21. Buat API penetapan peran per aplikasi

### 22. Implementasi middleware RBAC deny-by-default

### 23. Implementasi guard aksi sensitif sesuai peran

### 24. Catat perubahan peran dan penugasan ke audit

### 25. Buat service enkripsi dan API kredensial masked

### 26. Integrasi akses kredensial hanya untuk scan sah

### 27. Catat perubahan kredensial ke audit tersamar

### 28. Buat service audit append-only dengan masking

### 29. Buat API daftar detail dan ekspor audit

### 30. Uji immutability audit dan larangan endpoint ubah
