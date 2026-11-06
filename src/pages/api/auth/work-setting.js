const { pool, ensureSchema } = require("@/lib/db");
const { getUserFromReq } = require("@/lib/auth");

function parseId(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : NaN;
}

// Pengaturan kerja per akun:
//  - operator  : excavator (PC/Loader) tempat dia muat  -> users.fleet_id
//  - pengawas+ : lokasi PIT kerja (null = Semua PIT)    -> users.work_pit_id (+ work_set)
export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });

    if (req.method === "GET") {
      const [f, p] = await Promise.all([
        pool.query(
          `SELECT f.id, f.name, f.pit_id, p.name AS pit_name
           FROM fleets f LEFT JOIN pits p ON p.id = f.pit_id
           WHERE f.active = true ORDER BY p.name NULLS LAST, f.name`
        ),
        pool.query(`SELECT id, name FROM pits WHERE active = true ORDER BY name`),
      ]);
      return res.status(200).json({
        role: user.role,
        unitName: user.unit_name || null,
        fleetId: user.fleet_id || null,
        workPitId: user.work_pit_id || null,
        workSet: !!user.work_set,
        fleets: f.rows,
        pits: p.rows,
      });
    }

    if (req.method === "POST") {
      if (user.role === "operator") {
        const fleetId = parseId(req.body?.fleetId);
        if (Number.isNaN(fleetId)) return res.status(400).json({ error: "Excavator tidak valid" });
        if (fleetId !== null) {
          const ok = await pool.query(`SELECT 1 FROM fleets WHERE id = $1 AND active = true`, [fleetId]);
          if (ok.rows.length === 0) return res.status(400).json({ error: "Excavator tidak ditemukan" });
        }
        await pool.query(`UPDATE users SET fleet_id = $1 WHERE id = $2`, [fleetId, user.id]);
        return res.status(200).json({ ok: true, fleetId });
      }

      const pitId = parseId(req.body?.pitId);
      if (Number.isNaN(pitId)) return res.status(400).json({ error: "Lokasi PIT tidak valid" });
      if (pitId !== null) {
        const ok = await pool.query(`SELECT 1 FROM pits WHERE id = $1 AND active = true`, [pitId]);
        if (ok.rows.length === 0) return res.status(400).json({ error: "Lokasi PIT tidak ditemukan" });
      }
      await pool.query(`UPDATE users SET work_pit_id = $1, work_set = true WHERE id = $2`, [pitId, user.id]);
      return res.status(200).json({ ok: true, pitId });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (err) {
    console.error("Error di /api/auth/work-setting:", err);
    return res.status(500).json({ error: "Terjadi kesalahan pada server. Coba lagi, atau hubungi admin kalau berulang." });
  }
}
