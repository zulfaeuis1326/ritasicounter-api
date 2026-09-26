const { pool, ensureSchema } = require("../../../lib/db");
const { verifyPassword, createSessionForUser } = require("../../../lib/auth");
const { checkRateLimit, getClientIp } = require("../../../lib/rateLimit");

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    // Maks 10 percobaan login per 5 menit per IP -- nahan brute-force password tanpa
    // ganggu orang yang emang cuma typo password beberapa kali.
    const rl = checkRateLimit(`login:${getClientIp(req)}`, { max: 10, windowMs: 5 * 60 * 1000 });
    if (!rl.allowed) {
      res.setHeader("Retry-After", String(rl.retryAfterSeconds));
      return res.status(429).json({ error: `Terlalu banyak percobaan login. Coba lagi dalam ${rl.retryAfterSeconds} detik.` });
    }

    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password wajib diisi" });
    }

    const result = await pool.query(
      `SELECT id, username, password_hash, role, status, token_version FROM users WHERE username = $1`,
      [username.trim()]
    );
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Username atau password salah" });
    }

    if (user.status === "pending") {
      return res.status(403).json({ error: "Akun kamu masih menunggu persetujuan admin. Coba lagi nanti." });
    }
    if (user.status !== "active") {
      return res.status(403).json({ error: "Akun kamu dinonaktifkan. Hubungi admin." });
    }

    await createSessionForUser(res, user);
    return res.status(200).json({ user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error("Error di /api/auth/login:", err);
    return res.status(500).json({ error: err.message });
  }
}
