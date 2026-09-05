# RitasiCounter

Aplikasi pencatat ritasi (jumlah rit/trip) hauler tambang per jam — real-time, berbasis role, dengan sistem fleet & lokasi PIT.

## Tech Stack

- **Framework**: Next.js 14 (pages router) — frontend & backend API jadi satu project
- **Database**: PostgreSQL
- **Auth**: custom scrypt + HMAC session (tanpa library eksternal, lihat `lib/auth.js`)
- **Export laporan**: exceljs (format Excel)
- **Grafik**: recharts

## Struktur Folder

```
components/       -> komponen React yang dipakai berulang (Combobox, ThemeToggle)
lib/               -> logic backend (db, auth, shift, recap, roles, dll)
pages/             -> halaman + API routes (Next.js pages router)
  admin/           -> halaman khusus admin/pengawas/superadmin
  api/             -> semua endpoint backend
styles/            -> globals.css (satu file CSS untuk seluruh app)
public/            -> aset statis (taruh logo.png kamu di sini)
schema.sql         -> skema database final, buat setup cepat di server baru
```

## Setup di Server Baru

### 1. Siapkan PostgreSQL
Buat database PostgreSQL baru (Railway, Supabase, Neon, VPS sendiri — bebas). Ambil connection string-nya.

### 2. Jalankan schema.sql (opsional tapi disarankan)
```bash
psql "postgresql://user:pass@host:5432/dbname" -f schema.sql
```
Kalau dilewatin, aplikasi tetap otomatis bikin semua tabel yang dibutuhkan saat pertama kali dijalankan (lihat `lib/db.js` -> `ensureSchema()`). Tapi jalanin manual lebih cepat & langsung ngisi data PIT awal.

### 3. Environment Variables
Copy `.env.example` jadi `.env` (untuk dev lokal) atau set langsung di platform hosting kamu:

| Variable | Wajib? | Keterangan |
|---|---|---|
| `DATABASE_URL` | Ya | Connection string PostgreSQL |
| `TZ_NAME` | Ya | `Asia/Jakarta` / `Asia/Makassar` / `Asia/Jayapura` — dipakai buat hitung jam shift dengan benar |
| `JWT_SECRET` | Ya | String acak & rahasia, dipakai buat sign session login. **Jangan pakai nilai default**, ganti sendiri |

### 4. Install & Jalankan
```bash
npm install
npm run build
npm start
```
Untuk development:
```bash
npm run dev
```

### 5. Logo
Taruh file `logo.png` kamu di folder `public/` (dipakai di halaman login, register, dan header aplikasi). Kalau tidak ada, aplikasi tetap jalan normal — bagian logo cuma disembunyikan otomatis.

### 6. Akun Pertama
Akun **pertama** yang mendaftar lewat halaman `/register` otomatis jadi **superadmin**. Setelah itu, daftar akun lain akan default jadi **operator** atau **pengawas** (dipilih sendiri di form daftar) — role **admin** hanya bisa diberikan manual oleh superadmin lewat halaman "Kelola Akun".

## Role & Wewenang

| Role | Wewenang |
|---|---|
| **Superadmin** | Kontrol penuh sistem |
| **Admin** | Kelola unit & akun (kecuali bikin admin/superadmin baru) |
| **Pengawas** | Monitoring semua unit real-time, export & tutup shift, kelola fleet (assign unit ke PC + lokasi PIT) |
| **Operator** | Input ritasi, terkunci ke 1 unit per sesi login |

## Fitur Utama

- Input ritasi per unit + material, per jam, dengan opsi **pilih jam manual** (buat nutup ritasi yang kelewat karena operator tidak boleh pegang HP saat unit berjalan)
- Rekap real-time per jam per unit, per shift (siang 07:00–19:00 / malam 19:00–07:00, auto-transisi)
- Export Excel (preview tanpa kunci shift, atau final saat tutup shift)
- Sistem **Fleet**: PC/Loader sebagai induk, unit HD di-assign ke situ; plus lokasi **PIT** (master data, bisa nambah lokasi baru)
- Dashboard analitik (grafik produksi harian/per-shift, per unit)
- Tema terang/gelap (toggle, tersimpan di browser)
- Data refresh otomatis tiap beberapa detik (polling) — lihat bagian "Real-Time" di bawah

## Soal "Real-Time"

Data di-refresh otomatis via **polling**:
- Halaman utama (rekap & riwayat): tiap **2.5 detik**
- Dashboard analitik: tiap **6 detik**

Ini BUKAN push-based real-time (WebSocket/SSE) — kalau butuh update yang benar-benar instan tanpa jeda sama sekali (misal buat >20 pengguna aktif bersamaan), itu perlu perubahan arsitektur lebih besar (WebSocket server terpisah atau layanan seperti Pusher/Ably). Untuk skala pemakaian saat ini (1 lokasi tambang), polling beberapa detik sudah cukup terasa real-time tanpa kompleksitas tambahan.

## Kendala Teknis yang Pernah Ditemui (dan solusinya)

- **Upload manual file besar (>15-20KB) via GitHub web di koneksi lambat sering ke-corrupt/terpotong**, menyebabkan error build `Unexpected eof` atau `Unterminated string constant`. Solusi: upload file satu-satu, cek jumlah baris/ukuran file cocok sebelum commit, atau pakai `git push` langsung dari komputer/laptop kalau memungkinkan (jauh lebih aman daripada upload manual dari HP).
- **Jangan taruh emoji langsung di kode** — pernah menyebabkan build gagal karena karakter emoji corrupt saat proses copy-paste manual. Ikon di aplikasi ini semua pakai SVG inline sebagai gantinya.
- Timezone dihitung manual (offset UTC tetap per `TZ_NAME`), bukan pakai `Intl`/timezone database — karena beberapa platform hosting punya ICU (data timezone) yang terbatas dan menyebabkan crash `Invalid time zone`.

## Belum Dikerjakan (Rencana Selanjutnya)

1. Halaman utama publik (bisa dilihat tanpa login) — rencana besar, belum mulai
2. Tombol approve eksplisit buat pengawas (kolom database-nya sudah ada: `shifts.review_status`)
3. Rekap dikelompokkan per fleet (sekarang masih flat per unit)

---
_designed by Najib.dev_
