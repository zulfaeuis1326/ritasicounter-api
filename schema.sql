-- ============================================================
-- RitasiCounter — Schema Database (PostgreSQL)
-- ============================================================
-- Ini adalah skema FINAL (bukan riwayat migrasi bertahap).
-- Jalankan file ini sekali di database PostgreSQL yang baru & kosong
-- untuk menyiapkan semua tabel yang dibutuhkan aplikasi.
--
-- Catatan: aplikasi (lib/db.js -> ensureSchema()) juga otomatis
-- menjalankan migrasi idempotent setiap kali API dipanggil, jadi
-- app tetap akan jalan walau file ini belum dijalankan manual.
-- Tapi menjalankan ini duluan lebih cepat & bikin data PIT awal
-- langsung terisi.
-- ============================================================

-- ===== Master lokasi PIT (dropdown, bukan teks bebas) =====
CREATE TABLE IF NOT EXISTS pits (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pits_name_active_key ON pits(name) WHERE active = true;

-- ===== Fleet: PC/Loader sebagai "induk" =====
CREATE TABLE IF NOT EXISTS fleets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  pit_id INTEGER REFERENCES pits(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fleets_name_active_key ON fleets(name) WHERE active = true;

-- ===== Unit hauler (HD) =====
CREATE TABLE IF NOT EXISTS units (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  fleet_id INTEGER REFERENCES fleets(id),
  pit_id INTEGER REFERENCES pits(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS units_name_active_key ON units(name) WHERE active = true;

-- ===== User / akun login =====
-- role: 'superadmin' | 'admin' | 'pengawas' | 'operator'
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  unit_id INTEGER REFERENCES units(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Shift kerja =====
-- shift_type: 1 = siang (07:00-19:00), 2 = malam (19:00-07:00)
-- status: 'open' | 'closed'
-- review_status: 'pending' | 'approved' (approval pengawas, "stempel" bukan gerbang wajib)
CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  shift_type SMALLINT NOT NULL,
  label TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);

-- ===== Klik ritasi (data inti aplikasi) =====
CREATE TABLE IF NOT EXISTS ritasi_clicks (
  id SERIAL PRIMARY KEY,
  unit_id INTEGER NOT NULL REFERENCES units(id),
  shift_id INTEGER NOT NULL REFERENCES shifts(id),
  material TEXT NOT NULL,
  jam SMALLINT NOT NULL,
  operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clicks_shift ON ritasi_clicks(shift_id);
CREATE INDEX IF NOT EXISTS idx_clicks_unit_shift ON ritasi_clicks(unit_id, shift_id);

-- ===== Seed data PIT awal =====
INSERT INTO pits (name) VALUES
  ('TIWA SELATAN'), ('PIT FSP'), ('KM 92'),
  ('TIWA ABADI'), ('BARA TABANG'), ('RDC')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Selesai. Akun pertama yang daftar lewat halaman /register akan
-- otomatis jadi 'superadmin' (logic ini ada di kode aplikasi,
-- bukan di database).
-- ============================================================
