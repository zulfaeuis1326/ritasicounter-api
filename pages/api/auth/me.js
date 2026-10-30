const { ensureSchema } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    await ensureSchema();
    const user = await getUserFromReq(req);
    return res.status(200).json({ user });
  } catch (err) {
    console.error("Error di /api/auth/me:", err);
    return res.status(500).json({ error: err.message });
  }
}
