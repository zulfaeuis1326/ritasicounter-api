const { pool, ensureSchema } = require("../../../lib/db");
const { hashPassword, createSessionForUser } = require("../../../lib/auth");

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    const { username, password, role: chosenRole, unitId, newUnitName } = req.body || {};
    if (!username || !username.trim() || !password || password.length < 8) {
      return res.status(400).json({
        error: "Username wajib diisi dan password minimal 8 karakter",
      });
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM users`);
    const isFirstUser = countRes.rows[0].total === 0;

    // Akun pertama otomatis superadmin. Selain itu, orang yang daftar sendiri
    // cuma boleh pilih operator/pengawas — role admin/superadmin cuma bisa lewat
    // upgrade manual oleh superadmin di halaman Kelola Akun (bukan self-register).
    let role = "operator";
    if (isFirstUser) {
      role = "superadmin";
    } else if (chosenRole === "pengawas") {
      role = "pengawas";
    }

    let unitIdToSet = null;
    if (role === "operator") {
      if (newUnitName && newUnitName.trim()) {
        const name = newUnitName.trim();
        try {
          const insertUnit = await pool.query(
            `INSERT INTO units (name) VALUES ($1) RETURNING id`,
            [name]
          );
          unitIdToSet = insertUnit.rows[0].id;
        } catch (err) {
          if (err.code === "23505") {
            const reactivate = await pool.query(
              `UPDATE units SET active = true WHERE name = $1 RETURNING id`,
              [name]
            );
            if (reactivate.rows.length === 0) {
              return res.status(409).json({ error: "Nama unit sudah dipakai unit lain yang masih aktif" });
            }
            unitIdToSet = reactivate.rows[0].id;
          } else {
            throw err;
          }
        }
      } else if (unitId) {
        const unitCheck = await pool.query(`SELECT id FROM units WHERE id = $1 AND active = true`, [unitId]);
        if (unitCheck.rows.length === 0) {
          return res.status(400).json({ error: "Unit tidak ditemukan/tidak aktif" });
        }
        unitIdToSet = unitId;
      } else {
        return res.status(400).json({ error: "Operator wajib memilih atau mendaftarkan unit" });
      }
    }

    let inserted;
    try {
      inserted = await pool.query(
        `INSERT INTO users (username, password_hash, role, unit_id) VALUES ($1, $2, $3, $4)
         RETURNING id, username, role`,
        [username.trim(), hashPassword(password), role, unitIdToSet]
      );
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "Username sudah dipakai, coba yang lain" });
      }
      throw err;
    }

    const user = inserted.rows[0];
    await createSessionForUser(res, user);
    return res.status(201).json({ user });
  } catch (err) {
    console.error("Error di /api/auth/register:", err);
    return res.status(500).json({ error: err.message });
  }
}
