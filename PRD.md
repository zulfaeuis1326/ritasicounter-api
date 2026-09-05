# PRD — RitasiCounter V3 (Overhaul)

_Terakhir diupdate: sesi berjalan, setelah redesign Kelola Fleet & Combobox modern._

## 1. Latar Belakang
Aplikasi pencatat ritasi (jumlah rit/trip) hauler tambang per jam. Awalnya dibuat untuk kebutuhan pribadi, tapi ternyata masalah yang diselesaikan — pengawas tambang yang masih menarik data ritasi per orang secara manual — adalah masalah nyata di lapangan. Sedang dikembangkan untuk dipakai sungguhan di 1 lokasi tambang.

## 2. Stack Teknis
- **Framework**: Next.js (pages router), full-stack (frontend + API routes 1 project)
- **Database**: PostgreSQL (Railway)
- **Hosting**: Railway, auto-deploy dari GitHub (`github.com/zulfaeuis1326/app-ritasi-`)
- **Auth**: custom scrypt + HMAC session (lib/auth.js)
- **Export**: exceljs
- **Chart**: recharts

## 3. Role & Wewenang (4 tingkat)

| Role | Wewenang |
|---|---|
| **Superadmin** | Kontrol penuh. Akun admin pertama otomatis dipromosikan (migrasi sekali jalan). |
| **Admin** | Kelola unit, kelola akun (ubah role terbatas ke pengawas/operator, hapus akun, reset unit operator). Gak bisa bikin admin/superadmin baru. |
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
  - **Halaman "Kelola Fleet" (di-redesign total, beberapa iterasi)**: dari tabel panjang → search+dropdown → akhirnya jadi **Combobox modern kustom** (`components/Combobox.js`) — komponen shared, tap buka panel search+list (bukan dropdown/select bawaan browser). Dipakai di Kelola Fleet (pilih unit → assign PC & PIT) DAN di halaman utama (pilih Unit & pilih Jam Ritasi), gantiin `<select>` native yang jelek/kepanjangan di HP.
  - Filter "hanya tampilkan unit yang ada ritasinya" di tabel rekap (halaman utama & dashboard) — karena 124+42 unit bikin tabel kepanjangan kalau ditampilin semua, ada toggle "tampilkan semua" kalau perlu
- **Polling data dipercepat** — halaman utama refresh tiap 2.5 detik (dari 5 detik), dashboard tiap 6 detik (dari 15 detik), biar kerasa lebih real-time. (Catatan: ini masih polling, bukan push-based real-time/WebSocket — cukup buat skala 1 lokasi tambang saat ini.)
- **Paket migrasi server**: `schema.sql` (skema database final siap pakai) + `README.md` (instruksi setup lengkap) + `.env.example` + source code lengkap, disiapkan buat pindah hosting.

## 5. Belum Dikerjakan / Pending

1. **Halaman utama publik (tanpa login)** — rencana besar yang sempat dibahas: pindahin login ke pojok kanan atas, halaman `/` jadi publik nampilin info ritasi per unit/fleet/PIT tanpa perlu login. **Belum mulai dikerjakan** (baru sampai tahap fondasi fleet+PIT).
2. **Approval shift oleh pengawas** — kolom DB udah ada (`shifts.review_status`, `reviewed_by`, `reviewed_at`), UI tombol approve eksplisit belum dibikin.
3. **Rekap per fleet** — tabel rekap masih flat per unit, belum dikelompokkan per fleet/PC.
4. **Redesign visual lanjutan** — Combobox & tema udah modern, tapi form-form lain (mis. halaman Kelola Akun) masih gaya lama, bisa terus dirapikan.

## 6. Kendala Teknis (Penting — sering muncul ulang)
- **Koneksi HP user sering lemot** (pernah ke level ~69 KB/d) — file besar (>15-20KB) rawan ke-upload setengah/truncated ke GitHub via "Add file → Upload files", bikin build gagal dengan error khas: `Unexpected eof` atau `Unterminated string constant`. Mitigasi: kirim file dipecah kecil-kecil, satu-satu (bukan bareng), user diminta cek jumlah baris cocok SEBELUM commit.
- **User beberapa kali bilang "sudah upload & deploy sukses" padahal ternyata belum** — build sukses cuma berarti syntax valid, BUKAN berarti isinya udah versi terbaru (bisa aja upload gagal diam-diam / ketimpa file lama). Cara verifikasi paling ampuh: minta user cari string unik yang cuma ada di versi baru (mis. `"Cari unit..."`) langsung di file GitHub via Ctrl+F.
- **Jangan pakai emoji di kode** — pernah bikin build gagal karena karakter emoji corrupt pas di-copy manual. Ikon pakai SVG inline sebagai gantinya.
- **Pesan user kadang kekirim dobel** (persis sama 2x berturut-turut) — kalau ini terjadi, cek dulu apa request itu udah pernah dikerjain sebelum ngerjain ulang dari nol.
- **Sandbox kerja Claude bisa reset sewaktu-waktu** (kehilangan file lokal `/home/claude/...`), tapi progress tetap aman karena disimpan di memori + riwayat percakapan.

## 7. Environment Variables (Railway)
- `DATABASE_URL` — otomatis dari Railway Postgres plugin
- `TZ_NAME` — Asia/Jakarta / Asia/Makassar / Asia/Jayapura
- `JWT_SECRET` — wajib diisi manual
