const { pool, ensureSchema } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");

// Data hasil pembacaan foto "Setting Man Power" — 42 PC (fleet/loader) + 124 HD (hauler).
// Sudah dikoreksi user: baris "SPARE" (operator tanpa unit) & 2 unit dozer yang salah taruh
// di tabel PC (D5878, D5877) sudah dibuang duluan.
const PC_DATA = [
  ["E52003", "TIWA SELATAN"], ["E52005", "TIWA SELATAN"], ["E52008", "TIWA SELATAN"],
  ["E52011", "TIWA SELATAN"], ["E52017", "TIWA SELATAN"], ["E52021", "TIWA SELATAN"],
  ["E52024", "TIWA SELATAN"], ["E52026", "TIWA SELATAN"], ["E52031", "TIWA SELATAN"],
  ["E52034", "TIWA SELATAN"], ["E52035", "TIWA SELATAN"], ["E52036", "TIWA SELATAN"],
  ["E52037", "TIWA SELATAN"], ["E52038", "TIWA SELATAN"], ["E52039", "TIWA SELATAN"],
  ["E51227", "TIWA SELATAN"], ["E51226", "TIWA SELATAN"], ["E51201", "TIWA SELATAN"],
  ["E3903PPA", "TIWA SELATAN"], ["E53911", "TIWA SELATAN"], ["E3902PPA", "TIWA SELATAN"],
  ["E5513", "TIWA SELATAN"], ["E5311", "TIWA SELATAN"], ["E5117", "TIWA SELATAN"],
  ["E2161PPA", "TIWA SELATAN"], ["E5150 (LC)", "TIWA SELATAN"], ["E5184", "TIWA SELATAN"],
  ["E2117", "TIWA SELATAN"], ["E2192PPA", "TIWA SELATAN"],
  ["E52001", "PIT FSP"], ["E52018", "PIT FSP"], ["E52025", "PIT FSP"], ["E52030", "PIT FSP"],
  ["E52032", "PIT FSP"], ["E51225", "PIT FSP"], ["E53915", "PIT FSP"], ["E430PPA", "PIT FSP"],
  ["E5183", "PIT FSP"], ["E2118", "PIT FSP"], ["E5119 (LC)", "PIT FSP"],
  ["E431PPA", "KM 92"], ["E5309", "PIT FSP"],
];

