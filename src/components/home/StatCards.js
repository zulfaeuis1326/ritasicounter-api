const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

// Tiga KPI inti: Total ritasi (plus laju per jam), Unit aktif (cincin persen), Perlu dicek.
export default function StatCards({ recap, allRecapUnits }) {
  const totalRitasi = recap ? recap.grandTotal : 0;
  const totalUnit = allRecapUnits.length;
  const unitAktif = allRecapUnits.filter(function (u) { return u.total > 0; }).length;
  const pct = totalUnit ? Math.round((unitAktif / totalUnit) * 100) : 0;

  const hours = (recap && recap.hours) || [];
  const curIdx = recap ? hours.indexOf(recap.currentHour) : -1;
  const perJam = curIdx >= 0 ? Math.round((totalRitasi / (curIdx + 1)) * 10) / 10 : null;

  // Unit yang sudah pernah ritasi di shift ini tapi sudah >= 2 jam tidak ada rit baru
  const idle = curIdx < 0 ? [] : allRecapUnits.filter(function (u) {
    if (!u.total) return false;
    let last = -1;
    u.hourly.forEach(function (h, i) { if (h.total > 0) last = i; });
    return curIdx - last >= 2;
  });

  return (
    <div className="kpi-row">
      <div className="card kpi">
        <div className="kpi-body">
          <div className="kpi-lbl">Total ritasi</div>
          <div className="kpi-num">{totalRitasi}</div>
          <div className="kpi-sub">{perJam !== null ? "sekitar " + perJam + " rit per jam" : "shift berjalan"}</div>
        </div>
      </div>
      <div className="card kpi">
        <div className="kpi-body">
          <div className="kpi-lbl">Unit aktif</div>
          <div className="kpi-num">{unitAktif}<span className="kpi-of"> / {totalUnit}</span></div>
          <div className="kpi-sub">HD yang sudah ritasi</div>
        </div>
        <svg className="kpi-ring" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label={pct + " persen unit aktif"}>
          <circle cx="32" cy="32" r={RING_R} className="kpi-ring-track" />
          <circle cx="32" cy="32" r={RING_R} className="kpi-ring-bar" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - pct / 100)} transform="rotate(-90 32 32)" />
          <text x="32" y="36" textAnchor="middle" className="kpi-ring-text">{pct}%</text>
        </svg>
      </div>
      <div className={"card kpi" + (idle.length > 0 ? " kpi-warn" : "")}>
        <div className="kpi-body">
          <div className="kpi-lbl">Perlu dicek</div>
          <div className="kpi-num">{idle.length}</div>
          <div className="kpi-sub">
            {idle.length === 0 ? "Semua unit bergerak" : idle.slice(0, 3).map(function (u) { return u.name; }).join(", ") + (idle.length > 3 ? " +" + (idle.length - 3) : "") + " sepi 2 jam atau lebih"}
          </div>
        </div>
      </div>
    </div>
  );
}
