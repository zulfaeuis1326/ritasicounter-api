const { pool, ensureSchema } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    if (user.role !== "operator") {
      return res.status(400).json({ error: "Hanya akun operator yang perlu memilih unit" });
    }

    // Server-side enforce: sekali sudah terisi, tidak bisa diganti sendiri.
    // Cuma admin (lewat /api/admin/operators) yang boleh reset.
    if (user.unit_id) {
      return res.status(403).json({ error: "Unit kamu sudah terkunci. Minta admin untuk reset kalau salah pilih." });
    }

    const { unitId, newUnitName } = req.body || {};

    // Opsi A: operator daftarkan unit BARU sendiri (nomor unit belum ada di sistem)
    if (newUnitName && newUnitName.trim()) {
      const name = newUnitName.trim();
      let unit;
      try {
        const insertRes = await pool.query(
          `INSERT INTO units (name) VALUES ($1) RETURNING id`,
          [name]
        );
        unit = insertRes.rows[0];
      } catch (err) {
        if (err.code === "23505") {
          // Nama unit sudah ada (mungkin sebelumnya dihapus lalu didaftarkan lagi) — aktifkan ulang & pakai itu.
          const reactivate = await pool.query(
            `UPDATE units SET active = true WHERE name = $1 RETURNING id`,
            [name]
          );
          if (reactivate.rows.length === 0) {
            return res.status(409).json({ error: "Nama unit sudah dipakai unit lain yang masih aktif" });
          }
          unit = reactivate.rows[0];
        } else {
          throw err;
        }
      }
      await pool.query(`UPDATE users SET unit_id = $1 WHERE id = $2`, [unit.id, user.id]);
      return res.status(200).json({ ok: true });
    }

    // Opsi B: pilih unit yang sudah ada di daftar
    if (!unitId) return res.status(400).json({ error: "unitId atau newUnitName wajib diisi" });

    const unitCheck = await pool.query(`SELECT id FROM units WHERE id = $1 AND active = true`, [unitId]);
    if (unitCheck.rows.length === 0) {
      return res.status(400).json({ error: "Unit tidak ditemukan/tidak aktif" });
    }

    await pool.query(`UPDATE users SET unit_id = $1 WHERE id = $2`, [unitId, user.id]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error di /api/auth/set-unit:", err);
    return res.status(500).json({ error: err.message });
  }
}
