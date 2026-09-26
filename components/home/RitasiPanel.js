import Combobox from "../Combobox";
import { useState } from "react";
import ShareWaModal from "./ShareWaModal";

function WhatsappIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 20 12a8 8 0 0 1-8 8zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.6.1s-.6.8-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4L9 10.2c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3a2.3 2.3 0 0 0-.7 1.7c0 1 .7 2 .8 2.1.1.2 1.4 2.3 3.5 3.1 1.9.8 1.9.5 2.2.5.4 0 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1z" />
    </svg>
  );
}

const MATERIALS = ["OB", "COAL", "SOIL", "SOLU", "MUD"];

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
  const [shareOpen, setShareOpen] = useState(false);

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

      {!isAdmin && (
        <button
          className="btn btn-primary rekap-share-btn"
          style={{ marginTop: 12 }}
          disabled={!selectedUnitRecap || !selectedUnitRecap.total}
          onClick={function () { setShareOpen(true); }}
        >
          <WhatsappIcon /> Share ke WA
        </button>
      )}

      <ShareWaModal
        open={shareOpen}
        onClose={function () { setShareOpen(false); }}
        title="Share Laporan Ritasi"
        subtitle={authUser.unit_name + (selectedUnitRecap && selectedUnitRecap.fleet_name ? " • Fleet: " + selectedUnitRecap.fleet_name : "") + (selectedUnitRecap && selectedUnitRecap.pit_name ? " • PIT: " + selectedUnitRecap.pit_name : "") + (recap && recap.shift ? " • " + recap.shift.label : "")}
        hours={selectedUnitRecap ? selectedUnitRecap.hourly : []}
        buildMessage={function (selectedJams) {
          const picked = (selectedUnitRecap ? selectedUnitRecap.hourly : []).filter(function (h) { return selectedJams.includes(h.jam); });
          const totalMat = {};
          let grandTotal = 0;
          picked.forEach(function (h) {
            grandTotal += h.total;
            Object.entries(h.materials || {}).forEach(function (entry) {
              totalMat[entry[0]] = (totalMat[entry[0]] || 0) + entry[1];
            });
          });
          const lines = [
            "*LAPORAN RITASI - " + authUser.unit_name + "*",
            selectedUnitRecap && selectedUnitRecap.fleet_name ? "Fleet: " + selectedUnitRecap.fleet_name : null,
            selectedUnitRecap && selectedUnitRecap.pit_name ? "PIT: " + selectedUnitRecap.pit_name : null,
            recap && recap.shift ? recap.shift.label : null,
            "",
            "Rincian per jam:",
            ...picked.map(function (h) {
              const mat = MATERIALS.filter(function (m) { return h.materials && h.materials[m]; })
                .map(function (m) { return m + " " + h.materials[m]; }).join(", ");
              return "- " + String(h.jam).padStart(2, "0") + ":00 -> " + h.total + " rit" + (mat ? " (" + mat + ")" : "");
            }),
            "",
            "Total material:",
            ...MATERIALS.filter(function (m) { return totalMat[m]; }).map(function (m) { return "- " + m + ": " + totalMat[m] + " rit"; }),
            "",
            "Total keseluruhan: " + grandTotal + " rit",
          ].filter(function (l) { return l !== null; });
          return lines.join("\n");
        }}
      />
    </section>
  );
}
