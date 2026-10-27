export default function StatCards({ recap, allRecapUnits, totalFleetCount }) {
  const totalRitasi = recap ? recap.grandTotal : 0;
  const totalUnit = allRecapUnits.length;
  const unitAktif = allRecapUnits.filter(function (u) { return u.total > 0; }).length;

  const fleetIdsAktif = new Set(
    allRecapUnits
      .filter(function (u) { return u.total > 0 && u.fleet_id; })
      .map(function (u) { return u.fleet_id; })
  );

  // Unit yang sudah pernah ritasi di shift ini tapi sudah >= 2 jam tidak ada rit baru
  const hours = (recap && recap.hours) || [];
  const curIdx = recap ? hours.indexOf(recap.currentHour) : -1;
  const idle = curIdx < 0 ? [] : allRecapUnits.filter(function (u) {
    if (!u.total) return false;
    let last = -1;
    u.hourly.forEach(function (h, i) { if (h.total > 0) last = i; });
    return curIdx - last >= 2;
  });

  return (
    <div className="stat-cards">
      <div className="card stat-card-box">
        <div>
          <div className="stat-card-lbl">Total Ritasi</div>
          <div className="stat-card-num stat-card-primary">{totalRitasi}</div>
        </div>
      </div>
      <div className="card stat-card-box">
        <div>
          <div className="stat-card-lbl">Unit Aktif</div>
          <div className="stat-card-num stat-card-green">{unitAktif}</div>
        </div>
        <span className="stat-card-trend">/ {totalUnit} HD</span>
      </div>
      <div className="card stat-card-box">
        <div>
          <div className="stat-card-lbl">Fleet Aktif</div>
          <div className="stat-card-num stat-card-amber">{fleetIdsAktif.size}</div>
        </div>
        {totalFleetCount > 0 && <span className="stat-card-trend">/ {totalFleetCount} PC</span>}
      </div>
      <div className={"card stat-card-box stat-card-check" + (idle.length > 0 ? " has-idle" : "")}>
        <div>
          <div className="stat-card-lbl">Perlu Dicek</div>
          <div className="stat-card-num">{idle.length}</div>
          <div className="stat-card-sub">
            {idle.length === 0 ? "Semua unit bergerak" : idle.slice(0, 4).map(function (u) { return u.name; }).join(", ") + (idle.length > 4 ? " +" + (idle.length - 4) : "") + " (>=2 jam sepi)"}
          </div>
        </div>
      </div>
    </div>
  );
        }
  
