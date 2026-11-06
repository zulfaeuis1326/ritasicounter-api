const { pool, ensureSchema } = require("@/lib/db");
const { getUserFromReq } = require("@/lib/auth");
const { atLeast } = require("@/lib/roles");
const { logActivity } = require("@/lib/activity");
const { OFFSET_HOURS } = require("@/lib/time");

const LOCAL = (col) => `((${col} AT TIME ZONE 'UTC') + make_interval(hours => $1::int))`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Daftar approval shift: paging berbasis kursor (tidak memuat semua riwayat), filter, dan setujui banyak sekaligus.
export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });
    if (!atLeast(user.role, "pengawas")) return res.status(403).json({ error: "Hanya pengawas ke atas" });

    if (req.method === "GET") {
      const status = ["pending", "approved", "all"].includes(req.query.status) ? req.query.status : "pending";
      const q = String(req.query.q || "").trim().slice(0, 60);
      const shiftType = [1, 2].includes(Number(req.query.shiftType)) ? Number(req.query.shiftType) : null;
      const from = DATE_RE.test(String(req.query.from || "")) ? req.query.from : null;
      const to = DATE_RE.test(String(req.query.to || "")) ? req.query.to : null;
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
      const cursor = parseInt(req.query.cursor, 10) || null;

      // Filter yang berlaku untuk daftar DAN angka tab (angka tab tidak ikut dipersempit oleh tab aktif)
      const params = [OFFSET_HOURS];
      const base = [];
      if (q) { params.push(q); base.push(`s.label ILIKE '%' || $${params.length} || '%'`); }
      if (shiftType) { params.push(shiftType); base.push(`s.shift_type = $${params.length}`); }
      if (from) { params.push(from); base.push(`${LOCAL("s.opened_at")}::date >= $${params.length}::date`); }
      if (to) { params.push(to); base.push(`${LOCAL("s.opened_at")}::date <= $${params.length}::date`); }
      const baseSql = base.length ? " AND " + base.join(" AND ") : "";

      const statusSql =
        status === "pending" ? "s.status = 'closed' AND s.review_status = 'pending'" :
        status === "approved" ? "s.review_status = 'approved'" : "true";

      const listParams = params.slice();
      let cursorSql = "";
      if (cursor) { listParams.push(cursor); cursorSql = ` AND s.id < $${listParams.length}`; }
      listParams.push(limit + 1);

      const [counts, list, today] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) FILTER (WHERE s.status = 'closed' AND s.review_status = 'pending')::int AS pending,
                  COUNT(*) FILTER (WHERE s.review_status = 'approved')::int AS approved,
                  COUNT(*)::int AS all
           FROM shifts s WHERE true${baseSql}`,
          params
        ),
        pool.query(
          `SELECT s.id, s.label, s.shift_type, s.status, s.review_status, s.reviewed_at,
                  to_char(${LOCAL("s.opened_at")}, 'YYYY-MM-DD') AS day,
                  to_char(${LOCAL("s.opened_at")}, 'HH24:MI') AS open_time,
                  to_char(${LOCAL("s.closed_at")}, 'HH24:MI') AS close_time,
                  u.username AS reviewed_by_name,
                  (SELECT COUNT(*)::int FROM ritasi_clicks rc WHERE rc.shift_id = s.id) AS total
           FROM shifts s LEFT JOIN users u ON u.id = s.reviewed_by
           WHERE ${statusSql}${baseSql}${cursorSql}
           ORDER BY s.id DESC
           LIMIT $${listParams.length}`,
          listParams
        ),
        pool.query(`SELECT to_char(((now() AT TIME ZONE 'UTC') + make_interval(hours => $1::int)), 'YYYY-MM-DD') AS today`, [OFFSET_HOURS]),
      ]);

      const hasMore = list.rows.length > limit;
      const items = hasMore ? list.rows.slice(0, limit) : list.rows;
      return res.status(200).json({
        items,
        nextCursor: hasMore ? items[items.length - 1].id : null,
        counts: counts.rows[0],
        today: today.rows[0].today,
      });
    }

    if (req.method === "POST") {
      const { action } = req.body || {};
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
      if (ids.length === 0 || ids.length > 100) return res.status(400).json({ error: "Pilih 1 sampai 100 shift" });

      if (action === "approve") {
        // Hanya shift yang sudah ditutup dan masih menunggu. Satu pernyataan SQL = atomik.
        const r = await pool.query(
          `UPDATE shifts SET review_status = 'approved', reviewed_by = $1, reviewed_at = now()
           WHERE id = ANY($2::int[]) AND status = 'closed' AND review_status = 'pending'
           RETURNING id`,
          [user.id, ids]
        );
        await logActivity(user.id, "approve_shifts", { requested: ids.length, approved: r.rowCount, ids: r.rows.map((x) => x.id) });
        return res.status(200).json({ ok: true, updated: r.rowCount, ids: r.rows.map((x) => x.id) });
      }

      if (action === "revoke") {
        if (!atLeast(user.role, "admin")) return res.status(403).json({ error: "Hanya admin yang bisa membatalkan approval" });
        const r = await pool.query(
          `UPDATE shifts SET review_status = 'pending', reviewed_by = NULL, reviewed_at = NULL
           WHERE id = ANY($1::int[]) AND review_status = 'approved' RETURNING id`,
          [ids]
        );
        await logActivity(user.id, "revoke_shift_approval", { requested: ids.length, revoked: r.rowCount, ids: r.rows.map((x) => x.id) });
        return res.status(200).json({ ok: true, updated: r.rowCount, ids: r.rows.map((x) => x.id) });
      }
      return res.status(400).json({ error: "Aksi tidak dikenal" });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (err) {
    console.error("Error di /api/shift/approvals:", err);
    return res.status(500).json({ error: "Terjadi kesalahan pada server. Coba lagi, atau hubungi admin kalau berulang." });
  }
}
