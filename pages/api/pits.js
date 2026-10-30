const { pool, ensureSchema } = require("../../lib/db");
const { getUserFromReq } = require("../../lib/auth");
const { atLeast } = require("../../lib/roles");

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method === "GET") {
      // Publik — dipakai juga di halaman utama sebelum login.
      const result = await pool.query(
        `SELECT id, name FROM pits WHERE active = true ORDER BY name`
      );
      return res.status(200).json(result.rows);
    }

    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });

    // Nambah/hapus lokasi PIT wewenang pengawas ke atas — pengawas yang atur penempatan alat.
    if (!atLeast(user.role, "pengawas")) {
      return res.status(403).json({ error: "Hanya pengawas ke atas yang bisa mengubah daftar PIT" });
    }

    if (req.method === "POST") {
      const { name } = req.body || {};
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Nama lokasi wajib diisi" });
      }
      try {
        const result = await pool.query(
          `INSERT INTO pits (name) VALUES ($1) RETURNING id, name`,
          [name.trim().toUpperCase()]
        );
        return res.status(201).json(result.rows[0]);
      } catch (err) {
        if (err.code === "23505") {
          return res.status(409).json({ error: "Lokasi dengan nama itu sudah ada" });
        }
        throw err;
      }
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {};
      await pool.query(`UPDATE pits SET active = false WHERE id = $1`, [id]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).end();
  } catch (err) {
    console.error("Error di /api/pits:", err);
    return res.status(500).json({ error: err.message });
  }
}
