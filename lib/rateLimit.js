// Pembatas percobaan sederhana (in-memory, per instance server) buat nahan brute-force
// login/register. CATATAN: karena disimpan di memory proses, ini reset kalau server
// restart/cold-start dan TIDAK sinkron antar beberapa instance (kalau nanti scale
// horizontal). Cukup buat MVP/tahap awal -- kalau traffic sudah besar, ganti ke
// penyimpanan bersama (mis. Redis/Upstash) supaya konsisten across instance.
const buckets = new Map();

// Beres-beres bucket lama tiap ~10 menit biar memory gak terus numpuk.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > 30 * 60 * 1000) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref?.();

function checkRateLimit(key, { max, windowMs }) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - bucket.start)) / 1000) };
  }
  return { allowed: true };
}

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

module.exports = { checkRateLimit, getClientIp };
