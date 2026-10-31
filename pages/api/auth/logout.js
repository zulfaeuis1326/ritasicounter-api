const { pool, ensureSchema } = require("../../../lib/db");
const { getUserFromReq, clearSessionCookie } = require("../../../lib/auth");

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    // Operator: lepas kunci unit begitu logout, supaya login berikutnya bisa
    // pilih unit lain lagi (bukan terkunci permanen sampai admin reset).
    const user = await getUserFromReq(req);
    // Excavator pilihan operator dan lokasi PIT kerja pengawas ikut dilepas, supaya pilihan kemarin
    // tidak terbawa ke shift berikutnya dan ritasi tidak salah dicatat.
    if (user && user.role === "operator" && (user.unit_id || user.fleet_id)) {
      await pool.query(`UPDATE users SET unit_id = NULL, fleet_id = NULL WHERE id = $1`, [user.id]);
    } else if (user && user.role !== "operator" && user.work_set) {
      await pool.query(`UPDATE users SET work_set = false, work_pit_id = NULL WHERE id = $1`, [user.id]);
    }

    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error di /api/auth/logout:", err);
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
}
