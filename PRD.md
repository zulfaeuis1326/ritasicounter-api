# PRD — RitasiCounter V3 (Overhaul)

_Terakhir diupdate: 7 Nov 2026, setelah perapihan Kelola Akun, popup Atur Penempatan di Kelola Fleet, dan daftar HD per lokasi._

## 1. Latar Belakang
Aplikasi pencatat ritasi (jumlah rit/trip) hauler tambang per jam. Awalnya dibuat untuk kebutuhan pribadi, tapi ternyata masalah yang diselesaikan — pengawas tambang yang masih menarik data ritasi per orang secara manual — adalah masalah nyata di lapangan. Sedang dikembangkan untuk dipakai sungguhan di 1 lokasi tambang.

## 2. Stack Teknis
- **Framework**: Next.js (pages router), full-stack (frontend + API routes 1 project)
- **Database**: PostgreSQL (Railway)
- **Hosting**: Vercel, build otomatis dari GitHub (`github.com/zulfaeuis1326/ritasicounter-api`, branch `main`, Next.js 14.2.x). Sebelumnya di Railway (`app-ritasi-`).
- **Auth**: custom scrypt + HMAC session (src/lib/auth.js)
- **Export**: exceljs
- **Chart**: recharts

## 3. Role & Wewenang (4 tingkat)

| Role | Wewenang |
|---|---|
| **Superadmin** | Kontrol penuh. Akun admin pertama otomatis dipromosikan (migrasi sekali jalan). |
| **Admin** | Kelola unit, kelola akun (ubah role terbatas ke pengawas/operator, hapus akun, reset unit operator). Gak bisa bikin admin/superadmin baru, dan di UI tidak bisa mengelola akun admin/superadmin maupun akunnya sendiri. |
| **Pengawas** | Monitoring semua unit/operator real-time, export Excel & tutup shift (approval "stempel", bukan gerbang wajib), kelola fleet (assign HD ke PC + lokasi PIT). |
| **Operator** | Input ritasi, terkunci ke 1 unit per sesi (lepas otomatis saat logout), cuma lihat data/riwayat miliknya sendiri. |

## 4. Fitur Selesai

### Core (V2.0)
- Master unit (HD) & material (OB, COAL, SOIL, SOLU, MUD)
- Klik ritasi per unit + material, per jam (real-time clock), shift 1 (07:00–19:00) / shift 2 (19:00–07:00) auto-transisi
- Rekap per jam, export Excel (preview & final terpisah), tutup shift manual
- Revisi/hapus entri ritasi salah klik
- Login & registrasi mandiri, dashboard analitik (grafik bar/pie/line)

### V3 Overhaul
- Role 4 tingkat + isolasi data per akun operator
- Operator terkunci 1 unit/sesi, bisa daftarkan unit baru sendiri (saat registrasi ATAU saat setup login)
- Form registrasi: pilih jabatan (Operator/Pengawas — Admin tetap manual by superadmin)
- Halaman "Kelola Akun": lihat semua user, ubah role, hapus akun, reset unit operator
- Halaman monitoring pengawas: tabel rekap semua unit real-time + akses dashboard
- Toggle tema Dark ⟷ Bright (default: bright), disimpan per browser
- Redesign login & register: card modern, show/hide password, validasi 8 karakter
- Footer "designed by Najib.dev" di semua halaman
- **Fitur "Jam Ritasi" manual** — operator bisa pilih jam sebelumnya (dalam shift berjalan) buat nutup ritasi yang kelewat, karena gak boleh pegang HP saat unit jalan (safety), cuma boleh input pas berhenti. Sistem nolak kalau pilih jam yang belum kejadian.
- **Sistem Fleet & PIT (baru kelar)**:
  - Tabel `pits` (master lokasi: TIWA SELATAN, PIT FSP, KM 92, TIWA ABADI, BARA TABANG, RDC + bisa tambah lagi)
  - Tabel `fleets` (PC/Loader) dengan kolom `pit_id`; tabel `units` (HD) dengan kolom `fleet_id` & `pit_id`
  - **Data roster diimport dari foto** "Setting Man Power" (dibaca manual via image crop+zoom, dikonfirmasi user) — 42 PC + 124 HD, lewat endpoint sekali-jalan `/api/admin/import-roster` (tombol "Import Sekarang" di Kelola Akun, khusus superadmin)
  - **Endpoint dedupe** (`/api/admin/dedupe-units`) buat gabungin unit/PC yang namanya dobel (beda kapitalisasi/spasi) — tombol "Bersihkan Sekarang" di Kelola Akun
  - **Halaman "Kelola Fleet" (di-redesign total, beberapa iterasi)**: dari tabel panjang → search+dropdown → akhirnya jadi **Combobox modern kustom** (`src/components/Combobox.js`) — komponen shared, tap buka panel search+list (bukan dropdown/select bawaan browser). Dipakai di Kelola Fleet (pilih unit → assign PC & PIT) DAN di halaman utama (pilih Unit & pilih Jam Ritasi), gantiin `<select>` native yang jelek/kepanjangan di HP.
  - Filter "hanya tampilkan unit yang ada ritasinya" di tabel rekap (halaman utama & dashboard) — karena 124+42 unit bikin tabel kepanjangan kalau ditampilin semua, ada toggle "tampilkan semua" kalau perlu
