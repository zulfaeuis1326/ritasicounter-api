const { pool, ensureSchema } = require("../../../lib/db");
const { getOrCreateOpenShift } = require("../../../lib/shift");
const { buildRecap } = require("../../../lib/recap");
const { getUserFromReq } = require("../../../lib/auth");
const { atLeast } = require("../../../lib/roles");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });

    if (req.method === "GET") {
      const shift = await getOrCreateOpenShift();
      const lockedUnitId = user.role === "operator" ? user.unit_id : null;
      const lockedOperatorId = user.role === "operator" ? user.id : null;
      const result = await pool.query(
        `SELECT rc.id, rc.unit_id, u.name AS unit_name, rc.material, rc.jam, rc.clicked_at,
                rc.operator_id, op.username AS operator_name
         FROM ritasi_clicks rc
         JOIN units u ON u.id = rc.unit_id
         LEFT JOIN users op ON op.id = rc.operator_id
         WHERE rc.shift_id = $1
           AND ($2::int IS NULL OR rc.unit_id = $2)
           AND ($3::int IS NULL OR rc.operator_id = $3)
         ORDER BY rc.id DESC
         LIMIT 50`,
        [shift.id, lockedUnitId, lockedOperatorId]
      );
      return res.status(200).json({ shiftId: shift.id, clicks: result.rows });
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "id klik wajib diisi" });

      const existing = await pool.query(`SELECT operator_id, unit_id FROM ritasi_clicks WHERE id = $1`, [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Data ritasi tidak ditemukan (mungkin sudah dihapus)" });
      }
      const isOwner = existing.rows[0].operator_id === user.id;
      if (!atLeast(user.role, "admin") && !isOwner) {
        return res.status(403).json({ error: "Hanya bisa menghapus entri yang kamu input sendiri" });
      }

      const deleted = await pool.query(
        `DELETE FROM ritasi_clicks WHERE id = $1 RETURNING shift_id`,
        [id]
      );

      const shiftId = deleted.rows[0].shift_id;
      const lockedUnitId = user.role === "operator" ? user.unit_id : null;
      const lockedOperatorId = user.role === "operator" ? user.id : null;
      const recap = await buildRecap(shiftId, lockedUnitId, lockedOperatorId);
      return res.status(200).json({ deleted: true, recap });
    }

    res.setHeader("Allow", ["GET", "DELETE"]);
    return res.status(405).end();
  } catch (err) {
    console.error("Error di /api/ritasi/history:", err);
    return res.status(500).json({ error: err.message });
  }
}
