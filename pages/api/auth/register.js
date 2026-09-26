const { pool, ensureSchema } = require("../../../lib/db");
const { hashPassword, createSessionForUser } = require("../../../lib/auth");
const { checkRateLimit, getClientIp } = require("../../../lib/rateLimit");

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    // Maks 5 pendaftaran per 15 menit per IP -- nahan spam-daftar akun.
    const rl = checkRateLimit(`register:${getClientIp(req)}`, { max: 5, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) {
      res.setHeader("Retry-After", String(rl.retryAfterSeconds));
      return res.status(429).json({ error: `Terlalu banyak percobaan daftar. Coba lagi dalam ${rl.retryAfterSeconds} detik.` });
    }

    const { username, password, role: chosenRole, unitId, newUnitName } = req.body || {};
    if (!username || !username.trim() || !password || password.length < 8) {
      return res.status(400).json({
        error: "Username wajib diisi dan password minimal 8 karakter",
      });
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM users`);
    const isFirstUser = countRes.rows[0].total === 0;

    // Akun pertama otomatis superadmin & langsung aktif (harus ada 1 akun yang bisa
    // approve akun-akun berikutnya). Selain itu, orang yang daftar sendiri cuma boleh
    // pilih operator/pengawas -- role admin/superadmin cuma bisa lewat upgrade manual
    // oleh superadmin di halaman Kelola Akun (bukan self-register).
    let role = "operator";
    if (isFirstUser) {
      role = "superadmin";
    } else if (chosenRole === "pengawas") {
      role = "pengawas";
    }

    // Approval gate: akun pertama langsung aktif, akun-akun selanjutnya yang daftar
    // sendiri (operator/pengawas) berstatus "pending" sampai di-approve admin/superadmin
    // di halaman Kelola Akun. Ini nutup celah "siapapun yang nemu URL bisa langsung
    // masuk & lihat data produksi tanpa persetujuan siapa-siapa".
    const status = isFirstUser ? "active" : "pending";

    let unitIdToSet = null;
    if (role === "operator") {
      if (newUnitName && newUnitName.trim()) {
        const name = newUnitName.trim();
        try {
          const insertUnit = await pool.query(
            `INSERT INTO units (name) VALUES ($1) RETURNING id`,
            [name]
          );
          unitIdToSet = insertUnit.rows[0].id;
        } catch (err) {
          if (err.code === "23505") {
            const reactivate = await pool.query(
              `UPDATE units SET active = true WHERE name = $1 RETURNING id`,
              [name]
            );
            if (reactivate.rows.length === 0) {
              return res.status(409).json({ error: "Nama unit sudah dipakai unit lain yang masih aktif" });
            }
            unitIdToSet = reactivate.rows[0].id;
          } else {
            throw err;
          }
        }
      } else if (unitId) {
        const unitCheck = await pool.query(`SELECT id FROM units WHERE id = $1 AND active = true`, [unitId]);
        if (unitCheck.rows.length === 0) {
          return res.status(400).json({ error: "Unit tidak ditemukan/tidak aktif" });
        }
        unitIdToSet = unitId;
      } else {
        return res.status(400).json({ error: "Operator wajib memilih atau mendaftarkan unit" });
      }
    }

    let inserted;
    try {
      inserted = await pool.query(
        `INSERT INTO users (username, password_hash, role, unit_id, status) VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, role, status, token_version`,
        [username.trim(), hashPassword(password), role, unitIdToSet, status]
      );
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "Username sudah dipakai, coba yang lain" });
      }
      throw err;
    }

    const user = inserted.rows[0];

    if (user.status === "pending") {
      // Sengaja TIDAK bikin sesi/cookie -- akun ini belum boleh masuk sampai di-approve.
      return res.status(202).json({
        pending: true,
        message: "Akun kamu berhasil didaftarkan dan sedang menunggu persetujuan admin. Kamu akan bisa login setelah di-approve.",
      });
    }

    await createSessionForUser(res, user);
    return res.status(201).json({ user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error("Error di /api/auth/register:", err);
    return res.status(500).json({ error: err.message });
  }
}
