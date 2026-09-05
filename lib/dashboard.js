const { pool } = require("./db");
const { OFFSET_HOURS } = require("./time");
const { MATERIALS } = require("./materials");

// Susun baris-baris mentah (per unit x jam x material, dikelompokkan per "bucket"
// — bucket = shift atau tanggal lokal, tergantung mode) menjadi bentuk siap-grafik.
function assembleStats(rows, bucketLabelOf) {
  const bucketOrder = []; // urutan bucket kronologis
  const bucketTotals = {}; // bucketKey -> total
  const unitTotals = {}; // unitName -> total
  const materialTotals = Object.fromEntries(MATERIALS.map((m) => [m, 0]));
  const hourlyTotals = {}; // jam (0-23) -> total

  for (const row of rows) {
    const bucketKey = String(row.bucket);
    if (!(bucketKey in bucketTotals)) {
      bucketTotals[bucketKey] = 0;
      bucketOrder.push(bucketKey);
    }
    bucketTotals[bucketKey] += row.jumlah;

    unitTotals[row.unit_name] = (unitTotals[row.unit_name] || 0) + row.jumlah;
    materialTotals[row.material] = (materialTotals[row.material] || 0) + row.jumlah;
    hourlyTotals[row.jam] = (hourlyTotals[row.jam] || 0) + row.jumlah;
  }

  const bucketSeries = bucketOrder.map((key) => ({
    label: bucketLabelOf(key),
    total: bucketTotals[key],
  }));

  const unitSeries = Object.entries(unitTotals)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  const materialSeries = MATERIALS.map((m) => ({ name: m, total: materialTotals[m] || 0 }));

  const hourlySeries = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    total: hourlyTotals[h] || 0,
  }));

  const grandTotal = unitSeries.reduce((a, u) => a + u.total, 0);

  return { bucketSeries, unitSeries, materialSeries, hourlySeries, grandTotal };
}

// Rekap N shift terakhir (apapun statusnya), dikelompokkan per shift.
async function getShiftRangeStats(shiftLimit) {
  const shiftsRes = await pool.query(
    `SELECT id, label, opened_at FROM shifts ORDER BY id DESC LIMIT $1`,
    [shiftLimit]
  );
  const shiftIds = shiftsRes.rows.map((s) => s.id);
  const labelById = Object.fromEntries(shiftsRes.rows.map((s) => [s.id, s.label]));

  if (shiftIds.length === 0) {
    return assembleStats([], () => "");
  }

  const rowsRes = await pool.query(
    `SELECT rc.shift_id AS bucket, u.name AS unit_name, rc.material, rc.jam, COUNT(*)::int AS jumlah
     FROM ritasi_clicks rc
     JOIN units u ON u.id = rc.unit_id
     WHERE rc.shift_id = ANY($1::int[])
     GROUP BY rc.shift_id, u.name, rc.material, rc.jam`,
    [shiftIds]
  );

  // urutkan baris berdasar urutan shift terlama->terbaru supaya grafik kronologis
  const orderIndex = Object.fromEntries(shiftIds.slice().reverse().map((id, i) => [id, i]));
  rowsRes.rows.sort((a, b) => orderIndex[a.bucket] - orderIndex[b.bucket]);

  return assembleStats(rowsRes.rows, (key) => labelById[key] || key);
}

// Rekap N hari terakhir (lintas shift), dikelompokkan per tanggal lokal tambang.
async function getDayRangeStats(dayLimit) {
  const rowsRes = await pool.query(
    `SELECT (rc.clicked_at + make_interval(hours => $1))::date AS bucket,
            u.name AS unit_name, rc.material, rc.jam, COUNT(*)::int AS jumlah
     FROM ritasi_clicks rc
     JOIN units u ON u.id = rc.unit_id
     WHERE rc.clicked_at >= now() - ($2 || ' days')::interval
     GROUP BY bucket, u.name, rc.material, rc.jam
     ORDER BY bucket ASC`,
    [OFFSET_HOURS, dayLimit]
  );

  return assembleStats(rowsRes.rows, (key) => {
    const d = new Date(key);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  });
}

module.exports = { getShiftRangeStats, getDayRangeStats };
