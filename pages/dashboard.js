import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { atLeast, ROLE_LABEL } from "../lib/roles";
import Topbar from "../components/home/Topbar";

const MATERIALS = ["OB", "COAL", "SOIL", "SOLU", "MUD"];

function formatJamCell(h) {
  if (!h || h.total === 0) return "-";
  const entries = Object.entries(h.materials);
  if (entries.length === 1) return entries[0][0] + " x" + h.total;
  const rincian = entries.map(function (e) { return e[0] + ":" + e[1]; }).join(", ");
  return h.total + " (" + rincian + ")";
}

const MATERIAL_COLORS = {
  OB: "#1f3864",
  COAL: "#374151",
  SOIL: "#b45309",
  SOLU: "#0891b2",
  MUD: "#65a30d",
};

export default function Dashboard() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(undefined);
  const [range, setRange] = useState("day");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [recap, setRecap] = useState(null);
  const [showAllUnits, setShowAllUnits] = useState(false);

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
    const poll = setInterval(() => {
      loadData();
      loadRecap();
    }, 6000);
    return () => clearInterval(poll);
  }, [authUser, loadData, loadRecap]);

  const allRecapUnits = (recap && recap.units) || [];
  const visibleUnits = showAllUnits ? allRecapUnits : allRecapUnits.filter((u) => u.total > 0);
  const hiddenUnitCount = allRecapUnits.length - visibleUnits.length;

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

  return (
    <div className="v4-page">
      <Topbar
        authUser={authUser}
        canMonitorAll={atLeast(authUser.role, "pengawas")}
        isAdmin={atLeast(authUser.role, "admin")}
        onLogout={handleLogout}
        active="dashboard"
      />
      <main className="container">
      <div className="card">
        <div className="section-title">Rentang Data</div>
        <div className="material-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button
            className={`material-btn ${range === "day" ? "active" : ""}`}
            onClick={() => setRange("day")}
          >
            Per Hari (7 hari)
          </button>
          <button
            className={`material-btn ${range === "shift" ? "active" : ""}`}
            onClick={() => setRange("shift")}
          >
            Per Shift (10 shift)
          </button>
        </div>
      </div>

      {error && (
        <div className="card"><div className="hint" style={{ color: "var(--danger)" }}>Error: {error}</div></div>
      )}

      {data && (
        <>
          <div className="card">
            <div className="section-title">Total Ritasi ({range === "day" ? "per Hari" : "per Shift"})</div>
            <div className="hint" style={{ marginBottom: 8 }}>Grand total: <b>{data.grandTotal}</b></div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.bucketSeries}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#1f3864" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="section-title">Produksi per Unit</div>
            <ResponsiveContainer width="100%" height={Math.max(180, data.unitSeries.length * 34)}>
              <BarChart data={data.unitSeries} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="total" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="section-title">Komposisi Material</div>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.materialSeries.filter((m) => m.total > 0)}
                  dataKey="total"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.name}: ${entry.total}`}
                >
                  {data.materialSeries.map((m) => (
                    <Cell key={m.name} fill={MATERIAL_COLORS[m.name] || "#888"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="section-title">Tren Produksi per Jam</div>
            <div className="hint" style={{ marginBottom: 8 }}>
              Akumulasi semua {range === "day" ? "hari" : "shift"} dalam rentang ini, per jam (00–23).
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.hourlySeries}>
                <XAxis dataKey="hour" tickFormatter={(h) => String(h).padStart(2, "0")} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(h) => `Jam ${String(h).padStart(2, "0")}`} />
                <Line type="monotone" dataKey="total" stroke="#dc2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="card">
        <div className="section-title">Rekap Per Jam - Shift Berjalan (Semua Unit)</div>
        <div className="hint" style={{ marginBottom: 8 }}>
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
                <th>Unit</th>
                {recap && recap.hours && recap.hours.map(function (h) {
                  return (
                    <th key={h} className={h === recap.currentHour ? "current-hour" : ""}>
                      {String(h).padStart(2, "0")}
                    </th>
                  );
                })}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleUnits.map(function (u) {
                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700 }}>{u.name}</td>
                    {u.hourly.map(function (h) {
                      return (
                        <td key={h.jam} className={h.jam === recap.currentHour ? "current-hour" : ""}>
                          {formatJamCell(h)}
                        </td>
                      );
                    })}
                    <td style={{ fontWeight: 700 }}>{u.total}</td>
                  </tr>
                );
              })}
              {visibleUnits.length === 0 && (
                <tr><td colSpan={2} className="hint">Belum ada ritasi di shift ini.</td></tr>
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
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Rincian Material - Shift Berjalan</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Total</th>
                {MATERIALS.map(function (m) {
                  return <th key={m}>{m}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {visibleUnits.map(function (u) {
                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700 }}>{u.name}</td>
                    <td>{u.total}</td>
                    {MATERIALS.map(function (m) {
                      return <td key={m}>{(u.materialTotals && u.materialTotals[m]) || 0}</td>;
                    })}
                  </tr>
                );
              })}
              {visibleUnits.length === 0 && (
                <tr><td colSpan={2 + MATERIALS.length} className="hint">Belum ada ritasi di shift ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="app-footer">designed by Najib.dev</div>
      </main>
    </div>
  );
}
