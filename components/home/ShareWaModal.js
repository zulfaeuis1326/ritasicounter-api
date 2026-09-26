import { useEffect, useState } from "react";

const MATERIALS = ["OB", "COAL", "SOIL", "SOLU", "MUD"];

function matSummary(materials) {
  return MATERIALS.filter(function (m) { return materials && materials[m]; })
    .map(function (m) { return m + ":" + materials[m]; })
    .join(", ");
}

// Modal generik: user centang jam-jam mana yang mau dimasukkan ke laporan,
// lalu tombol "Kirim ke WA" bikin teksnya (lewat buildMessage) dan buka wa.me.
export default function ShareWaModal({ open, onClose, title, subtitle, hours, buildMessage }) {
  const [checked, setChecked] = useState({});

  useEffect(function () {
    if (!open) return;
    const init = {};
    (hours || []).forEach(function (h) { init[h.jam] = h.total > 0; });
    setChecked(init);
  }, [open, hours]);

  if (!open) return null;

  const selectedJams = Object.keys(checked).filter(function (k) { return checked[k]; }).map(Number);
  const allChecked = (hours || []).length > 0 && (hours || []).every(function (h) { return checked[h.jam]; });

  function toggleAll() {
    const next = {};
    (hours || []).forEach(function (h) { next[h.jam] = !allChecked; });
    setChecked(next);
  }

  function handleSend() {
    const text = buildMessage(selectedJams);
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
    onClose();
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={function (e) { e.stopPropagation(); }}>
        <h3>{title}</h3>
        {subtitle && <p className="modal-sub">{subtitle}</p>}

        <button className="share-toggle-all" onClick={toggleAll}>
          {allChecked ? "Batal pilih semua" : "Pilih semua jam"}
        </button>

        <div className="share-hour-list">
          {(hours || []).length === 0 && <div className="hint">Belum ada data jam.</div>}
          {(hours || []).map(function (h) {
            return (
              <label key={h.jam} className={"share-hour-row" + (h.total === 0 ? " share-hour-empty" : "")}>
                <input
                  type="checkbox"
                  checked={!!checked[h.jam]}
                  onChange={function (e) {
                    setChecked(function (prev) { return { ...prev, [h.jam]: e.target.checked }; });
                  }}
                />
                <span className="share-hour-jam">{String(h.jam).padStart(2, "0")}:00</span>
                <span className="share-hour-total">{h.total} rit</span>
                <span className="share-hour-mat">{matSummary(h.materials)}</span>
              </label>
            );
          })}
        </div>

        <div className="modal-actions" style={{ marginTop: 14 }}>
          <button className="btn btn-secondary" style={{ width: "auto" }} onClick={onClose}>Batal</button>
          <button className="btn btn-primary rekap-share-btn" style={{ width: "auto" }} disabled={selectedJams.length === 0} onClick={handleSend}>
            Kirim ke WA
          </button>
        </div>
      </div>
    </div>
  );
}
