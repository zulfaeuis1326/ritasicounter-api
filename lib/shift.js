const { pool } = require("./db");
const { buildShiftLabel } = require("./time");

// Selalu ada maksimal SATU shift berstatus 'open'. Kalau belum ada, dibuat otomatis
// berdasarkan jam saat ini (bukan dipilih manual).
//
// Kalau shift yang lagi "open" ternyata sudah lewat batas periodenya (misal shift 1
// dibuka jam 08:00 tapi sekarang sudah jam 19:15 dan belum ditutup manual), shift itu
// otomatis ditutup dan langsung dibuka shift baru sesuai periode sekarang. Ini mencegah
// klik-klik malam nyasar tercatat ke shift siang yang lupa ditutup.
async function getOrCreateOpenShift() {
  const existing = await pool.query(
    `SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1`
  );

  const { shiftType: currentType, label: currentLabel } = buildShiftLabel();

  if (existing.rows.length > 0) {
    const openShift = existing.rows[0];
    const openedTooLong = await pool.query(
      `SELECT now() - opened_at > interval '13 hours' AS stale FROM shifts WHERE id = $1`,
      [openShift.id]
    );
    const isStale = openedTooLong.rows[0].stale;

    if (openShift.shift_type === currentType && !isStale) {
      return openShift;
    }
    // Sudah lewat batas periode (atau kebuka lebih dari 13 jam) — tutup otomatis shift lama, buka shift baru.
    await pool.query(
      `UPDATE shifts SET status = 'closed', closed_at = now() WHERE id = $1`,
      [openShift.id]
    );
  }

  const inserted = await pool.query(
    `INSERT INTO shifts (shift_type, label, status) VALUES ($1, $2, 'open') RETURNING *`,
    [currentType, currentLabel]
  );
  return inserted.rows[0];
}

module.exports = { getOrCreateOpenShift };