const HD_DATA = [
  ["H57199","TIWA SELATAN"],["H57202","TIWA SELATAN"],["H57203","TIWA SELATAN"],["H57204","TIWA SELATAN"],
  ["H57205","TIWA SELATAN"],["H57206","TIWA SELATAN"],["H57227","TIWA SELATAN"],["H57228","TIWA SELATAN"],
  ["H57232","TIWA SELATAN"],["H57239","TIWA SELATAN"],["H57249","TIWA SELATAN"],["H57250","TIWA SELATAN"],
  ["H57251","TIWA SELATAN"],["H57253","TIWA SELATAN"],["H57254","TIWA SELATAN"],["H57256","TIWA SELATAN"],
  ["H57257","TIWA SELATAN"],["H57265","TIWA SELATAN"],["H57273","TIWA SELATAN"],["H57274","TIWA SELATAN"],
  ["H57275","TIWA SELATAN"],["H57276","TIWA SELATAN"],["H57277","TIWA SELATAN"],["H57278","TIWA SELATAN"],
  ["H57279","TIWA SELATAN"],["H57319","TIWA SELATAN"],["H57320","TIWA SELATAN"],["H57321","TIWA SELATAN"],
  ["H57325","TIWA SELATAN"],["H57327","TIWA SELATAN"],["H57328","TIWA SELATAN"],["H57329","TIWA SELATAN"],
  ["H57331","TIWA SELATAN"],["H57332","TIWA SELATAN"],["H57333","TIWA SELATAN"],["H57335","TIWA SELATAN"],
  ["H57336","TIWA SELATAN"],["H57334","TIWA SELATAN"],["H57330","TIWA SELATAN"],["H57337","TIWA SELATAN"],
  ["H57339","TIWA SELATAN"],["H57338","TIWA SELATAN"],["H7446","TIWA SELATAN"],["H57207","TIWA SELATAN"],
  ["H57230","TIWA SELATAN"],["H57233","TIWA SELATAN"],
  ["H57104 (COAL)","TIWA SELATAN"],["H57133 (COAL)","TIWA SELATAN"],["H57324 (COAL)","TIWA SELATAN"],
  ["H57326 (COAL)","TIWA SELATAN"],["H57229 (COAL)","TIWA SELATAN"],["H57252 (COAL)","TIWA SELATAN"],
  ["H57255 (COAL)","TIWA SELATAN"],["H57322 (COAL)","TIWA SELATAN"],["H57323 (COAL)","TIWA SELATAN"],
  ["C577078 (COAL)","TIWA SELATAN"],["C577079 (COAL)","TIWA SELATAN"],["C577080 (COAL)","TIWA SELATAN"],
  ["H78440 (COAL)","TIWA SELATAN"],["H78445 (COAL)","TIWA SELATAN"],["H7441 (COAL)","TIWA SELATAN"],
  ["H7442 (COAL)","TIWA SELATAN"],["H7443 (COAL)","TIWA SELATAN"],["H7447 (COAL)","TIWA SELATAN"],
  ["H7448 (COAL)","TIWA SELATAN"],["H7449 (COAL)","TIWA SELATAN"],["H57231 (COAL)","TIWA SELATAN"],
  ["H7444 (COAL)","TIWA SELATAN"],
  ["C577003","TIWA SELATAN"],["C577004","TIWA SELATAN"],["C577005","TIWA SELATAN"],["C577007","TIWA SELATAN"],
  ["C577022","TIWA SELATAN"],["C577034","TIWA SELATAN"],["C577049","TIWA SELATAN"],["C577052","TIWA SELATAN"],
  ["C77055PPA","TIWA SELATAN"],["C77056PPA","TIWA SELATAN"],["C77058PPA","TIWA SELATAN"],["C77059PPA","TIWA SELATAN"],
  ["C77060PPA","TIWA SELATAN"],["C77061PPA","TIWA SELATAN"],["C77083PPA","TIWA SELATAN"],["C77064PPA","TIWA SELATAN"],
  ["C577093","TIWA SELATAN"],["C577094","TIWA SELATAN"],
  ["H5003","PIT FSP"],["H5010","PIT FSP"],["H57056","PIT FSP"],["H57103","PIT FSP"],["H57107","PIT FSP"],
  ["H57108","PIT FSP"],["H57109","PIT FSP"],["H57110","PIT FSP"],["H57111","PIT FSP"],["H57170","PIT FSP"],
  ["H57135","PIT FSP"],["H57200","PIT FSP"],["H57201","PIT FSP"],
  ["H57053 (COAL)","PIT FSP"],["C577040 (COAL)","PIT FSP"],["C577041 (COAL)","PIT FSP"],["C577081 (COAL)","PIT FSP"],
  ["SRT053","PIT FSP"],["SRT054","PIT FSP"],["SRT055","PIT FSP"],["SRT058","PIT FSP"],["SRT056","PIT FSP"],
  ["SRT057","PIT FSP"],["SRT059","PIT FSP"],["SRT060","PIT FSP"],["SRT061","PIT FSP"],["SRT062","PIT FSP"],
  ["SRT063","PIT FSP"],["SRT064","PIT FSP"],["SRT065","PIT FSP"],["SRT066","PIT FSP"],["SRT067","PIT FSP"],
  ["SRT068","PIT FSP"],["SRT069","PIT FSP"],["SRT070","PIT FSP"],["SRT071","PIT FSP"],["SRT072","PIT FSP"],
  ["SRT073","PIT FSP"],
];

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user || user.role !== "superadmin") {
      return res.status(403).json({ error: "Hanya superadmin yang bisa menjalankan import ini" });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    async function pitId(name) {
      const r = await pool.query(`SELECT id FROM pits WHERE name = $1 AND active = true`, [name]);
      return r.rows.length ? r.rows[0].id : null;
    }

    let fleetsCreated = 0, fleetsSkipped = 0, unitsCreated = 0, unitsSkipped = 0;

    for (const [name, pitName] of PC_DATA) {
      const pid = await pitId(pitName);
      const existing = await pool.query(`SELECT id FROM fleets WHERE name = $1 AND active = true`, [name]);
      if (existing.rows.length > 0) { fleetsSkipped++; continue; }
      await pool.query(`INSERT INTO fleets (name, pit_id) VALUES ($1, $2)`, [name, pid]);
      fleetsCreated++;
    }

    for (const [name, pitName] of HD_DATA) {
      const pid = await pitId(pitName);
      const existing = await pool.query(`SELECT id FROM units WHERE name = $1 AND active = true`, [name]);
      if (existing.rows.length > 0) { unitsSkipped++; continue; }
      await pool.query(`INSERT INTO units (name, pit_id) VALUES ($1, $2)`, [name, pid]);
      unitsCreated++;
    }

    return res.status(200).json({
      ok: true,
      fleets: { created: fleetsCreated, skipped: fleetsSkipped },
      units: { created: unitsCreated, skipped: unitsSkipped },
    });
  } catch (err) {
    console.error("Error di /api/admin/import-roster:", err);
    return res.status(500).json({ error: err.message });
  }
}
