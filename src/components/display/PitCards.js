export default function PitCards({ data }) {
  if (!data || !data.shift) {
    return <div className="card"><div className="hint">Tidak ada shift berjalan.</div></div>;
  }
  const pits = data.pits.slice().sort(function (a, b) { return b.totalRit - a.totalRit; });

  return (
    <div className="pitcards">
      <div className="pitcards-grand">
        <span className="pitcards-grand-lbl">TOTAL RITASI SHIFT</span>
        <span className="pitcards-grand-num">{data.grandTotalRit}</span>
      </div>
      <div className="pitcards-grid">
        {pits.map(function (p) {
          const fleets = p.fleets.slice().sort(function (a, b) { return b.totalRit - a.totalRit; });
          return (
            <div key={p.pit} className="pitcard">
              <div className="pitcard-head">
                <span className="pitcard-name">{p.pit}</span>
                <span className="pitcard-total">{p.totalRit}</span>
              </div>
              <ul className="pitcard-fleets">
                {fleets.map(function (f) {
                  return (
                    <li key={f.fleet}>
                      <span className="pitcard-fleet-name">{f.fleet}</span>
                      <small>{f.haulers.length} HD</small>
                      <b>{f.totalRit}</b>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
