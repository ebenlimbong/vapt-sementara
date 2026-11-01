# Papan Perbaikan

Tempat tim dan pemilik aplikasi mengikuti dan menuntaskan perbaikan temuan sampai terbukti aman lewat uji ulang.

## Spesifikasi

### Tujuan
Memberi satu tempat bagi tim keamanan dan pemilik aplikasi untuk memantau, menanggapi, dan menuntaskan setiap temuan sampai dinyatakan aman lewat uji ulang.

### Selesai bila
- Semua temuan resmi tampil di papan perbaikan dengan tahap yang jelas: Baru, Dikerjakan, Menunggu Uji Ulang, dan Selesai.
- Temuan dapat dipindahkan antar tahap sesuai peran; App Owner hanya dapat menanggapi dan mengajukan uji ulang, tidak dapat menutup temuan.
- Setiap perpindahan tahap tercatat lengkap dengan pelaku dan waktu, serta riwayatnya dapat dilihat.
- Temuan yang mendekati atau melewati tenggat ditandai jelas di papan.
- Status akhir Selesai hanya muncul setelah retest menyatakan temuan tertutup.

## Sub-fitur: Papan Kanban

Temuan digeser antar tahap perbaikan—baru, dikerjakan, menunggu uji ulang, selesai.

### Tujuan
Menampilkan temuan dalam kolom tahap perbaikan agar tim dapat melihat posisi setiap temuan sekilas.

### Selesai bila
- Empat kolom Baru, Dikerjakan, Menunggu Uji Ulang, dan Selesai tampil dengan jumlah temuan per kolom.
- Kartu temuan menampilkan judul, aplikasi, severity dengan warna konsisten, tenggat, dan penanggung jawab.
- Temuan dapat dipindahkan antar kolom sesuai peran, dan kolom Selesai terkunci sampai retest menyatakan temuan tertutup.
- Empty state, loading state, dan error state tampil jelas saat papan kosong atau gagal dimuat.

## Sub-fitur: Tanggapan Pemilik

Pemilik aplikasi menanggapi temuan dan menuliskan rencana perbaikannya.

### Tujuan
Memberi App Owner ruang menanggapi temuan dan menuliskan rencana perbaikan agar tidak hilang di obrolan.

### Selesai bila
- App Owner dapat menulis tanggapan dan rencana perbaikan pada temuan milik aplikasinya, lalu menyimpannya.
- Tanggapan tampil di detail temuan beserta penulis dan waktu, dan riwayat tanggapan tidak tertimpa.
- Setelah menanggapi, App Owner dapat mengubah status temuan menjadi Dikerjakan atau Menunggu Uji Ulang bila perbaikan sudah dilakukan.
- App Owner tidak melihat tombol untuk menutup temuan atau menjalankan scan.

## Sub-fitur: Retest

Temuan yang diklaim sudah diperbaiki diuji ulang untuk memastikan benar-benar tertutup.

### Tujuan
Memastikan temuan yang diklaim sudah diperbaiki benar-benar tertutup melalui uji ulang oleh Tester.

### Selesai bila
- Tester dapat memulai retest dari temuan berstatus Menunggu Uji Ulang, dengan hasil Tertutup atau Masih Terbuka.
- Bila hasilnya Tertutup, temuan otomatis pindah ke Selesai; bila Masih Terbuka, temuan kembali ke Dikerjakan disertai catatan.
- Setiap retest tercatat dengan pelaku, waktu, hasil, dan catatan, serta terlihat di riwayat temuan.
- Retest mengikuti aturan izin yang sama: tidak berjalan tanpa persetujuan aktif dan di luar jendela waktu yang sah, serta tidak dapat dijalankan oleh App Owner.

## Sub-fitur: Pengingat Tenggat

Temuan yang mendekati batas waktu perbaikan ditandai agar tidak terlupakan.

### Tujuan
Menandai temuan yang mendekati atau melewati batas waktu perbaikan agar tidak terlewat.

### Selesai bila
- Setiap temuan dapat memiliki tanggal tenggat perbaikan yang tampil di kartu dan detail temuan.
- Temuan yang mendekati tenggat dan yang sudah lewat ditandai berbeda serta mudah terlihat di papan.
- Tanda tenggat ikut berubah otomatis seiring waktu berjalan tanpa perlu mengubah data secara manual.
- Ada daftar ringkas temuan mendesak berdasarkan tenggat agar tim dapat memprioritaskan perbaikan.

## Task

### 1. Bangun halaman papan kanban remediasi dengan data tiruan

### 2. Tambahkan pemindahan kartu antar tahap dengan guard peran

### 3. Buat panel detail temuan dengan tanggapan pemilik

### 4. Buat alur retest pada detail temuan

### 5. Buat penanda tenggat dan daftar temuan mendesak

### 6. Tampilkan riwayat perpindahan tahap di detail temuan

### 7. Buat skema dan migrasi tabel papan perbaikan

### 8. Buat service dan endpoint daftar temuan per tahap

### 9. Buat endpoint pindah tahap dengan aturan peran

### 10. Buat endpoint tanggapan pemilik aplikasi

### 11. Buat endpoint retest dengan transisi status otomatis

### 12. Buat perhitungan tanda tenggat dan endpoint temuan mendesak

### 13. Buat endpoint riwayat perpindahan tahap temuan
