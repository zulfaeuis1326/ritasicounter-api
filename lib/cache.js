// Cache memori sederhana di sisi server dengan TTL pendek.
// Dipakai supaya banyak klien yang polling data yang sama hanya memicu satu query per jendela waktu.
// Catatan: cache ini per proses. Di hosting serverless tiap instance punya cache sendiri,
// jadi cocoknya untuk TTL pendek (hitungan detik), bukan untuk data yang harus konsisten.

const store = new Map(); // key -> { value, expires }
const inflight = new Map(); // key -> Promise (cegah query dobel saat banyak request bersamaan)
const MAX_ENTRIES = 500;

async function cached(key, ttlMs, fn) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value;

  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const value = await fn();
      if (store.size >= MAX_ENTRIES) store.clear();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// Hapus semua entri yang key-nya diawali prefix. Tanpa argumen = hapus semuanya.
function clearCache(prefix) {
  if (!prefix) { store.clear(); return; }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

module.exports = { cached, clearCache };
