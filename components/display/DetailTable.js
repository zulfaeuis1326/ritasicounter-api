export default function DetailTable({ data }) {
  if (!data || !data.shift) {
    return <div className="display-empty">Belum ada shift berjalan.</div>;
  }
  if (data.pits.length === 0) {
    return <div className="display-empty">Belum ada ritasi tercatat pada shift ini.</div>;
  }

  return (
    <div className="display-table-wrap">
      {data.pits.map((pit) => (
        <div key={pit.pit} className="display-pit-block">
          <div className="display-pit-header">
            <span className="display-pit-name">{pit.pit}</span>
            <span className="display-pit-stats">{pit.totalRit} rit</span>
          </div>

          {pit.fleets.map((fleet) => (
            <div key={fleet.fleet} className="display-fleet-block">
              <div className="display-fleet-header">
                <span>Fleet: {fleet.fleet}</span>
                <span className="display-fleet-stats">{fleet.totalRit} rit</span>
              </div>

              <table className="display-table">
                <thead>
                  <tr>
                    <th>Hauler</th>
                    <th>Material (rit)</th>
                    <th>Update terakhir</th>
                    <th style={{ textAlign: "right" }}>Total Rit</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.haulers.map((h) => (
                    <tr key={h.hauler}>
                      <td><b>{h.hauler}</b></td>
                      <td>
                        {h.materials.map((m) => (
                          <span key={m.material} className="display-material-chip" data-material={m.material}>
                            {m.material} &times;{m.ritCount}
                          </span>
                        ))}
                      </td>
                      <td>{h.lastTime || "-"}</td>
                      <td style={{ textAlign: "right" }}>{h.totalRit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}

      <div className="display-grandtotal">
        <span>TOTAL SEMUA PIT</span>
        <span>{data.grandTotalRit} rit</span>
      </div>
    </div>
  );
}
