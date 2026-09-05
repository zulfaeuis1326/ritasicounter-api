// Daftar 12 jam dasar 1 shift (dari awal shift, urut kronologis) — dipakai buat grid modal.
function baseHoursOfShift(shiftType) {
  const start = shiftType === 1 ? 7 : 19;
  return Array.from({ length: 12 }, function (_, i) { return (start + i) % 24; });
}

function relIndex(shiftType, hour) {
  const start = shiftType === 1 ? 7 : 19;
  return (hour - start + 24) % 24;
}

export default function JamManualModal({ open, onClose, shiftType, currentHour, onPick }) {
  if (!open) return null;

  const hours = baseHoursOfShift(shiftType);
  const currentRel = relIndex(shiftType, currentHour);

  return (
    <div className="modal-bg show" onClick={onClose}>
      <div className="modal" onClick={function (e) { e.stopPropagation(); }}>
        <h3>Pilih Jam Ritasi Manual</h3>
        <p className="modal-sub">
          Pilih jam sebelumnya dalam shift berjalan untuk menutup ritasi yang terlewat.
          Jam yang belum terjadi otomatis dikunci.
        </p>
        <div className="jam-grid">
          {hours.map(function (h) {
            const isFuture = relIndex(shiftType, h) > currentRel;
            const isCurrent = h === currentHour;
            return (
              <button
                key={h}
                disabled={isFuture}
                className={isCurrent ? "current" : ""}
                onClick={function () { onPick(isCurrent ? "" : String(h)); onClose(); }}
              >
                {String(h).padStart(2, "0")}:00
              </button>
            );
          })}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" style={{ width: "auto", padding: "0 16px" }} onClick={function () { onPick(""); onClose(); }}>
            Pakai Jam Sekarang
          </button>
          <button className="btn" style={{ width: "auto", padding: "0 16px", background: "transparent", color: "var(--text-muted)" }} onClick={onClose}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
