# Checkpoint — RitasiCounter (7 Nov 2026)

Status: user menyatakan puas dengan hasil (tampilan HP bagus, perbaikan desktop dan daftar HD diterima).

## Selesai (urut pengerjaan)
1. **Kelola Akun** ditulis ulang (kartu, menu aksi, modal, cari+filter, motion). Bug `ALL_ROLES` diperbaiki.
   File: `src/pages/admin/operators.js`, `src/components/akun/AkunCard.js`, `AkunModal.js`,
   `src/lib/akunPerms.js`, `src/lib/roles.js`, `src/styles/akun.css`.
2. **Kelola Fleet: popup "Atur penempatan"** menggantikan panel di dasar layar.
   File: `src/pages/admin/fleet.js`, `src/styles/fleet-assign.css`, `src/pages/_app.js` (import CSS).
3. **Perbaikan**: aksi Reset unit memakai `set_unit` + `unitId: null` (aksi `reset_unit` tidak ada di API).
4. **Perbaikan desktop**: bar ringkas jadi kotak melayang di area konten; kartu akun grid 2 kolom.
5. **Daftar HD per lokasi**: grup bisa dilipat, "Pilih grup", HD berupa kotak kecil, label "tanpa PC" dihapus.
6. Folder lama di root dipindah ke `_legacy_root/` (jangan di-upload ke repo).
7. PRD.md diperbarui (bagian "Update 7 Nov 2026", pending, kendala teknis, hosting Vercel).

## Daftar file yang berubah/baru (semua di bawah `src/`)
- pages: `admin/operators.js`, `admin/fleet.js`, `_app.js`
- components: `akun/AkunCard.js`, `akun/AkunModal.js`
- lib: `akunPerms.js`, `roles.js`
- styles: `akun.css`, `fleet-assign.css`

## Cara verifikasi di repo (Ctrl+F di GitHub)
- `fl-modal` dan `fl-tile` di `src/pages/admin/fleet.js`
- `AkunModal` di `src/pages/admin/operators.js`
- Root repo hanya berisi: `src/`, `public/`, `package.json`, `package-lock.json`, `next.config.js`,
  `jsconfig.json`, `schema.sql`, `README.md`, `PRD.md`, `CHECKPOINT.md`. TIDAK ada `pages/`, `lib/`,
  `components/`, `hooks/`, `styles/`, `_legacy_root/`, `node_modules/`, `.env`.

## Berikutnya (belum dikerjakan)
- [ ] Rapikan `login.js` + `register.js` (gaya + motion yang sama)
- [ ] Halaman `approval.js` (approval shift) + tombol boros di halaman monitor
- [ ] Admin buat akun langsung; user ganti password sendiri
- [ ] Tutup celah API `set_role` (cek target untuk admin biasa)
- [ ] Putuskan nasib `_legacy_root/`
- [ ] 
