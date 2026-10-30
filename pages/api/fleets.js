const { pool, ensureSchema } = require("../../lib/db");
const { getUserFromReq } = require("../../lib/auth");
const { atLeast } = require("../../lib/roles");

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method === "GET") {
      // Publik — dipakai di halaman utama (nampilin fleet + unit-unit yang gabung situ).
      const result = await pool.query(
        `SELECT f.id, f.name, f.pit_id, p.name AS pit_name
         FROM fleets f
         LEFT JOIN pits p ON p.id = f.pit_id
         WHERE f.active = true
         ORDER BY f.name`
      );
      return res.status(200).json(result.rows);
    }

    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });

    // Kelola fleet (bikin/hapus/ubah PIT) wewenang pengawas ke atas.
    if (!atLeast(user.role, "pengawas")) {
      return res.status(403).json({ error: "Hanya pengawas ke atas yang bisa mengelola fleet" });
    }

    if (req.method === "POST") {
      const { action } = req.body || {};

      if (action === "set_pit") {
        const { fleetId, pitId } = req.body || {};
        if (!fleetId) return res.status(400).json({ error: "fleetId wajib diisi" });
        await pool.query(`UPDATE fleets SET pit_id = $1 WHERE id = $2`, [pitId || null, fleetId]);
        return res.status(200).json({ ok: true });
      }

      // Default: bikin fleet (PC) baru
      const { name, pitId } = req.body || {};
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Nama PC/fleet wajib diisi" });
      }
      try {
        const result = await pool.query(
          `INSERT INTO fleets (name, pit_id) VALUES ($1, $2) RETURNING id, name, pit_id`,
          [name.trim(), pitId || null]
        );
        return res.status(201).json(result.rows[0]);
      } catch (err) {
        if (err.code === "23505") {
          return res.status(409).json({ error: "Fleet/PC dengan nama itu sudah ada" });
        }
        throw err;
      }
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {};
      // Lepas semua unit HD yang masih gabung fleet ini dulu, biar gak ada referensi nyangkut.
      await pool.query(`UPDATE units SET fleet_id = NULL WHERE fleet_id = $1`, [id]);
      await pool.query(`UPDATE fleets SET active = false WHERE id = $1`, [id]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).end();
  } catch (err) {
    console.error("Error di /api/fleets:", err);
    return res.status(500).json({ error: err.message });
  }
}
