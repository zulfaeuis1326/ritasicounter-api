const { pool, ensureSchema } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");

// Gabungin baris yang namanya sama (case-insensitive, abaikan spasi berlebih) jadi 1 —
// yang disimpan: yang udah punya fleet_id/pit_id (data paling lengkap), sisanya dihapus.
async function dedupeTable(table, hasFleetId) {
  const result = await pool.query(`SELECT * FROM ${table} WHERE active = true ORDER BY id`);
  const groups = new Map();
  for (const row of result.rows) {
    const key = row.name.trim().toUpperCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let merged = 0;
  for (const [, rows] of groups) {
    if (rows.length < 2) continue;
    // Prioritaskan baris yang paling banyak data terisi (fleet_id/pit_id), fallback id terkecil.
    rows.sort((a, b) => {
      const score = (r) => (hasFleetId && r.fleet_id ? 1 : 0) + (r.pit_id ? 1 : 0);
      return score(b) - score(a) || a.id - b.id;
    });
    const keep = rows[0];
    const rest = rows.slice(1);

    // Kalau yang dipertahankan belum punya pit_id/fleet_id tapi salah satu duplikatnya punya, warisi.
    const donorPit = rows.find((r) => r.pit_id)?.pit_id;
    const donorFleet = hasFleetId ? rows.find((r) => r.fleet_id)?.fleet_id : null;
    if (donorPit && !keep.pit_id) {
      await pool.query(`UPDATE ${table} SET pit_id = $1 WHERE id = $2`, [donorPit, keep.id]);
    }
    if (hasFleetId && donorFleet && !keep.fleet_id) {
      await pool.query(`UPDATE ${table} SET fleet_id = $1 WHERE id = $2`, [donorFleet, keep.id]);
    }

    for (const r of rest) {
      if (table === "fleets") {
        // Lepas dulu HD yang nempel ke fleet duplikat ini, pindah ke yang dipertahankan.
        await pool.query(`UPDATE units SET fleet_id = $1 WHERE fleet_id = $2`, [keep.id, r.id]);
      }
      await pool.query(`UPDATE ${table} SET active = false WHERE id = $1`, [r.id]);
      merged++;
    }
  }
  return merged;
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user || user.role !== "superadmin") {
      return res.status(403).json({ error: "Hanya superadmin yang bisa jalanin ini" });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    const fleetsMerged = await dedupeTable("fleets", false);
    const unitsMerged = await dedupeTable("units", true);

    return res.status(200).json({ ok: true, fleetsMerged, unitsMerged });
  } catch (err) {
    console.error("Error di /api/admin/dedupe-units:", err);
    return res.status(500).json({ error: err.message });
  }
}
