const { pool } = require("./db");

// Catat aksi-aksi sensitif (hapus akun, ubah role, approve akun baru, revoke sesi, dst)
// buat audit trail -- kalau ada yang dipertanyakan ("siapa yang hapus unit ini?"),
// ada jejaknya. Dibungkus try/catch: kalau logging-nya sendiri gagal, JANGAN sampai
// bikin aksi utamanya ikut gagal.
async function logActivity(actorId, action, detail) {
  try {
    await pool.query(
      `INSERT INTO activity_log (actor_id, action, detail) VALUES ($1, $2, $3)`,
      [actorId || null, action, detail ? JSON.stringify(detail) : null]
    );
  } catch (err) {
    console.error("Gagal mencatat activity_log:", err);
  }
}

module.exports = { logActivity };
