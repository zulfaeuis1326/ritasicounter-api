const pad = (h) => String(h).padStart(2, "0") + ":00";

// Susun teks laporan WhatsApp: PIT > Fleet > Hauler, lengkap dengan jam, jumlah, material, keterangan.
// recap : hasil GET /api/ritasi (units[].hourly, hours, shift.label)
// opts  : { pit, fromIdx, toIdx, perJam, onlyActive, notes }  (notes = { [unitId]: "teks" })
function buildWaText(recap, opts) {
  const o = opts || {};
  const notes = o.notes || {};
  if (!recap || !recap.units) return "";
  const hours = recap.hours || [];
  if (hours.length === 0) return "";
  const from = Number.isInteger(o.fromIdx) ? o.fromIdx : 0;
  const to = Number.isInteger(o.toIdx) ? o.toIdx : hours.length - 1;
  const onlyActive = o.onlyActive !== false;

  const pitMap = new Map();
  recap.units.forEach((u) => {
    const pitName = u.pit_name || "Belum ada PIT";
    if (o.pit && pitName !== o.pit) return;

    let total = 0;
    const mats = {};
    const jamParts = [];
    (u.hourly || []).slice(from, to + 1).forEach((h) => {
      if (!h.total) return;
      total += h.total;
      jamParts.push(pad(h.jam) + "=" + h.total);
      Object.entries(h.materials || {}).forEach(([m, n]) => { mats[m] = (mats[m] || 0) + n; });
    });
    const note = String(notes[u.id] || "").trim();
    if (onlyActive && total === 0 && !note) return;

    if (!pitMap.has(pitName)) pitMap.set(pitName, { name: pitName, total: 0, fleets: new Map() });
    const p = pitMap.get(pitName);
    const fleetName = u.fleet_name || "Belum ada Fleet";
    if (!p.fleets.has(fleetName)) p.fleets.set(fleetName, { name: fleetName, total: 0, units: [] });
    const f = p.fleets.get(fleetName);
    f.units.push({ name: u.name, total, mats, jamParts, note });
    f.total += total;
    p.total += total;
  });

  if (pitMap.size === 0) return "Belum ada data ritasi pada rentang ini.";

  const lines = [];
  lines.push("*LAPORAN RITASI*");
  lines.push((recap.shift && recap.shift.label) || "Shift berjalan");
  lines.push("Jam " + pad(hours[from]) + " s/d " + String(hours[to]).padStart(2, "0") + ":59");

  let grand = 0;
  Array.from(pitMap.values()).sort((a, b) => a.name.localeCompare(b.name)).forEach((p) => {
    grand += p.total;
    lines.push("");
    // Nama yang sudah diawali "PIT" (mis. "PIT FSP") tidak diberi awalan lagi
    const pitLabel = /^pit\b/i.test(p.name) ? p.name : "PIT " + p.name;
    lines.push("*" + pitLabel + "* - " + p.total + " rit");
    Array.from(p.fleets.values()).forEach((f) => {
      lines.push("");
      lines.push("*" + f.name + "* - " + f.total + " rit (" + f.units.length + " HD)");
      f.units.forEach((u, i) => {
        const matStr = Object.entries(u.mats).map(([m, n]) => m + " " + n).join(", ");
        lines.push((i + 1) + ". " + u.name + " - " + u.total + " rit" + (matStr ? " | " + matStr : ""));
        if (o.perJam && u.jamParts.length) lines.push("   Jam: " + u.jamParts.join(", "));
        if (u.note) lines.push("   Ket: " + u.note);
      });
    });
  });
  lines.push("");
  lines.push("*TOTAL: " + grand + " rit*");
  return lines.join("\n");
}

module.exports = { buildWaText };
