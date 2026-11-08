import { useEffect, useState, useCallback } from "react";
import { startPolling } from "@/lib/poll";
import { useRouter } from "next/router";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { atLeast } from "@/lib/roles";
import Topbar from "@/components/home/Topbar";
import ShiftBanner from "@/components/home/ShiftBanner";
import RekapTable from "@/components/home/RekapTable";
import ShiftRowMenu from "@/components/home/ShiftRowMenu";
import { BCM_PER_RIT, MATERIALS, TONS_PER_RIT, TONS_PER_BCM } from "@/lib/materials";

function formatJamCell(h) {
  if (!h || h.total === 0) return "-";
  const entries = Object.entries(h.materials);
  if (entries.length === 1) return entries[0][0] + " x" + h.total;
  const rincian = entries.map(function (e) { return e[0] + ":" + e[1]; }).join(", ");
  return h.total + " (" + rincian + ")";
}

function formatBcm(rit) {
  return Math.round(rit * BCM_PER_RIT).toLocaleString("id-ID");
}

const MATERIAL_COLORS = {
  OB: "#1f3864",
  COAL: "#374151",
  SOIL: "#b45309",
  SOLU: "#0891b2",
  MUD: "#65a30d",
};

function KpiRow({ data, range }) {
  const buckets = data.bucketSeries || [];
  const unit = range === "day" ? "hari" : "shift";
  const avg = buckets.length ? Math.round((data.grandTotal * BCM_PER_RIT) / buckets.length) : 0;
  const last = buckets.length ? buckets[buckets.length - 1].total : 0;
  const prev = buckets.length > 1 ? buckets[buckets.length - 2].total : null;
  const delta = prev ? Math.round(((last - prev) / prev) * 100) : null;
  const top = (data.pitSeries || []).reduce(function (b, pit) { return !b || pit.total > b.total ? pit : b; }, null);
  return (
    <div className="kpi-row">
      <div className="card kpi"><div className="kpi-body">
        <div className="kpi-lbl">Produktivitas total</div><div className="kpi-num">{formatBcm(data.grandTotal)} BCM</div>
        <div className="kpi-sub">{data.grandTotal} rit hauler</div>
      </div></div>
      <div className="card kpi"><div className="kpi-body">
        <div className="kpi-lbl">Rata-rata BCM per {unit}</div><div className="kpi-num">{avg}</div>
        {delta !== null && <div className={"kpi-sub " + (delta >= 0 ? "kpi-up" : "kpi-down")}>{unit} terakhir {delta >= 0 ? "+" : ""}{delta}% dari sebelumnya</div>}
      </div></div>
      <div className="card kpi"><div className="kpi-body">
        <div className="kpi-lbl">Produktivitas PIT tertinggi</div><div className="kpi-num kpi-num-sm">{top ? top.name : "-"}</div>
        <div className="kpi-sub">{top ? formatBcm(top.total) + " BCM" : "belum ada data"}</div>
      </div></div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(undefined);
  const [range, setRange] = useState("day");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [recap, setRecap] = useState(null);
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [clock, setClock] = useState("");
  const [reportHours, setReportHours] = useState([7, 12, 19]);
  const [pastShifts, setPastShifts] = useState([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    function checkAuth() {
      fetch("/api/auth/me", { cache: "no-store" })
        .then((res) => res.json())
        .then((d) => {
          if (!d.user) router.push("/login");
          else if (!atLeast(d.user.role, "pengawas")) router.push("/");
          else setAuthUser(d.user);
        })
        .catch(() => router.push("/login"));
    }
    checkAuth();

    function handlePageShow(e) {
      if (e.persisted) window.location.reload();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [router]);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?range=${range}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Error ${res.status}`);
        return;
      }
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [range]);

  const loadRecap = useCallback(async () => {
    try {
      const res = await fetch("/api/ritasi");
      if (res.ok) setRecap(await res.json());
    } catch (err) {
      // diamkan - tabel unit cukup gagal senyap, chart di atas tetap jalan
    }
  }, []);

  useEffect(() => {
    if (!authUser) return;
    loadData();
    loadRecap();
    return startPolling(() => {
      loadData();
      loadRecap();
    }, 6000);
  }, [authUser, loadData, loadRecap]);

  // Jam di banner shift
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("id-ID"));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Jam laporan + riwayat shift (riwayat hanya untuk admin ke atas, sesuai API)
  useEffect(() => {
    if (!authUser) return;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((d) => { if (d && Array.isArray(d.reportHours)) setReportHours(d.reportHours); })
      .catch(() => {});
    if (atLeast(authUser.role, "admin")) {
      fetch("/api/shift/list")
        .then((res) => (res.ok ? res.json() : []))
        .then((d) => setPastShifts(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [authUser]);

  const allRecapUnits = (recap && recap.units) || [];
  const visibleUnits = showAllUnits ? allRecapUnits : allRecapUnits.filter((u) => u.total > 0);
  const hiddenUnitCount = allRecapUnits.length - visibleUnits.length;
  // Grafik per unit cukup 10 teratas (daftar panjang sulit dibaca, terutama di HP)
  const topUnits = ((data && data.unitSeries) || []).slice().sort(function (a, b) { return b.total - a.total; }).slice(0, 10)
    .map(function (unit) { return { ...unit, bcm: unit.total * BCM_PER_RIT }; });
  const pitProductivity = ((data && data.pitSeries) || []).map(function (pit) { return { ...pit, bcm: pit.total * BCM_PER_RIT }; });
  const materialProductivity = ((data && data.materialSeries) || []).map(function (material) { return { ...material, bcm: material.total * BCM_PER_RIT }; });
  const bucketProductivity = ((data && data.bucketSeries) || []).map(function (bucket) { return { ...bucket, bcm: bucket.total * BCM_PER_RIT }; });
  const hourlyProductivity = ((data && data.hourlySeries) || []).map(function (hour) { return { ...hour, bcm: hour.total * BCM_PER_RIT }; });

  if (authUser === undefined || authUser === null) {
    return (
      <div className="container">
        <div className="card"><div className="hint">Memuat...</div></div>
      </div>
    );
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const isAdmin = atLeast(authUser.role, "admin");
  const canMonitorAll = atLeast(authUser.role, "pengawas");
  const isReportHour = !!recap && recap.currentHour !== undefined && reportHours.includes(recap.currentHour);

  function flash(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4000);
  }

  function handleExport() {
    if (!recap || !recap.shift) return;
    window.open("/api/shift/export?shiftId=" + recap.shift.id, "_blank");
  }

  async function handleSaveReportHours(hours) {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportHours: hours }),
      });
      const d = await res.json();
      if (!res.ok) { flash(d.error || "Gagal simpan setting"); return; }
      setReportHours(d.reportHours);
      flash("Jam laporan disimpan.");
    } catch (err) {
      flash("Gagal simpan (koneksi/server bermasalah)");
    }
  }

  async function handleDeleteShift(id, label) {
    if (!confirm(`Hapus history shift "${label}"? Semua data ritasi di shift ini bakal ikut kehapus permanen, gak bisa dibalikin.`)) return;
    try {
      const res = await fetch("/api/shift/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: id }),
      });
      const d = await res.json();
      if (!res.ok) { flash(d.error || "Gagal hapus shift"); return; }
      flash("Shift dihapus.");
      setPastShifts((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      flash("Gagal hapus (koneksi/server bermasalah)");
    }
  }

  return (
    <div className="v4-page">
      <Topbar authUser={authUser} canMonitorAll={canMonitorAll} isAdmin={isAdmin} isOperator={false} onLogout={handleLogout} currentPage="dashboard" />

      <main className="container">
      <ShiftBanner recap={recap} recapError={null} clock={clock} />
      {isReportHour && (
        <div className="report-hour-banner">
          Ini jam laporan ({String(recap.currentHour).padStart(2, "0")}:00) — udah waktunya share rekap. <a href="#laporan">Buka Laporan Shift</a>
        </div>
      )}
      {notice && <div className="hint mb-8" role="status">{notice}</div>}
      <div className="dash-top">
        <div className="seg" role="tablist" aria-label="Rentang waktu">
          <button className={"seg-btn" + (range === "day" ? " active" : "")} onClick={() => setRange("day")}>7 hari</button>
          <button className={"seg-btn" + (range === "shift" ? " active" : "")} onClick={() => setRange("shift")}>10 shift</button>
        </div>
      </div>
      <div className="hint mb-8">{TONS_PER_RIT} ton / rit hauler ÷ {TONS_PER_BCM} ton/BCM = {formatBcm(1)} BCM per rit.</div>

      {error && (
        <div className="card"><div className="hint c-danger" >Error: {error}</div></div>
      )}

      {data && (
        <>
          <KpiRow data={data} range={range} />
          <div className="dash-grid">
          <div className="card dash-wide">
            <div className="section-title">Produktivitas ({range === "day" ? "per Hari" : "per Shift"})</div>
            <div className="hint mb-8" >Total: <b>{formatBcm(data.grandTotal)} BCM</b></div>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bucketProductivity}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                  <Bar dataKey="bcm" name="BCM" fill="#3ebd93" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="section-title">Produktivitas per Hauler (10 teratas)</div>
            <ResponsiveContainer width="100%" height={Math.max(180, topUnits.length * 34)}>
              <BarChart data={topUnits} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                  <Bar dataKey="bcm" name="BCM" fill="#3ebd93" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="section-title">Produktivitas per PIT</div>
            <ResponsiveContainer width="100%" height={Math.max(180, pitProductivity.length * 34)}>
                <BarChart data={pitProductivity} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="bcm" name="BCM" fill="#3ebd93" radius={[0, 4, 4, 0]} />
                </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="section-title">Produktivitas per Material</div>
            <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                <Pie
                    data={materialProductivity.filter((m) => m.bcm > 0)}
                    dataKey="bcm"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {materialProductivity.map((m) => (
                    <Cell key={m.name} fill={MATERIAL_COLORS[m.name] || "#888"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="section-title">Tren Produktivitas per Jam (BCM)</div>
            <div className="hint mb-8" >
              Akumulasi semua {range === "day" ? "hari" : "shift"} dalam rentang ini, per jam (00–23).
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={hourlyProductivity}>
                <XAxis dataKey="hour" tickFormatter={(h) => String(h).padStart(2, "0")} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(h) => `Jam ${String(h).padStart(2, "0")}`} />
                <Line type="monotone" dataKey="bcm" stroke="#1a8463" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          </div>
        </>
      )}

      <details className="card dash-details">
        <summary className="section-title">Rekap Per Jam - Shift Berjalan (Semua Unit)</summary>
        <div className="hint mb-8" >
          Kolom jam yang ditandai adalah jam yang sedang berjalan saat ini.
          {hiddenUnitCount > 0 && !showAllUnits && (
            <> {hiddenUnitCount} unit belum ada ritasi disembunyikan — <a href="#" onClick={function (e) { e.preventDefault(); setShowAllUnits(true); }}>tampilkan semua</a>.</>
          )}
          {showAllUnits && (
            <> <a href="#" onClick={function (e) { e.preventDefault(); setShowAllUnits(false); }}>sembunyikan unit kosong</a>.</>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Hauler</th>
                {recap && recap.hours && recap.hours.map(function (h) {
                  return (
                    <th key={h} className={h === recap.currentHour ? "current-hour" : ""}>
                      {String(h).padStart(2, "0")}
                    </th>
                  );
                })}
                <th>Total rit</th>
                <th>BCM</th>
              </tr>
            </thead>
            <tbody>
              {visibleUnits.map(function (u) {
                return (
                  <tr key={u.id}>
                    <td className="fw-700">{u.name}</td>
                    {u.hourly.map(function (h) {
                      return (
                        <td key={h.jam} className={h.jam === recap.currentHour ? "current-hour" : ""}>
                          {formatJamCell(h)}
                        </td>
                      );
                    })}
                    <td className="fw-700">{u.total}</td>
                    <td className="fw-700">{formatBcm(u.total)}</td>
                  </tr>
                );
              })}
              {visibleUnits.length === 0 && (
                <tr><td colSpan={recap && recap.hours ? recap.hours.length + 3 : 3} className="hint">Belum ada ritasi di shift ini.</td></tr>
              )}
              {recap && (
                <tr className="total-row">
                  <td>TOTAL</td>
                  {recap.grandHourlyTotals && recap.grandHourlyTotals.map(function (v, i) {
                    return (
                      <td key={i} className={recap.hours[i] === recap.currentHour ? "current-hour" : ""}>
                        {v}
                      </td>
                    );
                  })}
                  <td>{recap.grandTotal}</td>
                  <td>{formatBcm(recap.grandTotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>

      <div className="card">
        <div className="section-title">Rincian Material - Shift Berjalan</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Hauler</th>
                <th>Total rit</th>
                <th>Total BCM</th>
                {MATERIALS.map(function (m) {
                  return <th key={m}>{m} (BCM)</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {visibleUnits.map(function (u) {
                return (
                  <tr key={u.id}>
                    <td className="fw-700">{u.name}</td>
                    <td>{u.total}</td>
                    <td>{formatBcm(u.total)}</td>
                    {MATERIALS.map(function (m) {
                      return <td key={m}>{formatBcm((u.materialTotals && u.materialTotals[m]) || 0)}</td>;
                    })}
                  </tr>
                );
              })}
              {visibleUnits.length === 0 && (
                <tr><td colSpan={3 + MATERIALS.length} className="hint">Belum ada ritasi di shift ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div id="laporan">
        <RekapTable
          toolsOnly
          allRecapUnits={allRecapUnits}
          showAllUnits={showAllUnits}
          setShowAllUnits={setShowAllUnits}
          canMonitorAll={canMonitorAll}
          isAdmin={isAdmin}
          recap={recap}
          onExport={handleExport}
          reportHours={reportHours}
          onSaveReportHours={handleSaveReportHours}
        />
      </div>

      {isAdmin && pastShifts.length > 0 && (
        <section className="card">
          <h2 className="sec-title-icon">Riwayat Shift</h2>
          {pastShifts.map((s) => (
            <div key={s.id} className="history-row">
              <span>{s.label}</span>
              <ShiftRowMenu shiftId={s.id} isAdmin={isAdmin} onDelete={() => handleDeleteShift(s.id, s.label)} />
            </div>
          ))}
        </section>
      )}

      <div className="app-footer">designed by Najib.dev</div>
      </main>
    </div>
  );
}
