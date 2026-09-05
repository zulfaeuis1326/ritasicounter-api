const { pool, ensureSchema } = require("../../lib/db");
const { getOrCreateOpenShift } = require("../../lib/shift");
const { buildRecap, isHourWithinShift } = require("../../lib/recap");
const { nowParts, TZ_NAME, OFFSET_HOURS } = require("../../lib/time");
const { MATERIALS } = require("../../lib/materials");
const { getUserFromReq } = require("../../lib/auth");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });

    if (user.role === "operator" && !user.unit_id) {
      return res.status(409).json({ error: "NEEDS_UNIT_SETUP" });
    }
    // Operator terkunci ke unit-nya sendiri, dan cuma lihat klik yang dia sendiri input.
    const lockedUnitId = user.role === "operator" ? user.unit_id : null;
    const lockedOperatorId = user.role === "operator" ? user.id : null;

    if (req.method === "POST") {
      const { material } = req.body || {};
      const unitId = lockedUnitId || req.body?.unitId;
      if (!unitId || !MATERIALS.includes(material)) {
        return res.status(400).json({ error: "unitId dan material (valid) wajib diisi" });
      }
      if (lockedUnitId && Number(unitId) !== lockedUnitId) {
        return res.status(403).json({ error: "Kamu hanya bisa input untuk unit kamu sendiri" });
      }

      const shift = await getOrCreateOpenShift();
      const currentHour = nowParts().hour;

      // Jam manual (opsional) — buat nutup ritasi yang kelewat karena operator baru bisa
      // input pas unit berhenti (gak boleh pegang HP saat jalan). Default: jam sekarang.
      let jam = currentHour;
      const rawJam = req.body?.jam;
      if (rawJam !== undefined && rawJam !== null && rawJam !== "") {
        const requestedJam = Number(rawJam);
        if (!Number.isInteger(requestedJam) || requestedJam < 0 || requestedJam > 23) {
          return res.status(400).json({ error: "Jam tidak valid" });
        }
        if (!isHourWithinShift(shift.shift_type, requestedJam, currentHour)) {
          return res.status(400).json({ error: "Jam yang dipilih di luar rentang shift berjalan (tidak boleh jam yang belum terjadi)" });
        }
        jam = requestedJam;
      }

      await pool.query(
        `INSERT INTO ritasi_clicks (unit_id, shift_id, material, jam, operator_id) VALUES ($1, $2, $3, $4, $5)`,
        [unitId, shift.id, material, jam, user.id]
      );

      const recap = await buildRecap(shift.id, lockedUnitId, lockedOperatorId);
      return res.status(201).json({ currentHour, tzInfo: `${TZ_NAME} (UTC+${OFFSET_HOURS})`, ...recap });
    }

    if (req.method === "GET") {
      const shift = await getOrCreateOpenShift();
      const recap = await buildRecap(shift.id, lockedUnitId, lockedOperatorId);
      return res.status(200).json({ currentHour: nowParts().hour, tzInfo: `${TZ_NAME} (UTC+${OFFSET_HOURS})`, ...recap });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (err) {
    console.error("Error di /api/ritasi:", err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
