import { useState, useEffect } from "react";

const MATERIALS = ["OB", "COAL", "SOIL", "SOLU", "MUD"];
const ALL_HOURS = Array.from({ length: 24 }, function (_, i) { return i; });

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
    </svg>
  );
}
function WhatsappIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 20 12a8 8 0 0 1-8 8zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.6.1s-.6.8-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4L9 10.2c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3a2.3 2.3 0 0 0-.7 1.7c0 1 .7 2 .8 2.1.1.2 1.4 2.3 3.5 3.1 1.9.8 1.9.5 2.2.5.4 0 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1z" />
    </svg>
  );
}

function buildWaMessage(units, shift, currentHour) {
  const active = units.filter(function (u) { return u.total > 0; });
  const lines = [];
  lines.push("*LAPORAN RITASI*");
  if (shift) lines.push(shift.label);
  lines.push("Jam: " + String(currentHour).padStart(2, "0") + ":00");
  lines.push("");
  if (active.length === 0) {
    lines.push("Belum ada ritasi tercatat.");
  } else {
    active.forEach(function (u) {
      lines.push("- " + u.name + " (" + (u.fleet_name || "-") + "): " + u.total + " rit");
    });
  }
  const grandTotal = active.reduce(function (s, u) { return s + u.total; }, 0);
  lines.push("");
  lines.push("Total keseluruhan: " + grandTotal + " rit");
  return lines.join("\n");
}

export default function RekapTable({ allRecapUnits, showAllUnits, setShowAllUnits, canMonitorAll, isAdmin, recap, onExport, reportHours, onSaveReportHours }) {
  const [search, setSearch] = useState("");
  const [settingOpen, setSettingOpen] = useState(false);
  const [draftHours, setDraftHours] = useState(reportHours || []);

  useEffect(function () {
    if (!settingOpen) setDraftHours(reportHours || []);
  }, [reportHours, settingOpen]);

  const base = showAllUnits ? allRecapUnits : allRecapUnits.filter(function (u) { return u.total > 0; });
  const visible = search.trim()
    ? base.filter(function (u) {
        const q = search.trim().toLowerCase();
        return u.name.toLowerCase().includes(q)
          || (u.fleet_name || "").toLowerCase().includes(q)
          || (u.pit_name || "").toLowerCase().includes(q);
      })
    : base;

  const currentHour = recap ? recap.currentHour : null;
  const isReportHour = currentHour !== null && (reportHours || []).includes(currentHour);

  function handleShareWa() {
    const text = buildWaMessage(allRecapUnits, recap ? recap.shift : null, currentHour);
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
  }

  function toggleDraftHour(h) {
    setDraftHours(function (prev) {
      return prev.includes(h) ? prev.filter(function (x) { return x !== h; }) : [...prev, h].sort(function (a, b) { return a - b; });
    });
  }

  return (
    <section className="card">
      <h2 className="sec-title-icon">Rekap Shift Ini (per unit)</h2>

      {isReportHour && (
        <div className="report-hour-banner">
          Ini jam laporan ({String(currentHour).padStart(2, "0")}:00) — udah waktunya share rekap.
        </div>
      )}

      <div className="rekap-tools">
        <input
          className="rekap-search"
          value={search}
          onChange={function (e) { setSearch(e.target.value); }}
          placeholder="Cari unit / fleet / PIT..."
        />
        <label className="rekap-toggle">
          <input
            type="checkbox"
            checked={!showAllUnits}
            onChange={function (e) { setShowAllUnits(!e.target.checked); }}
          />
          Hanya ada ritasi
        </label>
        <button className="btn btn-primary rekap-share-btn" onClick={handleShareWa} disabled={!recap || !recap.shift}>
          <WhatsappIcon /> Share ke WA
        </button>
        {canMonitorAll && (
          <button className="btn btn-primary rekap-export-btn" onClick={onExport} disabled={!recap || !recap.shift}>
            <ExportIcon /> Export
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="report-hour-setting">
          <button className="report-hour-toggle" onClick={function () { setSettingOpen(!settingOpen); }}>
            Setting jam laporan {settingOpen ? "▲" : "▼"}
          </button>
          {settingOpen && (
            <div className="report-hour-panel">
              <p className="hint">Pilih jam-jam yang mau ditandai sebagai "jam laporan" (banner share bakal muncul otomatis pas jam itu).</p>
              <div className="report-hour-grid">
                {ALL_HOURS.map(function (h) {
                  return (
                    <button
                      key={h}
                      type="button"
                      className={"report-hour-chip" + (draftHours.includes(h) ? " active" : "")}
                      onClick={function () { toggleDraftHour(h); }}
                    >
                      {String(h).padStart(2, "0")}
                    </button>
                  );
                })}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={function () { onSaveReportHours(draftHours); setSettingOpen(false); }}>
                Simpan
              </button>
            </div>
          )}
        </div>
      )}

      <div className="table-scroll">
        <table className="list-table">
          <thead>
            <tr>
              <th>Unit</th><th>Fleet</th><th>PIT</th>
              {MATERIALS.map(function (m) { return <th key={m}>{m}</th>; })}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(function (u) {
              return (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.name}</td>
                  <td>{u.fleet_name || "-"}</td>
                  <td>{u.pit_name || "-"}</td>
                  {MATERIALS.map(function (m) {
                    return <td key={m}>{(u.materialTotals && u.materialTotals[m]) || 0}</td>;
                  })}
                  <td style={{ fontWeight: 700 }}>{u.total}</td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={4 + MATERIALS.length} className="hint">Gak ada unit yang cocok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