- **Polling data dipercepat** — halaman utama refresh tiap 2.5 detik (dari 5 detik), dashboard tiap 6 detik (dari 15 detik), biar kerasa lebih real-time. (Catatan: ini masih polling, bukan push-based real-time/WebSocket — cukup buat skala 1 lokasi tambang saat ini.)
- **Paket migrasi server**: `schema.sql` (skema database final siap pakai) + `README.md` (instruksi setup lengkap) + `.env.example` + source code lengkap, disiapkan buat pindah hosting.

### Update 7 Nov 2026 (Kelola Akun & Kelola Fleet)
- **Kelola Akun (`/admin/operators`) ditulis ulang**:
  - Satu fungsi `callAction` untuk semua aksi (sebelumnya 8 handler copy-paste).
  - Tiap akun jadi kartu (avatar, badge role/status, unit). Aksi jarang dipakai (Ubah role, Reset password, Paksa logout, Reset unit, Hapus akun) masuk menu titik tiga; tombol yang pasti ditolak server tidak ditampilkan (`src/lib/akunPerms.js`).
  - `confirm()` / `prompt()` / `alert()` bawaan browser diganti modal sendiri (`src/components/akun/AkunModal.js`). Reset password punya tombol "Buat otomatis" dan show/hide.
  - Pencarian + filter (Semua / Menunggu / Operator / Pengawas / Admin) dengan jumlah, banner "N akun menunggu approval", skeleton loading, toast.
  - Motion CSS murni (`src/styles/akun.css`): kartu masuk bertahap, menu pop, modal slide-up, titik pending berdenyut, kartu geser keluar saat dihapus/ditolak. Mati otomatis kalau perangkat memakai `prefers-reduced-motion`.
  - Desktop (>=900px): lebar mengikuti halaman, kartu tersusun grid 2 kolom.
  - Superadmin kini bisa mengubah role akun operator juga (sebelumnya hanya admin/pengawas); admin biasa bisa mengubah antara operator dan pengawas.
- **Bug diperbaiki**: `ALL_ROLES` belum diekspor di `src/lib/roles.js` (membuat aksi `set_role` gagal 500 dan dropdown role error). Reset unit sekarang memakai `set_unit` dengan `unitId: null` (aksi `reset_unit` memang tidak ada di API).
- **Kelola Fleet, tab Penempatan HD**:
  - Panel pilih PC/lokasi yang muncul di dasar layar diganti bar ringkas "N HD dipilih" + tombol **Atur penempatan**, yang membuka popup rapi (daftar HD terpilih, pilihan PC, Lokasi, opsi "Ikuti lokasi milik PC"). Di HP muncul dari bawah, di desktop di tengah. Logika simpan (`saveAssign`) dan API tidak berubah.
  - Di desktop bar ringkas menjadi kotak melayang di tengah area konten (tidak lagi tertutup sidebar 252px).
  - Daftar HD (126 unit) dikelompokkan per lokasi (PIT), grup bisa dilipat, ada "Pilih grup", dan tiap HD berupa kotak kecil yang diketuk (bukan baris panjang). Badge "tanpa PC"/lokasi yang berulang dihapus; nama PC hanya tampil kalau HD sudah punya PC.
- **Struktur repo dirapikan**: folder lama di root (`pages/ lib/ components/ hooks/ styles/`) adalah salinan sebelum migrasi ke `src/`. Next.js memakai `pages/` root dan mengabaikan `src/pages`, sehingga edit di `src/` tidak berpengaruh. Salinannya dipindah ke `_legacy_root/` (tidak di-commit ke repo). `_legacy_root/pages/display.js` butuh paket `three` yang tidak ada di `package.json`, jadi tidak ikut build.
- Catatan: endpoint `/api/admin/import-roster` dan `/api/admin/dedupe-units` masih ada, tapi tombolnya sudah tidak ada di halaman Kelola Akun pada kode yang diunggah (deskripsi tombol di bagian Fleet & PIT di atas sudah usang).

