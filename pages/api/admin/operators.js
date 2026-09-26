const { pool, ensureSchema } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");
const { atLeast, ALL_ROLES } = require("../../../lib/roles");
const { logActivity } = require("../../../lib/activity");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });
    if (!atLeast(user.role, "admin")) {
      return res.status(403).json({ error: "Hanya admin/superadmin yang bisa mengakses ini" });
    }

    if (req.method === "GET") {
      // Akun 'pending' ditaruh paling atas biar admin langsung lihat yang butuh approval.
      const result = await pool.query(
        `SELECT u.id, u.username, u.role, u.unit_id, u.status, un.name AS unit_name, u.created_at
         FROM users u
         LEFT JOIN units un ON un.id = u.unit_id
         ORDER BY (u.status = 'pending') DESC, u.role, u.username`
      );
      return res.status(200).json(result.rows);
    }

    if (req.method === "POST") {
      // action: "reset_unit" (default), "set_role", "set_unit", "delete_user",
      // "approve", "reject", atau "revoke_sessions"
      const { userId, action, newRole } = req.body || {};
      if (!userId) return res.status(400).json({ error: "userId wajib diisi" });

      if (action === "approve") {
        const targetRes = await pool.query(`SELECT username, status FROM users WHERE id = $1`, [userId]);
        if (targetRes.rows.length === 0) return res.status(404).json({ error: "Akun tidak ditemukan" });
        await pool.query(`UPDATE users SET status = 'active' WHERE id = $1`, [userId]);
        await logActivity(user.id, "approve_user", { userId, username: targetRes.rows[0].username });
        return res.status(200).json({ ok: true });
      }

      if (action === "reject") {
        // Tolak akun yang masih pending -- dihapus langsung (belum pernah dipakai buat apapun,
        // beda dengan "delete_user" yang buat akun aktif yang sudah punya riwayat).
        const targetRes = await pool.query(`SELECT username, status FROM users WHERE id = $1`, [userId]);
        if (targetRes.rows.length === 0) return res.status(404).json({ error: "Akun tidak ditemukan" });
        if (targetRes.rows[0].status !== "pending") {
          return res.status(400).json({ error: "Cuma akun berstatus pending yang bisa ditolak lewat sini" });
        }
        await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
        await logActivity(user.id, "reject_user", { userId, username: targetRes.rows[0].username });
        return res.status(200).json({ ok: true });
      }

      if (action === "revoke_sessions") {
        // "Paksa logout" -- naikkan token_version, semua sesi/cookie lama punya akun ini
        // otomatis tertolak lain kali dipakai (lihat lib/auth.js -> getUserFromReq).
        const targetRes = await pool.query(`SELECT username, role FROM users WHERE id = $1`, [userId]);
        if (targetRes.rows.length === 0) return res.status(404).json({ error: "Akun tidak ditemukan" });
        const targetRole = targetRes.rows[0].role;
        if (user.role === "admin" && (targetRole === "admin" || targetRole === "superadmin")) {
          return res.status(403).json({ error: "Hanya superadmin yang bisa paksa-logout akun admin/superadmin" });
        }
        await pool.query(`UPDATE users SET token_version = token_version + 1 WHERE id = $1`, [userId]);
        await logActivity(user.id, "revoke_sessions", { userId, username: targetRes.rows[0].username });
        return res.status(200).json({ ok: true });
      }

      if (action === "set_role") {
        if (!ALL_ROLES.includes(newRole)) {
          return res.status(400).json({ error: "Role tidak valid" });
        }
        // Admin biasa cuma boleh atur pengawas/operator — tidak boleh bikin admin/superadmin baru,
        // supaya eskalasi wewenang cuma bisa dilakukan superadmin.
        if (user.role === "admin" && (newRole === "admin" || newRole === "superadmin")) {
          return res.status(403).json({ error: "Hanya superadmin yang bisa menjadikan seseorang admin/superadmin" });
        }
        const beforeRes = await pool.query(`SELECT username, role FROM users WHERE id = $1`, [userId]);
        await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [newRole, userId]);
        await logActivity(user.id, "set_role", {
          userId,
          username: beforeRes.rows[0]?.username,
          from: beforeRes.rows[0]?.role,
          to: newRole,
        });
        return res.status(200).json({ ok: true });
      }

      if (action === "set_unit") {
        const { unitId } = req.body || {};
        await pool.query(
          `UPDATE users SET unit_id = $1 WHERE id = $2 AND role = 'operator'`,
          [unitId || null, userId]
        );
        await logActivity(user.id, "set_unit", { userId, unitId: unitId || null });
        return res.status(200).json({ ok: true });
      }

      if (action === "delete_user") {
        if (Number(userId) === user.id) {
          return res.status(400).json({ error: "Tidak bisa menghapus akun sendiri" });
        }
        const targetRes = await pool.query(`SELECT username, role FROM users WHERE id = $1`, [userId]);
        if (targetRes.rows.length === 0) {
          return res.status(404).json({ error: "Akun tidak ditemukan (mungkin sudah dihapus)" });
        }
        const targetRole = targetRes.rows[0].role;
        // Admin biasa cuma boleh hapus akun pengawas/operator — tidak boleh hapus sesama
        // admin/superadmin, supaya penghapusan akun setingkat/lebih tinggi cuma wewenang superadmin.
        if (user.role === "admin" && (targetRole === "admin" || targetRole === "superadmin")) {
          return res.status(403).json({ error: "Hanya superadmin yang bisa menghapus akun admin/superadmin" });
        }
        // Riwayat ritasi & approval milik akun ini TIDAK ikut terhapus (kolom operator_id/reviewed_by
        // otomatis dikosongkan lewat ON DELETE SET NULL di database) — cuma akun login-nya yang hilang.
        await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
        await logActivity(user.id, "delete_user", { userId, username: targetRes.rows[0].username, role: targetRole });
        return res.status(200).json({ ok: true });
      }

      // Reset unit operator (misal salah pilih di awal) — dikosongkan lagi supaya
      // operator diminta memilih ulang saat login berikutnya.
      await pool.query(`UPDATE users SET unit_id = NULL WHERE id = $1 AND role = 'operator'`, [userId]);
      await logActivity(user.id, "reset_unit", { userId });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (err) {
    console.error("Error di /api/admin/operators:", err);
    return res.status(500).json({ error: err.message });
  }
}
