const { Pool } = require("pg");

// Railway otomatis inject DATABASE_URL begitu plugin PostgreSQL ditambahkan.
// Koneksi internal Railway (host *.railway.internal) TIDAK butuh SSL — kalau dipaksa SSL,
// koneksi gagal total tanpa pesan error yang jelas di frontend. Hanya nyalakan SSL kalau
// connection string eksplisit minta (sslmode=require), misal saat pakai proxy publik.
const needsSSL = (process.env.DATABASE_URL || "").includes("sslmode=require");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSSL ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Postgres pool error:", err);
});

let schemaReady = false;

// Dipanggil di awal setiap API route. Idempotent — aman dipanggil berkali-kali.
async function ensureSchema() {
  if (schemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      shift_type SMALLINT NOT NULL,       -- 1 = siang (07-19), 2 = malam (19-07)
      label TEXT NOT NULL,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      closed_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'open' -- 'open' | 'closed'
    );

    CREATE TABLE IF NOT EXISTS ritasi_clicks (
      id SERIAL PRIMARY KEY,
      unit_id INTEGER NOT NULL REFERENCES units(id),
      shift_id INTEGER NOT NULL REFERENCES shifts(id),
      material TEXT NOT NULL,
      jam SMALLINT NOT NULL,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_clicks_shift ON ritasi_clicks(shift_id);
    CREATE INDEX IF NOT EXISTS idx_clicks_unit_shift ON ritasi_clicks(unit_id, shift_id);

    -- Migrasi: kalau tabel units dibuat versi lama (UNIQUE mentah di kolom name),
    -- hapus constraint itu — soalnya bikin nama unit yang sudah dihapus (nonaktif)
    -- tidak bisa dipakai ulang.
    ALTER TABLE units DROP CONSTRAINT IF EXISTS units_name_key;

    -- Nama unit hanya perlu unik di antara unit yang MASIH AKTIF.
    -- Unit yang sudah dihapus (nonaktif) tidak lagi menahan nama itu.
    CREATE UNIQUE INDEX IF NOT EXISTS units_name_active_key ON units(name) WHERE active = true;

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator', -- 'admin' | 'operator'
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Catat siapa yang input tiap klik ritasi. Nullable supaya data lama (sebelum ada
    -- sistem login) tidak error — cukup tampil sebagai "tanpa nama" di riwayat lama.
    ALTER TABLE ritasi_clicks ADD COLUMN IF NOT EXISTS operator_id INTEGER REFERENCES users(id);

    -- Operator dikunci ke 1 unit (dipilih sekali di awal, cuma admin yang bisa reset).
    -- NULL berarti belum pilih unit (operator baru) atau memang admin (tidak terkunci unit).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS unit_id INTEGER REFERENCES units(id);

    -- Fleet: PC/Loader sebagai "induk", beberapa unit HD di-assign ke 1 fleet.
    -- Pengelolaan assignment adalah wewenang pengawas.
    CREATE TABLE IF NOT EXISTS fleets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,          -- nama/nomor PC-Loader, misal "Ex2025"
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS fleets_name_active_key ON fleets(name) WHERE active = true;

    -- Tiap unit HD boleh di-assign ke 1 fleet (PC/Loader). NULL = belum di-assign.
    ALTER TABLE units ADD COLUMN IF NOT EXISTS fleet_id INTEGER REFERENCES fleets(id);

    -- Approval pengawas per shift: "stempel resmi", bukan gerbang wajib —
    -- data ritasi tetap masuk rekap terlepas dari status review ini.
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id);
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

    -- Supaya akun bisa dihapus (fitur hapus user) tanpa kebentur riwayat ritasi/approval-nya:
    -- kalau user dihapus, kolom penunjuknya dikosongkan (SET NULL), datanya sendiri tetap ada.
    ALTER TABLE ritasi_clicks DROP CONSTRAINT IF EXISTS ritasi_clicks_operator_id_fkey;
    ALTER TABLE ritasi_clicks ADD CONSTRAINT ritasi_clicks_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL;

    ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_reviewed_by_fkey;
    ALTER TABLE shifts ADD CONSTRAINT shifts_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

    -- Master lokasi PIT (dropdown, bukan teks bebas) — bisa nambah lokasi baru lewat UI nanti.
    CREATE TABLE IF NOT EXISTS pits (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS pits_name_active_key ON pits(name) WHERE active = true;

    -- Ganti pendekatan lokasi bebas teks (kolom lama, belum pernah dipakai) jadi referensi
    -- ke master pits di atas — dicatat per unit HD maupun per fleet (PC/Loader) masing-masing,
    -- karena di lapangan unit bisa dipindah-pindah PIT independen dari fleet-nya.
    ALTER TABLE units DROP COLUMN IF EXISTS lokasi;
    ALTER TABLE fleets DROP COLUMN IF EXISTS lokasi;
    ALTER TABLE units ADD COLUMN IF NOT EXISTS pit_id INTEGER REFERENCES pits(id);
    ALTER TABLE fleets ADD COLUMN IF NOT EXISTS pit_id INTEGER REFERENCES pits(id);
  `);

  // Seed daftar PIT awal — idempotent, aman dipanggil berkali-kali (ON CONFLICT DO NOTHING).
  await pool.query(`
    INSERT INTO pits (name) VALUES
      ('TIWA SELATAN'), ('PIT FSP'), ('KM 92'),
      ('TIWA ABADI'), ('BARA TABANG'), ('RDC')
    ON CONFLICT DO NOTHING;
  `);

  // Migrasi role 4-tingkat: akun admin PALING AWAL (created_at/id terkecil) otomatis
  // dipromosikan jadi superadmin — sekali saja, hanya kalau belum ada superadmin sama sekali.
  // Idempotent: aman dipanggil berkali-kali, tidak akan menimpa superadmin yang sudah ada.
  await pool.query(`
    UPDATE users SET role = 'superadmin'
    WHERE role = 'admin'
      AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'superadmin')
      AND id = (SELECT MIN(id) FROM users WHERE role = 'admin');
  `);

  schemaReady = true;
}

module.exports = { pool, ensureSchema };
