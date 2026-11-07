# Checkpoint — Kelola Akun (7 Nov 2026)

## Selesai
- [x] Folder lama di root (`pages/ lib/ components/ hooks/ styles/`) dipindah ke `_legacy_root/`
      (tidak dihapus). Penyebab: Next.js memakai `pages/` root dan mengabaikan `src/pages`.
      `_legacy_root/pages/display.js` butuh paket `three` yang tidak ada di package.json/lock.
- [x] Bug: `ALL_ROLES` belum diekspor di `src/lib/roles.js` (membuat `set_role` gagal 500 + dropdown role error).
- [x] `src/pages/admin/operators.js` ditulis ulang: satu `callAction`, kartu akun, menu aksi, modal
      pengganti confirm/prompt, cari + filter, banner pending, skeleton, toast.
- [x] Komponen baru: `src/components/akun/AkunCard.js`, `AkunModal.js`; `src/lib/akunPerms.js`.
- [x] Gaya + motion: `src/styles/akun.css` (diimpor di `_app.js`), mendukung `prefers-reduced-motion`.

## Belum / selanjutnya
- [ ] Jalankan `npm install && npm run dev`, uji /admin/operators (login sebagai superadmin & admin).
- [ ] Rapikan halaman `login.js` + `register.js` (pakai gaya motion yang sama).
- [ ] Halaman `approval.js` (approval shift) + tombol boros di monitor ritasi.
- [ ] Fitur akun baru: admin buat akun langsung (tanpa daftar), ganti password sendiri oleh user.
- [ ] Putuskan nasib `_legacy_root/` (hapus kalau sudah yakin; display 3D butuh `npm i three`).
