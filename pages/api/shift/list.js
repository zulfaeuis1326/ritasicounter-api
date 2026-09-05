const { pool, ensureSchema } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });

    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const result = await pool.query(
      `SELECT id, shift_type, label, opened_at, closed_at, status
       FROM shifts
       ORDER BY id DESC
       LIMIT 30`
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error di /api/shift/list:", err);
    return res.status(500).json({ error: err.message });
  }
}
