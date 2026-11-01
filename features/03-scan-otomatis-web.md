# Scan Otomatis Web

Menjalankan pemeriksaan keamanan otomatis pada aplikasi web dan memantau jalannya dari awal sampai selesai.

## Spesifikasi

### Tujuan
Menjalankan pemeriksaan keamanan otomatis pada aplikasi web yang sudah diizinkan dan memperlihatkan jalannya sampai hasil mentah siap ditriase.
### Selesai bila
- Scan hanya bisa diminta atau dijalankan bila ada ruang lingkup yang disetujui dan waktu masih dalam jendela tes; jika tidak, tombol nonaktif atau scan ditolak dengan alasan yang terlihat.
- Permintaan scan yang valid masuk antrean, menampilkan posisi dan status, serta progres per tahap dapat dipantau secara langsung.
- Scan yang sedang berjalan dapat dihentikan dengan aman dan status akhirnya terlihat jelas: selesai, dibatalkan, atau gagal.
- Hasil pemeriksaan tersimpan sebagai kandidat, bukan temuan resmi, sampai diverifikasi user.
- Aksi meminta, menolak, memulai, menghentikan, dan menyelesaikan scan tercatat di jejak audit; token dan kata sandi disamarkan.

## Sub-fitur: Antrean Pekerjaan

Scan yang diminta masuk antrean rapi dan user bisa melihat posisinya tanpa saling menunggu.

### Tujuan
Menampung permintaan scan yang sudah lolos izin ke dalam antrean yang rapi agar user tahu urutan dan status pekerjaannya.
### Selesai bila
- Permintaan scan yang valid tampil di antrean dengan posisi, status menunggu, aplikasi, dan peminta.
- Posisi antrean diperbarui otomatis saat job lain diambil atau selesai, tanpa perlu menyegarkan halaman.
- Bila tidak ada izin aktif atau waktu di luar jendela tes, scan tidak masuk antrean dan alasan penolakan ditampilkan.

## Sub-fitur: Hentikan Scan

Scan yang sedang berjalan bisa dihentikan kapan saja dengan aman bila sudah tidak diperlukan.

### Tujuan
Memberi user cara menghentikan scan yang sedang berjalan dengan aman saat sudah tidak diperlukan.
### Selesai bila
- Tombol Hentikan tersedia pada scan yang sedang berjalan dan meminta konfirmasi sebelum dijalankan.
- Setelah dikonfirmasi, status berubah menjadi dibatalkan, progres berhenti, dan tidak ada tahap baru yang dimulai.
- Aksi penghentian tercatat di jejak audit dengan pelaku, waktu, dan job terkait.

## Sub-fitur: Progress per Tahap

Tiap tahap pemeriksaan—termasuk penjelajahan halaman secara terbatas—ditampilkan statusnya satu per satu.

### Tujuan
Memperlihatkan jalannya scan tahap demi tahap agar user tahu bagian mana yang sedang dikerjakan, selesai, atau gagal.
### Selesai bila
- Halaman detail scan menampilkan daftar tahap pemeriksaan, termasuk penjelajahan halaman terbatas, header, cookie, dan informasi terbuka, dengan status belum berjalan, berjalan, selesai, atau gagal.
- Tahap yang sedang berjalan dan persentase progres berubah secara langsung tanpa menyegarkan halaman.
- Bila satu tahap gagal, tahap itu ditandai dan pesan error yang bisa dibaca user ditampilkan.

## Sub-fitur: Cakupan Pemeriksaan

Pemeriksaan menyasar header, cookie, dan informasi yang tidak sengaja terbuka, dengan pengaman agar tidak menyerang ke luar target.

### Tujuan
Memastikan pemeriksaan menyasar hal-hal yang relevan pada aplikasi web tanpa keluar dari target yang diizinkan.
### Selesai bila
- Hasil scan mencakup pemeriksaan header, cookie, dan informasi yang tidak sengaja terbuka.
- Penjelajahan halaman dibatasi pada target dan cakupan yang disetujui; permintaan ke alamat di luar target ditolak atau dihentikan.
- Tidak ada permintaan ke luar target yang lolos, dan setiap upaya keluar target tercatat untuk diperiksa.

## Sub-fitur: Kandidat Temuan

Hasil mentah scan dikumpulkan sebagai kandidat dan belum dianggap temuan sampai diperiksa.

### Tujuan
Menyimpan hasil mentah scan sebagai kandidat agar belum dianggap temuan sampai diperiksa user.
### Selesai bila
- Setiap hasil mentah scan tersimpan sebagai kandidat dengan judul, kategori, bukti mentah, dan status baru.
- Kandidat tidak dihitung sebagai temuan resmi dan tidak mengubah rating aplikasi sampai diverifikasi user.
- Hasil serupa dari scan berulang digabung agar tidak muncul sebagai kandidat ganda.

## Task

### 1. Buat halaman utama Scan Otomatis

### 2. Tampilkan antrean scan dengan data tiruan

### 3. Buat detail progres tahap scan tiruan

### 4. Buat dialog konfirmasi hentikan scan

### 5. Tampilkan ringkasan cakupan pemeriksaan tiruan

### 6. Buat daftar kandidat temuan tiruan

### 7. Buat penanda status scan dibatalkan dan gagal

### 8. Lengkapi state kosong muat dan error

### 9. Buat skema job scan dan tahap

### 10. Buat skema kandidat dan audit scan

### 11. Implementasikan validasi izin dan jendela tes

### 12. Buat API permintaan dan antrean scan

### 13. Buat worker antrean perbarui posisi otomatis

### 14. Buat API hentikan scan dengan aman

### 15. Buat API progres tahap dan streaming live

### 16. Jalankan pemeriksaan header cookie dan info disclosure

### 17. Terapkan pembatas target dan anti-SSRF

### 18. Normalisasi dan gabungkan kandidat temuan

### 19. Simpan kandidat terpisah dari temuan resmi

### 20. Catat audit aksi scan dengan masking
