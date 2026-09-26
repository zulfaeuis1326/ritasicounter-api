const { pool, ensureSchema } = require("../../lib/db");
const { getUserFromReq } = require("../../lib/auth");
const { atLeast } = require("../../lib/roles");

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method === "GET") {
      // Publik (siapa aja yang login boleh baca) — dipakai buat nampilin banner "jam laporan".
      const result = await pool.query(`SELECT value FROM app_settings WHERE key = 'report_hours'`);
      let reportHours = [7, 12, 19];
      if (result.rows[0]) {
        try {
          const parsed = JSON.parse(result.rows[0].value);
          if (Array.isArray(parsed)) reportHours = parsed;
        } catch (e) {
          // biarin default kalau value korup
        }
      }
      return res.status(200).json({ reportHours });
    }

    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });

    if (req.method === "POST") {
      if (!atLeast(user.role, "admin")) {
        return res.status(403).json({ error: "Hanya admin ke atas yang bisa ubah setting" });
      }
      const { reportHours } = req.body || {};
      if (!Array.isArray(reportHours) || reportHours.some((h) => typeof h !== "number" || h < 0 || h > 23)) {
        return res.status(400).json({ error: "reportHours harus array jam 0-23" });
      }
      const cleaned = [...new Set(reportHours)].sort((a, b) => a - b);
      await pool.query(
        `INSERT INTO app_settings (key, value) VALUES ('report_hours', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [JSON.stringify(cleaned)]
      );
      return res.status(200).json({ ok: true, reportHours: cleaned });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("settings API error:", err);
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