## 5. Belum Dikerjakan / Pending

1. **Halaman utama publik (tanpa login)** — rencana besar yang sempat dibahas: pindahin login ke pojok kanan atas, halaman `/` jadi publik nampilin info ritasi per unit/fleet/PIT tanpa perlu login. **Belum mulai dikerjakan** (baru sampai tahap fondasi fleet+PIT).
2. **Approval shift oleh pengawas** — kolom DB udah ada (`shifts.review_status`, `reviewed_by`, `reviewed_at`), UI tombol approve eksplisit belum dibikin.
3. **Rekap per fleet** — tabel rekap masih flat per unit, belum dikelompokkan per fleet/PC.
4. **Redesign visual lanjutan** — Kelola Akun dan Kelola Fleet sudah modern. Sisanya masih gaya lama: `login.js`, `register.js`, `approval.js`, halaman monitor (keluhan 4 Nov 2026: tombol boros tempat, approval tidak terhubung ke server).
5. **Fitur akun baru** — admin membuat akun langsung (tanpa daftar mandiri); user mengganti password sendiri.
6. **Celah API `set_role`** — API belum mengecek target: admin biasa lewat panggilan langsung masih bisa menurunkan role admin lain jadi operator (di UI sudah ditutup). Perlu pengecekan di `src/pages/api/admin/operators.js`.
7. **Bersihkan `_legacy_root/`** — hapus setelah yakin tidak dipakai; halaman display 3D butuh `npm i three` kalau mau dihidupkan lagi.
8. **Uji jalan di perangkat** — perubahan 7 Nov baru dicek sintaks dan impor secara statis; tampilan dan gerakan di HP/desktop dikonfirmasi lewat screenshot user.

## 6. Kendala Teknis (Penting — sering muncul ulang)
- **Koneksi HP user sering lemot** (pernah ke level ~69 KB/d) — file besar (>15-20KB) rawan ke-upload setengah/truncated ke GitHub via "Add file → Upload files", bikin build gagal dengan error khas: `Unexpected eof` atau `Unterminated string constant`. Mitigasi: kirim file dipecah kecil-kecil, satu-satu (bukan bareng), user diminta cek jumlah baris cocok SEBELUM commit.
- **User beberapa kali bilang "sudah upload & deploy sukses" padahal ternyata belum** — build sukses cuma berarti syntax valid, BUKAN berarti isinya udah versi terbaru (bisa aja upload gagal diam-diam / ketimpa file lama). Cara verifikasi paling ampuh: minta user cari string unik yang cuma ada di versi baru (mis. `"Cari unit..."`) langsung di file GitHub via Ctrl+F.
- **Jangan pakai emoji di kode** — pernah bikin build gagal karena karakter emoji corrupt pas di-copy manual. Ikon pakai SVG inline sebagai gantinya.
- **Pesan user kadang kekirim dobel** (persis sama 2x berturut-turut) — kalau ini terjadi, cek dulu apa request itu udah pernah dikerjain sebelum ngerjain ulang dari nol.
- **Folder `pages/` di root menimpa `src/pages`** — kalau repo masih punya `pages/`, `lib/`, `components/`, `hooks/`, `styles/` di root, semua edit di `src/` tidak muncul di situs (gejala: tampilan lama padahal build sukses). Pastikan root repo hanya berisi `src/`, `public/`, dan file konfigurasi.
- **Patch parsial bikin build gagal** (`Module not found: Can't resolve '@/components/akun/AkunCard'`) — file yang mengimpor komponen/CSS baru ikut ter-upload, tapi file barunya tidak. Selalu kirim paket lengkap dengan daftar file, dan cek semua impor `@/...` mengarah ke file yang ada sebelum commit.
- **Verifikasi versi terbaru** lewat string unik di GitHub (Ctrl+F): `fl-modal` dan `fl-tile` di `src/pages/admin/fleet.js`, `AkunModal` di `src/pages/admin/operators.js`.
- **Sandbox kerja Claude bisa reset sewaktu-waktu** (kehilangan file lokal `/home/claude/...`), tapi progress tetap aman karena disimpan di memori + riwayat percakapan.

## 7. Environment Variables (Vercel: Project Settings → Environment Variables; dulu Railway)
- `DATABASE_URL` — connection string PostgreSQL
- `TZ_NAME` — Asia/Jakarta / Asia/Makassar / Asia/Jayapura
- `JWT_SECRET` — wajib diisi manual
- 
