export default function StatCards({ recap, allRecapUnits, totalFleetCount }) {
  const totalRitasi = recap ? recap.grandTotal : 0;
  const totalUnit = allRecapUnits.length;
  const unitAktif = allRecapUnits.filter(function (u) { return u.total > 0; }).length;

  const fleetIdsAktif = new Set(
    allRecapUnits
      .filter(function (u) { return u.total > 0 && u.fleet_id; })
      .map(function (u) { return u.fleet_id; })
  );

  return (
    <div className="stat-cards">
      <div className="card stat-card-box">
        <div>
          <div className="stat-card-lbl">Total Ritasi Shift Ini</div>
          <div className="stat-card-num stat-card-primary">{totalRitasi}</div>
        </div>
      </div>
      <div className="card stat-card-box">
        <div>
          <div className="stat-card-lbl">Unit Aktif (ada ritasi)</div>
          <div className="stat-card-num stat-card-green">{unitAktif}</div>
        </div>
        <span className="stat-card-trend">dari {totalUnit} HD</span>
      </div>
      <div className="card stat-card-box">
        <div>
          <div className="stat-card-lbl">Fleet / PC Aktif</div>
          <div className="stat-card-num stat-card-amber">{fleetIdsAktif.size}</div>
        </div>
        {totalFleetCount > 0 && <span className="stat-card-trend">dari {totalFleetCount} PC</span>}
      </div>
    </div>
  );
}
