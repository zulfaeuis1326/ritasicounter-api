const { pool, ensureSchema } = require("../../lib/db");
const { getUserFromReq } = require("../../lib/auth");
const { atLeast } = require("../../lib/roles");
const { logActivity } = require("../../lib/activity");

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method === "GET") {
      // Publik (tidak wajib login) -- dipakai juga oleh halaman Daftar Akun.
      // Sengaja HANYA balikin id+nama kalau belum login -- detail assignment fleet/PIT
      // (data operasional internal) cuma buat yang sudah login, supaya orang luar yang
      // nemu URL register gak bisa intip struktur fleet/lokasi tambang cuma dari sini.
      const loggedInUser = await getUserFromReq(req).catch(() => null);
      if (loggedInUser) {
        const result = await pool.query(
          `SELECT u.id, u.name, u.fleet_id, f.name AS fleet_name, u.pit_id, p.name AS pit_name
           FROM units u
           LEFT JOIN fleets f ON f.id = u.fleet_id
           LEFT JOIN pits p ON p.id = u.pit_id
           WHERE u.active = true ORDER BY u.name`
        );
        return res.status(200).json(result.rows);
      }
      const publicResult = await pool.query(
        `SELECT id, name FROM units WHERE active = true ORDER BY name`
      );
      return res.status(200).json(publicResult.rows);
    }

    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });

    if (req.method === "POST") {
      const { action } = req.body || {};

      if (action === "assign_fleet") {
        if (!atLeast(user.role, "pengawas")) {
          return res.status(403).json({ error: "Hanya pengawas ke atas yang bisa assign fleet" });
        }
        const { unitId, fleetId } = req.body || {};
        if (!unitId) return res.status(400).json({ error: "unitId wajib diisi" });
        await pool.query(`UPDATE units SET fleet_id = $1 WHERE id = $2`, [fleetId || null, unitId]);
        await logActivity(user.id, "assign_fleet", { unitId, fleetId: fleetId || null });
        return res.status(200).json({ ok: true });
      }

      if (action === "set_pit") {
        if (!atLeast(user.role, "pengawas")) {
          return res.status(403).json({ error: "Hanya pengawas ke atas yang bisa ubah PIT unit" });
        }
        const { unitId, pitId } = req.body || {};
        if (!unitId) return res.status(400).json({ error: "unitId wajib diisi" });
        await pool.query(`UPDATE units SET pit_id = $1 WHERE id = $2`, [pitId || null, unitId]);
        await logActivity(user.id, "set_unit_pit", { unitId, pitId: pitId || null });
        return res.status(200).json({ ok: true });
      }

      // Cek fleet/PIT tujuan benar-benar ada dan aktif (id kosong/null = melepas, dianggap sah).
      async function refExists(table, id) {
        if (id === null || id === undefined || id === "") return true;
        const t = table === "fleets" ? "fleets" : "pits"; // nama tabel tetap dari kode, bukan dari input
        const r = await pool.query(`SELECT 1 FROM ${t} WHERE id = $1 AND active = true`, [Number(id)]);
        return r.rows.length > 0;
      }

      // Penempatan massal: banyak HD sekaligus -> PC dan/atau PIT, dalam SATU pernyataan SQL (atomik).
      if (action === "bulk_assign") {
        if (!atLeast(user.role, "pengawas")) {
          return res.status(403).json({ error: "Hanya pengawas ke atas yang bisa menempatkan unit" });
        }
        const { setFleet, fleetId, setPit, pitId } = req.body || {};
        const ids = Array.isArray(req.body?.unitIds) ? req.body.unitIds.map(Number).filter(Number.isInteger) : [];
        if (ids.length === 0 || ids.length > 500) {
          return res.status(400).json({ error: "Pilih 1 sampai 500 unit" });
        }
        if (!setFleet && !setPit) return res.status(400).json({ error: "Tidak ada PC atau PIT tujuan yang dipilih" });
        if (setFleet && !(await refExists("fleets", fleetId))) return res.status(400).json({ error: "PC tujuan tidak ditemukan" });
        if (setPit && !(await refExists("pits", pitId))) return res.status(400).json({ error: "Lokasi (PIT) tujuan tidak ditemukan" });

        const sets = [];
        const params = [ids];
        if (setFleet) { params.push(fleetId ? Number(fleetId) : null); sets.push(`fleet_id = $${params.length}`); }
        if (setPit) { params.push(pitId ? Number(pitId) : null); sets.push(`pit_id = $${params.length}`); }
        const r = await pool.query(
          `UPDATE units SET ${sets.join(", ")} WHERE id = ANY($1::int[]) AND active = true RETURNING id`,
          params
        );
        await logActivity(user.id, "bulk_assign_units", {
          count: r.rowCount, fleetId: setFleet ? (fleetId || null) : "tetap", pitId: setPit ? (pitId || null) : "tetap",
        });
        return res.status(200).json({ ok: true, updated: r.rowCount });
      }

      // Tambah banyak HD sekaligus (satu nama per baris), langsung bisa ditempatkan ke PC/PIT.
      if (action === "create_many") {
        if (!atLeast(user.role, "admin")) {
          return res.status(403).json({ error: "Hanya admin/superadmin yang bisa menambah unit" });
        }
        const { fleetId, pitId } = req.body || {};
        const names = Array.from(new Set((Array.isArray(req.body?.names) ? req.body.names : [])
          .map((n) => String(n).trim()).filter(Boolean))).slice(0, 200);
        if (names.length === 0) return res.status(400).json({ error: "Isi minimal satu nama unit" });
        if (names.some((n) => n.length > 40)) return res.status(400).json({ error: "Nama unit maksimal 40 karakter" });
        if (!(await refExists("fleets", fleetId))) return res.status(400).json({ error: "PC tujuan tidak ditemukan" });
        if (!(await refExists("pits", pitId))) return res.status(400).json({ error: "Lokasi (PIT) tujuan tidak ditemukan" });
        const r = await pool.query(
          `INSERT INTO units (name, fleet_id, pit_id)
           SELECT n, $2::int, $3::int FROM unnest($1::text[]) AS n
           ON CONFLICT (name) WHERE active = true DO NOTHING
           RETURNING name`,
          [names, fleetId ? Number(fleetId) : null, pitId ? Number(pitId) : null]
        );
        const created = r.rows.map((x) => x.name);
        const skipped = names.filter((n) => !created.includes(n));
        await logActivity(user.id, "create_units", { created: created.length, skipped: skipped.length });
        return res.status(201).json({ created: created.length, skipped });
      }

      if (!atLeast(user.role, "admin")) {
        return res.status(403).json({ error: "Hanya admin/superadmin yang bisa menambah unit" });
      }
      const { name } = req.body || {};
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Nama unit wajib diisi" });
      }
      try {
        const result = await pool.query(
          `INSERT INTO units (name) VALUES ($1) RETURNING id, name`,
          [name.trim()]
        );
        await logActivity(user.id, "create_unit", { unitId: result.rows[0].id, name: result.rows[0].name });
        return res.status(201).json(result.rows[0]);
      } catch (err) {
        if (err.code === "23505") {
          return res.status(409).json({ error: "Unit dengan nama itu sudah ada" });
        }
        throw err;
      }
    }

    if (req.method === "DELETE") {
      if (!atLeast(user.role, "admin")) {
        return res.status(403).json({ error: "Hanya admin/superadmin yang bisa menghapus unit" });
      }
      const { id } = req.body || {};
      await pool.query(`UPDATE units SET active = false WHERE id = $1`, [id]);
      await logActivity(user.id, "delete_unit", { unitId: id });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).end();
  } catch (err) {
    console.error("Error di /api/units:", err);
    return res.status(500).json({ error: "Terjadi kesalahan pada server. Coba lagi, atau hubungi admin kalau berulang." });
  }
}
