const { pool, ensureSchema } = require("../../../lib/db");
const { verifyPassword, createSessionForUser } = require("../../../lib/auth");

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password wajib diisi" });
    }

    const result = await pool.query(
      `SELECT id, username, password_hash, role FROM users WHERE username = $1`,
      [username.trim()]
    );
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Username atau password salah" });
    }

    await createSessionForUser(res, user);
    return res.status(200).json({ user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error("Error di /api/auth/login:", err);
    return res.status(500).json({ error: err.message });
  }
}
