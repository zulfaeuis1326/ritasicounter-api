const crypto = require("crypto");
const { pool } = require("@/lib/db");

// WAJIB di-set di environment (.env lokal / variables di hosting). Sengaja TIDAK ada
// fallback string default -- fallback semacam itu nangkring di source code publik,
// jadi siapapun yang baca repo bisa forge token login kalau env var ini lupa di-set.
// Mending gagal keras (500 di semua request) daripada diam-diam jadi lubang keamanan.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET belum di-set di environment variables. Wajib diisi string acak & rahasia " +
    "sebelum aplikasi bisa jalan -- lihat .env.example."
  );
}

const COOKIE_NAME = "ritasi_session";
// Flag Secure hanya di production (HTTPS). Di localhost (http) dilewati supaya login dev tetap jalan.
const SECURE_FLAG = process.env.NODE_ENV === "production" ? "; Secure" : "";
const SESSION_DAYS = 365; // login sekali, tetap login lama (sesuai permintaan) -- untuk operator
// Akun berwenang lebih besar dibuat lebih pendek: kalau HP/laptop hilang, jendela penyalahgunaannya kecil.
const SESSION_DAYS_BY_ROLE = { operator: 365, pengawas: 30, admin: 14, superadmin: 14 };
const sessionDays = (role) => SESSION_DAYS_BY_ROLE[role] || 30;

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

// Versi async: scryptSync memblokir seluruh server selama hashing, jadi banyak orang login
// bersamaan (pergantian shift) bikin semua request lain ikut macet. Format hash sama persis
// dengan versi sync, jadi password lama tetap valid.
const { promisify } = require("util");
const scryptAsync = promisify(crypto.scrypt);

async function hashPasswordAsync(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${salt}:${buf.toString("hex")}`;
}

async function verifyPasswordAsync(password, stored) {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const buf = await scryptAsync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== buf.length) return false;
  return crypto.timingSafeEqual(expected, buf);
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

function setSessionCookie(res, token, days = SESSION_DAYS) {
  const maxAge = days * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE_FLAG}`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${SECURE_FLAG}`);
}

// tokenVersion disertakan di token supaya admin/superadmin bisa "paksa logout" satu akun
// tertentu (misal HP operator hilang) cukup dengan menaikkan users.token_version --
// tanpa perlu ganti JWT_SECRET yang bakal nge-logout SEMUA orang sekaligus.
async function createSessionForUser(res, user) {
  const days = sessionDays(user.role);
  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    tokenVersion: user.token_version || 1,
    exp: Date.now() + days * 24 * 60 * 60 * 1000,
  });
  setSessionCookie(res, token, days);
}

// Ambil user yang sedang login dari cookie request. Return null kalau belum login,
// akunnya belum di-approve/dinonaktifkan, atau sesinya sudah di-revoke admin.
// Selalu cek ulang ke database (bukan cuma percaya isi token) supaya perubahan role/
// status/revoke oleh admin langsung berlaku tanpa perlu logout-login ulang.
//
// opts.cache = true (hanya untuk endpoint BACA yang di-polling terus-menerus): hasil lookup
// dipakai ulang maksimal 5 detik, jadi puluhan klien yang polling tidak membuat puluhan query
// per detik ke tabel users. Akibatnya revoke/nonaktif akun baru berlaku di endpoint baca itu
// dalam <= 5 detik. Endpoint yang MENGUBAH data selalu cek langsung ke database.
const USER_CACHE_MS = 5000;
const userCache = new Map();

async function getUserFromReq(req, opts) {
  const cookies = parseCookies(req);
  const payload = verifyToken(cookies[COOKIE_NAME]);
  if (!payload) return null;

  const useCache = !!(opts && opts.cache);
  if (useCache) {
    const hit = userCache.get(payload.userId);
    if (hit && Date.now() - hit.at < USER_CACHE_MS) {
      const v = payload.tokenVersion === undefined ? 1 : payload.tokenVersion;
      return v === hit.user.token_version ? hit.user : null;
    }
  }

  const result = await pool.query(
    `SELECT u.id, u.username, u.role, u.unit_id, u.status, u.token_version, un.name AS unit_name,
            u.fleet_id, f.name AS fleet_name, u.work_pit_id, u.work_set, wp.name AS work_pit_name
     FROM users u
     LEFT JOIN units un ON un.id = u.unit_id
     LEFT JOIN fleets f ON f.id = u.fleet_id
     LEFT JOIN pits wp ON wp.id = u.work_pit_id
     WHERE u.id = $1`,
    [payload.userId]
  );
  const user = result.rows[0];
  if (!user) return null;
  if (user.status !== "active") return null;

  // Token lama (sebelum fitur ini ada) tidak punya field tokenVersion -- anggap versi 1
  // supaya deploy fitur ini TIDAK memaksa semua orang logout mendadak. Token_version di
  // database juga mulai dari 1, jadi baru mismatch kalau admin benar-benar revoke.
  const tokenVersion = payload.tokenVersion === undefined ? 1 : payload.tokenVersion;
  if (tokenVersion !== user.token_version) return null;

  if (useCache) {
    if (userCache.size > 500) userCache.clear();
    userCache.set(payload.userId, { user, at: Date.now() });
  }
  return user;
}

module.exports = {
  hashPasswordAsync,
  verifyPasswordAsync,
  hashPassword,
  verifyPassword,
  createSessionForUser,
  clearSessionCookie,
  getUserFromReq,
};
