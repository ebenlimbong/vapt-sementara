# Uji Akses API

Menguji apakah hak akses antar peran pada REST API sudah benar, misalnya apakah data pengguna lain bisa diakses.

## Spesifikasi

### Tujuan
Memastikan hak akses antar peran pada REST API sudah benar, dengan menguji apakah satu peran bisa melihat atau melakukan hal yang seharusnya bukan haknya.

### Selesai bila
- User dapat memuat definisi OpenAPI 3.x untuk sebuah aplikasi API, lalu endpoint hasilnya tampil sebagai bahan pengujian.
- Setiap endpoint terlihat lengkap dengan metode dan parameternya, serta ditandai jelas mana yang masuk cakupan uji.
- Akun uji per peran tersedia dan kredensialnya tidak pernah tampil mentah di layar maupun laporan.
- User dapat menetapkan ekspektasi akses (boleh/ditolak) per peran per endpoint, lalu melihat hasil nyata beserta kesimpulan sesuai atau menyimpang.
- Akses yang menyimpang muncul sebagai kandidat (bukan temuan resmi) dengan data sensitif tersamarkan, dan seluruh aksi tercatat di jejak audit.

## Sub-fitur: Impor OpenAPI

Definisi API dari berkas OpenAPI 3.x dimuat untuk dipetakan, dan rujukan ke luar cakupan otomatis ditolak.

### Tujuan
Memuat definisi API dari berkas OpenAPI 3.x agar endpoint-nya bisa dipetakan menjadi bahan pengujian.

### Selesai bila
- Berkas OpenAPI 3.x dapat diunggah untuk sebuah aplikasi API, dan setelah selesai user melihat ringkasan hasil impor (nama berkas, waktu impor, jumlah endpoint).
- Rujukan `$ref` ke luar cakupan otomatis ditolak, dan daftar rujukan yang ditolak ditampilkan ke user beserta alasannya.
- Berkas yang tidak valid atau versinya tidak didukung ditolak dengan pesan error yang jelas; impor berhasil maupun gagal tercatat di jejak audit.

## Sub-fitur: Inventaris Endpoint

Semua endpoint tampil lengkap dengan metode dan parameternya sebagai bahan pengujian.

### Tujuan
Menampilkan seluruh endpoint hasil impor agar user tahu persis apa saja yang akan diuji.

### Selesai bila
- Semua endpoint tampil dalam satu daftar dengan metode (GET/POST/PUT/DELETE) dan path-nya, memakai tampilan monospace untuk data teknis.
- Tiap endpoint dapat dibuka untuk melihat parameternya (query, path, body) dan status masuk cakupan atau tidak.
- Daftar dapat dicari/disaring, dan memiliki empty state (mis. "Belum ada endpoint — impor OpenAPI dulu"), loading state, serta error state yang jelas.

## Sub-fitur: Akun Uji per Role

Menyiapkan akun percobaan untuk tiap peran agar perilaku akses bisa dibandingkan.

### Tujuan
Menyiapkan akun percobaan untuk tiap peran agar perilaku akses antar peran bisa dibandingkan saat pengujian.

### Selesai bila
- User dapat menambah akun uji dengan label peran pada sebuah aplikasi API, dan daftar akun uji menampilkan label peran beserta status ketersediaannya.
- Kredensial akun uji tersimpan aman dan selalu tampil tersamarkan — tidak pernah terlihat mentah di layar, log, maupun laporan.
- Penambahan, perubahan, dan penghapusan akun uji tercatat di jejak audit, dengan empty state dan error state yang jelas.

## Sub-fitur: Skenario Ekspektasi Akses

Menentukan siapa seharusnya boleh mengakses apa, lalu hasil nyatanya dibandingkan dengan harapan itu.

### Tujuan
Menentukan siapa seharusnya boleh mengakses apa, lalu membandingkan harapan itu dengan hasil nyata saat pengujian berjalan.

### Selesai bila
- User dapat membuat skenario per endpoint: memilih peran dan menetapkan ekspektasi akses "boleh" atau "ditolak".
- Setelah pengujian berjalan, tiap skenario menampilkan hasil nyata dan kesimpulan "sesuai" atau "menyimpang" dengan warna status yang konsisten di semua halaman.
- Skenario yang menyimpang dapat diteruskan menjadi kandidat temuan (bukan temuan resmi), dengan token dan kata sandi tersamarkan pada data yang ditampilkan.

## Task

### 1. Bangun halaman impor OpenAPI data tiruan

### 2. Buat panel ringkasan hasil impor

### 3. Buat tabel rujukan $ref ditolak

### 4. Buat validasi unggah dan state error

### 5. Buat skema migrasi impor OpenAPI

### 6. Buat service parser OpenAPI 3.x

### 7. Tolak $ref eksternal dengan alasan

### 8. Buat endpoint unggah proses impor

### 9. Buat endpoint ringkasan detail impor

### 10. Buat endpoint inventaris hasil impor

### 11. Catat hasil impor ke audit log

### 12. Bangun halaman utama Uji Akses API

### 13. Buat panel impor OpenAPI dengan mock

### 14. Buat halaman inventaris endpoint dengan filter

### 15. Buat halaman akun uji per role

### 16. Buat halaman skenario ekspektasi akses

### 17. Buat skema DB dan migrasi uji akses

### 18. Implementasikan service impor OpenAPI 3.x

### 19. Buat API inventaris endpoint dan detail

### 20. Buat API CRUD akun uji terenkripsi

### 21. Buat API skenario ekspektasi akses

### 22. Implementasikan runner uji akses per skenario

### 23. Buat endpoint promosi kandidat temuan
