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

      const unitRes = await pool.query(
        `SELECT fleet_id, pit_id FROM units WHERE id = $1 AND active = true`,
        [unitId]
      );
      if (unitRes.rows.length === 0) {
        return res.status(404).json({ error: "Unit tidak ditemukan / sudah tidak aktif" });
      }

      // Kunci idempotensi (opsional, dikirim klien). Kunci sama = klik yang sama
      // (retry jaringan / ketuk ganda), jadi tidak dicatat dua kali.
      let requestId = req.body?.clientRequestId;
      if (requestId !== undefined && requestId !== null) {
        requestId = String(requestId);
        if (requestId.length === 0 || requestId.length > 64) {
          return res.status(400).json({ error: "clientRequestId tidak valid" });
        }
      } else {
        requestId = null;
      }

      // Jumlah rit sekaligus (qty) hanya untuk pengawas ke atas, mis. dari laporan radio.
      // Operator selalu 1 rit per ketukan. Satu pernyataan INSERT = atomik (semua masuk atau tidak sama sekali).
      const isSupervisor = !lockedUnitId;
      let qty = 1;
      if (isSupervisor && req.body?.qty !== undefined && req.body?.qty !== null) {
        qty = Number(req.body.qty);
        if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
          return res.status(400).json({ error: "Jumlah rit harus bilangan bulat 1-50" });
        }
      }

      const inserted = await pool.query(
        `INSERT INTO ritasi_clicks (unit_id, shift_id, material, jam, operator_id, fleet_id, pit_id, client_request_id, entry_mode)
         SELECT $1::int, $2::int, $3::text, $4::int, $5::int, $6::int, $7::int,
                CASE WHEN $8::text IS NULL THEN NULL ELSE $8::text || ':' || g END,
                $9::text
         FROM generate_series(1, $10::int) AS g
         ON CONFLICT (client_request_id) WHERE client_request_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [unitId, shift.id, material, jam, user.id, unitRes.rows[0].fleet_id, unitRes.rows[0].pit_id,
         requestId, isSupervisor ? "pengawas" : "operator", qty]
      );
      const duplicate = inserted.rows.length === 0;

      const recap = await buildRecap(shift.id, lockedUnitId, lockedOperatorId);
      return res
        .status(duplicate ? 200 : 201)
        .json({ currentHour, tzInfo: `${TZ_NAME} (UTC+${OFFSET_HOURS})`, duplicate, clickId: duplicate ? null : inserted.rows[0].id, clickIds: inserted.rows.map(function (x) { return x.id; }), qty, ...recap });
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
    return res.status(500).json({ error: err.message });
  }
}
