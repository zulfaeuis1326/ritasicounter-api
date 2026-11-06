function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
  );
}

export default function ShiftBanner({ recap, recapError, clock }) {
  const label = recapError ? "Error: " + recapError : (recap && recap.shift ? recap.shift.label : "Memuat shift...");
  const tz = recap && recap.tzInfo ? recap.tzInfo : "";

  return (
    <div className="shift-banner">
      <span className="shift-banner-icon"><ClockIcon /></span>
      <div>
        <b>{label}</b>
        {tz && <div className="shift-banner-sub">Zona waktu: {tz}</div>}
      </div>
      <span className="shift-banner-pill">Aktif</span>
      <div className="shift-banner-clock">{clock}</div>
    </div>
  );
}
