# Dashboard Command Center

Halaman utama yang memperlihatkan seluruh daftar tes keamanan, kondisinya, dan skor keamanan tiap aplikasi dalam satu layar.

## Spesifikasi

### Tujuan
Halaman utama ini ada agar user langsung melihat seluruh tes keamanan, kondisi, dan skor keamanan aplikasi dalam satu layar sebagai titik awal pekerjaan.
### Selesai bila
- Setelah login, user melihat daftar tes keamanan beserta status, aplikasi, dan penanggung jawab tanpa harus membuka menu lain.
- Ringkasan sebaran severity, rating A–F per aplikasi, dan progres scan yang sedang berjalan tampil di halaman yang sama.
- User dapat mencari dan menyaring daftar tes berdasarkan status, aplikasi, atau tingkat risiko.
- Halaman menampilkan empty state, loading state, dan error state yang jelas saat data kosong, sedang dimuat, atau gagal dimuat.
- Tampilan menggunakan gaya dark-first, warna severity konsisten, dan tanpa emoji atau gradien ungu.

## Sub-fitur: Daftar Tes

Semua tes keamanan tampil dalam satu daftar lengkap dengan status, aplikasi, dan penanggung jawabnya.

### Tujuan
Menampilkan semua tes keamanan dalam satu daftar agar user tahu status, aplikasi, dan penanggung jawabnya.
### Selesai bila
- Setiap baris daftar tes menampilkan status, nama aplikasi, dan penanggung jawab.
- Klik satu baris membuka workspace atau detail tes terkait.
- Daftar menampilkan kondisi kosong, loading, dan error dengan pesan yang jelas.

## Sub-fitur: Sebaran Severity

Grafik jumlah temuan per tingkat keparahan supaya user langsung tahu mana yang paling mendesak.

### Tujuan
Memperlihatkan jumlah temuan per tingkat keparahan agar user langsung tahu mana yang paling mendesak.
### Selesai bila
- Grafik menampilkan jumlah temuan untuk tingkat critical, high, medium, low, dan info.
- Warna tiap tingkat keparahan konsisten dengan halaman lain.
- Jika belum ada temuan, tampil empty state yang jelas, bukan grafik kosong yang membingungkan.

## Sub-fitur: Rating A–F

Setiap aplikasi diberi satu nilai huruf agar kondisi keamanannya mudah dibaca sekilas.

### Tujuan
Memberi satu nilai huruf per aplikasi agar kondisi keamanannya mudah dibaca sekilas.
### Selesai bila
- Setiap aplikasi menampilkan satu rating huruf A–F.
- Rating mudah dibedakan secara visual dan konsisten di dashboard.
- Jika rating belum tersedia, tampil penanda yang jelas, bukan nilai palsu.

## Sub-fitur: Progress Scan Live

Memantau tahap scan yang sedang berjalan secara langsung tanpa perlu menyegarkan halaman.

### Tujuan
Memantau tahap scan yang sedang berjalan secara langsung agar user tahu posisi dan kendala scan tanpa menyegarkan halaman.
### Selesai bila
- Scan yang sedang berjalan menampilkan tahap saat ini dan persentase progres.
- Perubahan progres muncul otomatis tanpa user menyegarkan halaman.
- Scan yang selesai, gagal, atau dihentikan menampilkan status akhir yang jelas.

## Sub-fitur: Pencarian & Filter

Menyaring daftar tes berdasarkan status, aplikasi, atau tingkat risiko yang dipilih.

### Tujuan
Menyaring daftar tes agar user cepat menemukan tes yang relevan berdasarkan kata kunci, status, aplikasi, atau risiko.
### Selesai bila
- User bisa mencari tes berdasarkan kata kunci yang terlihat di daftar.
- User bisa menyaring berdasarkan status, aplikasi, atau tingkat risiko.
- Filter yang aktif terlihat jelas, bisa direset, dan hasil kosong punya pesan yang jelas.

## Task

### 1. Bangun halaman dashboard command center tiruan

### 2. Buat komponen daftar tes tiruan

### 3. Buat panel sebaran severity tiruan

### 4. Buat kartu rating A-F tiruan

### 5. Buat progress scan live simulasi

### 6. Buat pencarian dan filter tiruan

### 7. Lengkapi state kosong loading error

### 8. Rapikan tema dark-first severity responsif

### 9. Buat service agregasi dashboard

### 10. Buat endpoint daftar tes dashboard

### 11. Buat endpoint sebaran severity

### 12. Buat endpoint rating aplikasi

### 13. Buat endpoint progress scan live

### 14. Buat validasi filter dan pagination

### 15. Buat penanganan error endpoint dashboard
