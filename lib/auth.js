const crypto = require("crypto");
const { pool } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "ganti-secret-ini-di-railway-variables";
const COOKIE_NAME = "ritasi_session";
const SESSION_DAYS = 365; // login sekali, tetap login lama (sesuai permintaan)

// --- Hash password (scrypt bawaan Node, tanpa dependency tambahan/native build) ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(check));
}

// --- Token sesi sederhana (HMAC-signed, bukan JWT library supaya tidak nambah dependency) ---
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

async function createSessionForUser(res, user) {
  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
  setSessionCookie(res, token);
}

// Ambil user yang sedang login dari cookie request. Return null kalau belum login.
// Selalu cek ulang ke database (bukan cuma percaya isi token) supaya perubahan role
// oleh admin langsung berlaku tanpa perlu logout-login ulang.
async function getUserFromReq(req) {
  const cookies = parseCookies(req);
  const payload = verifyToken(cookies[COOKIE_NAME]);
  if (!payload) return null;

  const result = await pool.query(
    `SELECT u.id, u.username, u.role, u.unit_id, un.name AS unit_name
     FROM users u
     LEFT JOIN units un ON un.id = u.unit_id
     WHERE u.id = $1`,
    [payload.userId]
  );
  return result.rows[0] || null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSessionForUser,
  clearSessionCookie,
  getUserFromReq,
};
