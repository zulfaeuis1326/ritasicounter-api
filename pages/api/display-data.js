const { pool, ensureSchema } = require("../../lib/db");
const { getUserFromReq } = require("../../lib/auth");
const { atLeast } = require("../../lib/roles");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });
    if (!atLeast(user.role, "pengawas")) {
      return res.status(403).json({ error: "Hanya pengawas ke atas yang bisa akses ini" });
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    // Default: shift yang lagi "open" (buat ditampilkan live di TV).
    // Boleh override lihat shift tertentu lewat ?shiftId=123 (misal recap shift kemarin).
    // Sengaja CUMA baca, TIDAK auto-create shift baru kalau belum ada -- itu tanggung
    // jawab lib/shift.js dipanggil dari alur input ritasi, bukan dari sini.
    let shift;
    if (req.query.shiftId) {
      const r = await pool.query(`SELECT * FROM shifts WHERE id = $1`, [req.query.shiftId]);
      shift = r.rows[0];
    } else {
      const r = await pool.query(`SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1`);
      shift = r.rows[0];
    }

    if (!shift) {
      return res.status(200).json({ shift: null, pits: [], grandTotalRit: 0 });
    }

    // Catatan: pit/fleet di sini ikut assignment TERKINI unit (units.pit_id/fleet_id),
    // bukan assignment pas klik dicatat -- cukup akurat buat tampilan live "hari ini",
    // tapi kalau unit pindah PIT di tengah shift, histori lama ikut keitung di PIT barunya.
    const rowsRes = await pool.query(
      `SELECT
         COALESCE(p.name, 'Belum ada PIT') AS pit,
         COALESCE(f.name, 'Belum ada Fleet') AS fleet,
         u.name AS hauler,
         rc.material,
         COUNT(*)::int AS rit_count,
         to_char(MAX(rc.clicked_at) AT TIME ZONE 'Asia/Makassar', 'HH24:MI') AS last_time
       FROM ritasi_clicks rc
       JOIN units u ON u.id = rc.unit_id
       LEFT JOIN fleets f ON f.id = u.fleet_id
       LEFT JOIN pits p ON p.id = u.pit_id
       WHERE rc.shift_id = $1
       GROUP BY p.name, f.name, u.name, rc.material
       ORDER BY p.name NULLS LAST, f.name NULLS LAST, u.name, rc.material`,
      [shift.id]
    );

    // Susun jadi struktur bertingkat Pit -> Fleet -> Hauler, masing-masing dengan
    // total rit + breakdown per material (JUMLAH rit, bukan uang -- app ini gak
    // punya konsep harga/pendapatan).
    const pitMap = new Map();
    let grandTotalRit = 0;

    for (const row of rowsRes.rows) {
      grandTotalRit += row.rit_count;

      if (!pitMap.has(row.pit)) pitMap.set(row.pit, { pit: row.pit, totalRit: 0, fleetMap: new Map() });
      const pitEntry = pitMap.get(row.pit);
      pitEntry.totalRit += row.rit_count;

      if (!pitEntry.fleetMap.has(row.fleet)) pitEntry.fleetMap.set(row.fleet, { fleet: row.fleet, totalRit: 0, haulerMap: new Map() });
      const fleetEntry = pitEntry.fleetMap.get(row.fleet);
      fleetEntry.totalRit += row.rit_count;

      if (!fleetEntry.haulerMap.has(row.hauler)) fleetEntry.haulerMap.set(row.hauler, { hauler: row.hauler, totalRit: 0, lastTime: row.last_time, materials: [] });
      const haulerEntry = fleetEntry.haulerMap.get(row.hauler);
      haulerEntry.totalRit += row.rit_count;
      if (row.last_time > (haulerEntry.lastTime || "")) haulerEntry.lastTime = row.last_time;
      haulerEntry.materials.push({ material: row.material, ritCount: row.rit_count });
    }

    const pits = Array.from(pitMap.values()).map((p) => ({
      pit: p.pit,
      totalRit: p.totalRit,
      fleets: Array.from(p.fleetMap.values()).map((f) => ({
        fleet: f.fleet,
        totalRit: f.totalRit,
        haulers: Array.from(f.haulerMap.values()),
      })),
    }));

    return res.status(200).json({
      shift: { id: shift.id, label: shift.label, status: shift.status, shiftType: shift.shift_type },
      pits,
      grandTotalRit,
    });
  } catch (err) {
    console.error("Error di /api/display-data:", err);
    return res.status(500).json({ error: err.message });
  }
}
