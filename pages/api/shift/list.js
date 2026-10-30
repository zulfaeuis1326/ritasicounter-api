const { pool, ensureSchema } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");
const { atLeast } = require("../../../lib/roles");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });

    if (req.method === "GET") {
      const q = (req.query.q || "").trim();

      const result = await pool.query(
        `SELECT id, shift_type, label, opened_at, closed_at, status
         FROM shifts
         WHERE ($1 = '' OR label ILIKE '%' || $1 || '%')
         ORDER BY id DESC
         LIMIT 200`,
        [q]
      );
      return res.status(200).json(result.rows);
    }

    if (req.method === "DELETE") {
      // Hapus riwayat shift itu sensitif (ikut ngehapus semua ritasi di dalamnya) —
      // khusus admin ke atas, operator/pengawas tidak boleh.
      if (!atLeast(user.role, "admin")) {
        return res.status(403).json({ error: "Hanya admin/superadmin yang bisa menghapus riwayat shift" });
      }
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "id shift wajib diisi" });

      const result = await pool.query(`DELETE FROM shifts WHERE id = $1 RETURNING id`, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Shift tidak ditemukan (mungkin sudah dihapus)" });
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "DELETE"]);
    return res.status(405).end();
  } catch (err) {
    console.error("Error di /api/shift/list:", err);
    return res.status(500).json({ error: err.message });
  }
}
