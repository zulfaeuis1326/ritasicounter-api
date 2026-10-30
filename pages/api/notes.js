const { pool, ensureSchema } = require("../../lib/db");
const { getUserFromReq } = require("../../lib/auth");
const { atLeast } = require("../../lib/roles");
const { getOrCreateOpenShift } = require("../../lib/shift");
const { logActivity } = require("../../lib/activity");

// Keterangan per unit untuk shift berjalan. Hanya pengawas ke atas.
export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });
    if (!atLeast(user.role, "pengawas")) {
      return res.status(403).json({ error: "Hanya pengawas ke atas" });
    }

    const shift = await getOrCreateOpenShift();

    if (req.method === "GET") {
      const r = await pool.query(`SELECT unit_id, note FROM unit_notes WHERE shift_id = $1`, [shift.id]);
      const notes = {};
      r.rows.forEach((x) => { notes[x.unit_id] = x.note; });
      return res.status(200).json({ notes });
    }

    if (req.method === "POST") {
      const unitId = Number(req.body?.unitId);
      const note = String(req.body?.note ?? "").trim().slice(0, 200);
      if (!Number.isInteger(unitId) || unitId <= 0) {
        return res.status(400).json({ error: "unitId tidak valid" });
      }
      const u = await pool.query(`SELECT name FROM units WHERE id = $1`, [unitId]);
      if (u.rows.length === 0) return res.status(404).json({ error: "Unit tidak ditemukan" });

      if (note === "") {
        await pool.query(`DELETE FROM unit_notes WHERE shift_id = $1 AND unit_id = $2`, [shift.id, unitId]);
      } else {
        await pool.query(
          `INSERT INTO unit_notes (shift_id, unit_id, note, updated_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (shift_id, unit_id)
           DO UPDATE SET note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [shift.id, unitId, note, user.id]
        );
      }
      await logActivity(user.id, "set_note", { shiftId: shift.id, unit: u.rows[0].name, note });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (err) {
    console.error("Error di /api/notes:", err);
    return res.status(500).json({ error: err.message });
  }
}
