import { useState } from "react";

const MATERIALS = ["OB", "COAL", "SOIL", "SOLU", "MUD"];

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
    </svg>
  );
}

export default function RekapTable({ allRecapUnits, showAllUnits, setShowAllUnits, canMonitorAll, recap, onExport }) {
  const [search, setSearch] = useState("");

  const base = showAllUnits ? allRecapUnits : allRecapUnits.filter(function (u) { return u.total > 0; });
  const visible = search.trim()
    ? base.filter(function (u) {
        const q = search.trim().toLowerCase();
        return u.name.toLowerCase().includes(q)
          || (u.fleet_name || "").toLowerCase().includes(q)
          || (u.pit_name || "").toLowerCase().includes(q);
      })
    : base;

  return (
    <section className="card">
      <h2 className="sec-title-icon">Rekap Shift Ini (per unit)</h2>
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
        {canMonitorAll && (
          <button className="btn btn-primary rekap-export-btn" onClick={onExport} disabled={!recap || !recap.shift}>
            <ExportIcon /> Export
          </button>
        )}
      </div>
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
