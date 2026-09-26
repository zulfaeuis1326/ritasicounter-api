const { pool, ensureSchema } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });
    if (user.role !== "superadmin") {
      return res.status(403).json({ error: "Hanya superadmin yang bisa melihat log aktivitas" });
    }

    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    // 200 aksi terakhir cukup buat kebutuhan audit sehari-hari -- kalau nanti butuh
    // lihat lebih jauh ke belakang, tinggal tambah paging (offset/cursor) di sini.
    const result = await pool.query(
      `SELECT a.id, a.action, a.detail, a.created_at, u.username AS actor_username, u.role AS actor_role
       FROM activity_log a
       LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC
       LIMIT 200`
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error di /api/admin/activity-log:", err);
    return res.status(500).json({ error: err.message });
  }
}
