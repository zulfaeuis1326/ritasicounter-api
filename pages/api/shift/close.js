const { pool, ensureSchema } = require("../../../lib/db");
const { buildRecap } = require("../../../lib/recap");
const { getUserFromReq } = require("../../../lib/auth");
const { atLeast } = require("../../../lib/roles");
const { logActivity } = require("../../../lib/activity");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });
    if (!atLeast(user.role, "pengawas")) {
      return res.status(403).json({ error: "Hanya pengawas ke atas yang bisa menutup shift" });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    // Hanya menutup shift yang MEMANG sedang terbuka. Sengaja tidak memakai
    // getOrCreateOpenShift(): kalau tidak ada shift terbuka, jangan bikin shift baru
    // hanya untuk langsung menutupnya.
    const openRes = await pool.query(
      `SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1`
    );
    if (openRes.rows.length === 0) {
      return res.status(409).json({ error: "Tidak ada shift yang sedang berjalan" });
    }
    const shift = openRes.rows[0];

    // WHERE status='open' + RETURNING: kalau request lain sudah menutupnya duluan,
    // update ini tidak mengubah apa-apa dan closed_at yang benar tidak tertimpa.
    const closed = await pool.query(
      `UPDATE shifts SET status = 'closed', closed_at = now()
       WHERE id = $1 AND status = 'open' RETURNING id`,
      [shift.id]
    );
    if (closed.rows.length === 0) {
      return res.status(409).json({ error: "Shift ini sudah ditutup" });
    }

    const recap = await buildRecap(shift.id);
    await logActivity(user.id, "close_shift", {
      shiftId: shift.id,
      label: shift.label,
      grandTotal: recap ? recap.grandTotal : null,
    });

    return res.status(200).json({ closedShiftId: shift.id, recap });
  } catch (err) {
    console.error("Error di /api/shift/close:", err);
    return res.status(500).json({ error: err.message });
  }
}
