const { pool } = require("./db");
const { MATERIALS } = require("./materials");

// Urutan jam standar untuk tiap tipe shift, dipakai sebagai kolom tabel.
// Shift 1: mulai 07:00 -> kolom jam 7..18. Shift 2 (malam): mulai 19:00 -> kolom 19..23, 0..6.
function baseHours(shiftType) {
  const start = shiftType === 1 ? 7 : 19;
  return Array.from({ length: 12 }, (_, i) => (start + i) % 24);
}

// Kalau shift belum ditutup pas jam sudah lewat dari rentang normal (12 jam),
// klik-klik berikutnya tetap tersimpan dengan jam yang benar, tapi butuh kolom
// tambahan supaya kelihatan di tabel — bukan "hilang"/"salah kolom".
// extraJams diurutkan tetap kronologis mengikuti kelanjutan shift (bukan urutan 0-23 biasa).
function hourSequence(shiftType, extraJams = []) {
  const base = baseHours(shiftType);
  const start = shiftType === 1 ? 7 : 19;
  const relIndex = (h) => (h - start + 24) % 24;

  const baseSet = new Set(base);
  const extra = [...new Set(extraJams)]
    .filter((h) => !baseSet.has(h))
    .sort((a, b) => relIndex(a) - relIndex(b));

  return [...base, ...extra];
}

// Ambil rekap lengkap satu shift: per unit x per jam (dengan rincian material),
// plus rincian total material per unit, plus grand total.
// onlyUnitId (opsional): rekap cuma mencakup 1 unit itu saja.
// onlyOperatorId (opsional): rekap cuma mencakup klik yang diinput operator itu sendiri —
// dipakai supaya akun operator baru/beda selalu bersih, tidak kecampur riwayat operator lain
// walau kebetulan pegang unit yang sama.
async function buildRecap(shiftId, onlyUnitId = null, onlyOperatorId = null) {
  const shiftRes = await pool.query(`SELECT * FROM shifts WHERE id = $1`, [shiftId]);
  if (shiftRes.rows.length === 0) return null;
  const shift = shiftRes.rows[0];

  // Tampilkan unit yang masih aktif SEKARANG, ditambah unit yang sudah dihapus tapi
  // punya data ritasi di shift ini — supaya export/rekap shift lama tetap lengkap
  // walau unitnya belakangan dihapus dari daftar aktif.
  const unitsRes = await pool.query(
    `SELECT DISTINCT u.*, f.name AS fleet_name, p.name AS pit_name
     FROM units u
     LEFT JOIN fleets f ON f.id = u.fleet_id
     LEFT JOIN pits p ON p.id = u.pit_id
     WHERE (u.active = true OR u.id IN (SELECT DISTINCT unit_id FROM ritasi_clicks WHERE shift_id = $1))
       AND ($2::int IS NULL OR u.id = $2)
     ORDER BY u.name`,
    [shiftId, onlyUnitId]
  );
  const clicksRes = await pool.query(
    `SELECT unit_id, jam, material, COUNT(*)::int AS jumlah
     FROM ritasi_clicks
     WHERE shift_id = $1
       AND ($2::int IS NULL OR unit_id = $2)
       AND ($3::int IS NULL OR operator_id = $3)
     GROUP BY unit_id, jam, material`,
    [shiftId, onlyUnitId, onlyOperatorId]
  );

  const actualJams = [...new Set(clicksRes.rows.map((r) => r.jam))];
  const hours = hourSequence(shift.shift_type, actualJams);

  // index: unitId -> jam -> material -> jumlah
  const index = {};
  for (const row of clicksRes.rows) {
    if (!index[row.unit_id]) index[row.unit_id] = {};
    if (!index[row.unit_id][row.jam]) index[row.unit_id][row.jam] = {};
    index[row.unit_id][row.jam][row.material] = row.jumlah;
  }

  const units = unitsRes.rows.map((u) => {
    const hourly = hours.map((jam) => {
      const materialsAtHour = index[u.id]?.[jam] || {};
      const total = Object.values(materialsAtHour).reduce((a, b) => a + b, 0);
      return { jam, total, materials: materialsAtHour };
    });

    const materialTotals = Object.fromEntries(MATERIALS.map((m) => [m, 0]));
    let unitTotal = 0;
    for (const h of hourly) {
      for (const [mat, jumlah] of Object.entries(h.materials)) {
        materialTotals[mat] = (materialTotals[mat] || 0) + jumlah;
        unitTotal += jumlah;
      }
    }

    return {
      id: u.id,
      name: u.name,
      fleet_id: u.fleet_id,
      fleet_name: u.fleet_name,
      pit_id: u.pit_id,
      pit_name: u.pit_name,
      hourly,
      materialTotals,
      total: unitTotal,
    };
  });

  const grandTotal = units.reduce((a, u) => a + u.total, 0);
  const grandMaterialTotals = Object.fromEntries(MATERIALS.map((m) => [m, 0]));
  for (const u of units) {
    for (const m of MATERIALS) grandMaterialTotals[m] += u.materialTotals[m];
  }
  const grandHourlyTotals = hours.map((jam, i) =>
    units.reduce((a, u) => a + u.hourly[i].total, 0)
  );

  return { shift, hours, units, grandTotal, grandMaterialTotals, grandHourlyTotals };
}

// Posisi relatif suatu jam terhadap awal shift (dipakai buat urutan kronologis & validasi).
function relativeIndex(shiftType, hour) {
  const start = shiftType === 1 ? 7 : 19;
  return (hour - start + 24) % 24;
}

// Cek apakah "jam" yang dipilih manual masih masuk akal dalam shift berjalan —
// tidak boleh memilih jam yang secara kronologis belum terjadi (di depan currentHour).
// Dipakai untuk fitur "input ritasi buat jam yang kelewat" (operator gak boleh pegang HP
// saat unit jalan, baru bisa isi pas berhenti — kadang telat 1-2 jam).
function isHourWithinShift(shiftType, hour, currentHour) {
  return relativeIndex(shiftType, hour) <= relativeIndex(shiftType, currentHour);
}

module.exports = { buildRecap, hourSequence, relativeIndex, isHourWithinShift };
