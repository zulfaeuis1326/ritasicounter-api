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
    if (!atLeast(user.role, "pengawas")) {
      return res.status(403).json({ error: "Hanya pengawas ke atas yang bisa menutup shift" });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    const shift = await getOrCreateOpenShift();
    const recap = await buildRecap(shift.id);

    await pool.query(
      `UPDATE shifts SET status = 'closed', closed_at = now() WHERE id = $1`,
      [shift.id]
    );

    return res.status(200).json({ closedShiftId: shift.id, recap });
  } catch (err) {
    console.error("Error di /api/shift/close:", err);
    return res.status(500).json({ error: err.message });
  }
}
