import Combobox from "../Combobox";

const MATERIALS = ["OB", "COAL", "SOIL", "SOLU", "MUD"];

function formatJamCell(h) {
  if (!h || h.total === 0) return "-";
  const entries = Object.entries(h.materials || {});
  if (entries.length === 0) return "-";
  if (entries.length === 1) return entries[0][0] + " x" + entries[0][1];
  return entries.map(function (e) { return e[0] + ":" + e[1]; }).join(", ");
}

export default function RitasiPanel({
  isAdmin,
  authUser,
  units,
  selectedUnit,
  onChangeSelectedUnit,
  onDeleteUnit,
  material,
  onChangeMaterial,
  selectedJam,
  onOpenJamModal,
  recap,
  currentHourData,
  selectedUnitRecap,
  loadingClick,
  onClick,
}) {
  return (
    <section className="card">
      <h2 className="sec-title-icon">Klik Ritasi</h2>

      <div className="field-label" style={{ marginBottom: 6 }}>Unit</div>
      {isAdmin ? (
        <>
          <Combobox
            value={selectedUnit}
            onChange={onChangeSelectedUnit}
            options={units.map(function (u) { return { value: String(u.id), label: u.name }; })}
            placeholder="Cari unit..."
            emptyLabel={units.length === 0 ? "Belum ada unit" : null}
          />
          {selectedUnit && (
            <button
              className="btn"
              style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", marginTop: 4, marginBottom: 10 }}
              onClick={function () { onDeleteUnit(selectedUnit); }}
            >
              Hapus Unit Ini
            </button>
          )}
        </>
      ) : (
        <div className="hint" style={{ fontSize: 16, color: "var(--text)", marginBottom: 10 }}>
          Unit kamu: <b>{authUser.unit_name}</b> (terkunci sampai logout)
        </div>
      )}

      <div className="field-label" style={{ marginBottom: 6, marginTop: 12 }}>Klik Material (+1 Rit)</div>
      <div className="mat-grid">
        {MATERIALS.map(function (m) {
          const count = selectedUnitRecap && selectedUnitRecap.materialTotals ? (selectedUnitRecap.materialTotals[m] || 0) : 0;
          return (
            <button
              key={m}
              className={"mat-btn " + (material === m ? "active" : "")}
              onClick={function () { onChangeMaterial(m); }}
            >
              {m}
              <span className="mat-btn-cnt">{count} rit</span>
            </button>
          );
        })}
      </div>

      <div className="ritasi-jam-row">
        <div>
          <div className="field-label" style={{ marginBottom: 2 }}>Jam Ritasi</div>
          <div className="hint" style={{ marginBottom: 0 }}>
            {selectedJam === "" ? "Sekarang (" + (recap ? String(recap.currentHour).padStart(2, "0") + ":00" : "-") + ")" : String(selectedJam).padStart(2, "0") + ":00 (manual — buat nutup yang kelewat)"}
          </div>
        </div>
        <button className="btn btn-secondary" style={{ width: "auto", padding: "0 14px", marginBottom: 0 }} onClick={onOpenJamModal}>
          Ubah
        </button>
      </div>

      <button
        className="big-click-btn"
        style={{ marginTop: 14 }}
        disabled={!selectedUnit || !material || loadingClick}
        onClick={onClick}
      >
        {loadingClick ? "..." : "+ RITASI"}
      </button>

      <div className="stat-row">
        <span>Ritasi jam ini ({recap ? recap.currentHour : "-"})</span>
        <b>{currentHourData ? currentHourData.total : 0}</b>
      </div>
      <div className="stat-row">
        <span>Total shift ini</span>
        <b>{selectedUnitRecap ? selectedUnitRecap.total : 0}</b>
      </div>
      {!material && <div className="hint">Pilih material dulu sebelum klik ritasi.</div>}

      {selectedUnitRecap && selectedUnitRecap.hourly && selectedUnitRecap.hourly.length > 0 && (
        <>
          <div className="field-label" style={{ marginTop: 16, marginBottom: 6 }}>
            Rincian Per Jam (Real-Time)
          </div>
          <div className="table-scroll">
            <table className="list-table">
              <thead>
                <tr><th>Jam</th><th>Material</th><th>Total</th></tr>
              </thead>
              <tbody>
                {selectedUnitRecap.hourly.map(function (h) {
                  const isCurrent = recap && h.jam === recap.currentHour;
                  return (
                    <tr key={h.jam} className={isCurrent ? "row-selected" : ""}>
                      <td>{String(h.jam).padStart(2, "0")}:00</td>
                      <td>{formatJamCell(h)}</td>
                      <td style={{ fontWeight: 700 }}>{h.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!isAdmin && recap && recap.shift && (
        <a
          className="btn btn-secondary"
          style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: 12, textDecoration: "none" }}
          href={"/api/shift/export?shiftId=" + recap.shift.id}
        >
          Export Data Saya (Excel)
        </a>
      )}
    </section>
  );
}
