const { pool, ensureSchema } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");
const { atLeast } = require("../../../lib/roles");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });
    if (!atLeast(user.role, "admin")) {
      return res.status(403).json({ error: "Hanya admin ke atas yang bisa menghapus history shift" });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    const { shiftId } = req.body || {};
    const id = Number(shiftId);
    if (!id) return res.status(400).json({ error: "shiftId wajib diisi" });

    const shiftRes = await pool.query(`SELECT id, status, label FROM shifts WHERE id = $1`, [id]);
    const shift = shiftRes.rows[0];
    if (!shift) return res.status(404).json({ error: "Shift tidak ditemukan" });
    if (shift.status === "open") {
      return res.status(400).json({ error: "Shift yang masih aktif/berjalan gak bisa dihapus. Tutup dulu shift-nya." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM ritasi_clicks WHERE shift_id = $1`, [id]);
      await client.query(`DELETE FROM shifts WHERE id = $1`, [id]);
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

    return res.status(200).json({ ok: true, deletedShiftId: id, label: shift.label });
  } catch (err) {
    console.error("Error di /api/shift/delete:", err);
    return res.status(500).json({ error: err.message });
  }
}
