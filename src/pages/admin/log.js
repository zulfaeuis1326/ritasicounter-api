import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { UserCog, ClipboardCheck, Truck, ClipboardPen, ScrollText } from "lucide-react";
import { ROLE_LABEL } from "@/lib/roles";
import { useAuthCheck } from "@/hooks/useAuthCheck";
import Topbar from "@/components/home/Topbar";
import PageLoader from "@/components/PageLoader";

// Halaman Log Aktivitas: khusus superadmin. Data dari /api/admin/activity-log (200 aksi terakhir).
const CATS = {
  akun: { label: "Akun", Icon: UserCog, tone: "var(--tile-blue)" },
  shift: { label: "Shift", Icon: ClipboardCheck, tone: "var(--tile-green)" },
  unit: { label: "Unit & Fleet", Icon: Truck, tone: "var(--tile-orange)" },
  ritasi: { label: "Ritasi", Icon: ClipboardPen, tone: "var(--tile-red)" },
  lain: { label: "Lainnya", Icon: ScrollText, tone: "var(--text-muted)" },
};
const FILTERS = [["all", "Semua"], ["akun", "Akun"], ["shift", "Shift"], ["unit", "Unit & Fleet"], ["ritasi", "Ritasi"]];

function parseDetail(d) {
  if (!d) return {};
  if (typeof d === "string") {
    try { return JSON.parse(d) || {}; } catch (e) { return {}; }
  }
  return d;
}

function short(s, n) {
  const t = String(s == null ? "" : s);
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

// Ubah (aksi + detail) jadi kalimat yang enak dibaca. maps = nama unit/PC/PIT dari ID.
function describe(action, d, maps) {
  const unit = (id) => (maps.units[id] ? maps.units[id] : "#" + id);
  const fleet = (id) => (maps.fleets[id] ? maps.fleets[id] : "#" + id);
  const pit = (id) => (maps.pits[id] ? maps.pits[id] : "#" + id);
  const who = d.username ? d.username : "akun #" + d.userId;
  switch (action) {
    case "approve_user": return { cat: "akun", text: "Menyetujui akun " + who };
    case "reject_user": return { cat: "akun", text: "Menolak pendaftaran " + who };
    case "revoke_sessions": return { cat: "akun", text: "Memaksa logout " + who };
    case "reset_password": return { cat: "akun", text: "Mereset password " + who };
    case "set_role": return { cat: "akun", text: "Mengubah role " + who + ": " + (ROLE_LABEL[d.from] || d.from) + " → " + (ROLE_LABEL[d.to] || d.to) };
    case "set_unit":
      return { cat: "akun", text: d.unitId ? "Mengatur unit " + who + " ke " + unit(d.unitId) : "Mereset unit " + who };
    case "reset_unit": return { cat: "akun", text: "Mereset unit " + who };
    case "delete_user": return { cat: "akun", text: "Menghapus akun " + who + (d.role ? " (" + (ROLE_LABEL[d.role] || d.role) + ")" : "") };
    case "approve_shifts": return { cat: "shift", text: "Menyetujui " + (d.approved != null ? d.approved : "?") + " dari " + (d.requested != null ? d.requested : "?") + " shift" };
    case "revoke_shift_approval": return { cat: "shift", text: "Membatalkan approval " + (d.revoked != null ? d.revoked : "?") + " shift" };
    case "close_shift": return { cat: "shift", text: "Menutup shift " + (d.label || "#" + d.shiftId) + (d.grandTotal != null ? " (total " + d.grandTotal + " rit)" : "") };
    case "assign_fleet":
      return { cat: "unit", text: d.fleetId ? "Menempatkan unit " + unit(d.unitId) + " ke PC " + fleet(d.fleetId) : "Melepas unit " + unit(d.unitId) + " dari PC" };
    case "set_unit_pit":
      return { cat: "unit", text: d.pitId ? "Mengubah lokasi unit " + unit(d.unitId) + " ke " + pit(d.pitId) : "Mengosongkan lokasi unit " + unit(d.unitId) };
    case "bulk_assign_units": {
      const parts = [];
      if (d.fleetId === null) parts.push("lepas dari PC");
      else if (d.fleetId && d.fleetId !== "tetap") parts.push("ke PC " + fleet(d.fleetId));
      if (d.pitId === null) parts.push("kosongkan lokasi");
      else if (d.pitId && d.pitId !== "tetap") parts.push("lokasi " + pit(d.pitId));
      return { cat: "unit", text: "Atur penempatan " + (d.count != null ? d.count : "?") + " unit" + (parts.length ? " · " + parts.join(", ") : "") };
    }
    case "create_unit": return { cat: "unit", text: "Menambah unit " + (d.name || "#" + d.unitId) };
    case "create_units": return { cat: "unit", text: "Menambah " + (d.created != null ? d.created : "?") + " unit" + (d.skipped ? " (" + d.skipped + " dilewati)" : "") };
    case "delete_unit": return { cat: "unit", text: "Menghapus unit " + unit(d.unitId) };
    case "delete_ritasi":
      return { cat: "ritasi", text: "Menghapus entri ritasi unit " + (d.unit || "?") + (d.material ? " · " + d.material : "") + (d.jam != null && d.jam !== "" ? " · jam " + d.jam : "") };
    case "set_note": return { cat: "ritasi", text: "Mengubah catatan unit " + (d.unit || "?") + (d.note ? ': "' + short(d.note, 80) + '"' : " (dikosongkan)") };
    default: return { cat: "lain", text: action };
  }
}

function toMap(data) {
  const m = {};
  if (Array.isArray(data)) data.forEach((x) => { if (x && x.id != null) m[x.id] = x.name; });
  return m;
}

export default function AdminLog() {
  const router = useRouter();
  const { authUser, authError, retry: retryAuth } = useAuthCheck(router, {
    minRole: (role) => role === "superadmin",
    redirectIfBelow: "/",
  });

  const [rows, setRows] = useState([]);
  const [maps, setMaps] = useState({ units: {}, fleets: {}, pits: {} });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/activity-log", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Gagal memuat log aktivitas");
      else { setRows(Array.isArray(data) ? data : []); setError(null); }
    } catch (err) {
      setError(err.message || "Gagal memuat log aktivitas");
    } finally {
      setLoading(false);
    }
  }, []);

  // Nama unit/PC/PIT dipakai untuk memperjelas kalimat; kalau gagal, tampil sebagai #ID saja.
  const loadNames = useCallback(async () => {
    async function get(url) {
      try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.json() : []; } catch (e) { return []; }
    }
    const [u, f, p] = await Promise.all([get("/api/units"), get("/api/fleets"), get("/api/pits")]);
    setMaps({ units: toMap(u), fleets: toMap(f), pits: toMap(p) });
  }, []);

  useEffect(() => {
    if (!authUser) return;
    load();
    loadNames();
  }, [authUser, load, loadNames]);

  const items = useMemo(() => rows.map((r) => {
    const d = parseDetail(r.detail);
    const info = describe(r.action, d, maps);
    return { r, d, info };
  }), [rows, maps]);

  const counts = useMemo(() => {
    const c = { all: items.length, akun: 0, shift: 0, unit: 0, ritasi: 0 };
    items.forEach((x) => { if (c[x.info.cat] != null) c[x.info.cat] += 1; });
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((x) => {
      if (filter !== "all" && x.info.cat !== filter) return false;
      if (!q) return true;
      return (x.r.actor_username || "").toLowerCase().includes(q) || x.info.text.toLowerCase().includes(q);
    });
  }, [items, query, filter]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (authError) {
    return (
      <div className="container">
        <div className="card">
          <div className="hint c-danger">{authError}</div>
          <button className="btn btn-secondary w-auto px-16 mt-10" onClick={retryAuth}>Coba lagi</button>
        </div>
      </div>
    );
  }
  if (!authUser) return <PageLoader />;

  return (
    <div className="v4-page">
      <Topbar authUser={authUser} canMonitorAll={true} isAdmin={true} isOperator={false} onLogout={handleLogout} currentPage="log" />

      <div className="container akun-wrap">
        {error && (
          <div className="akun-err-banner" role="alert">
            <span>{error}</span>
            <button className="akun-link" onClick={load}>Coba lagi</button>
          </div>
        )}

        <div className="akun-toolbar">
          <div className="akun-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
            <input type="search" placeholder="Cari pelaku atau aktivitas..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Cari log" />
          </div>
          <div className="akun-chips">
            {FILTERS.map(([k, label]) => (
              <button key={k} className={"akun-chip" + (filter === k ? " is-on" : "")} onClick={() => setFilter(k)}>
                {label} <b>{counts[k]}</b>
              </button>
            ))}
          </div>
        </div>

        <div className="log-meta">
          <span>{shown.length} dari {rows.length} aktivitas terakhir (maks. 200)</span>
          <button className="akun-link" onClick={() => { load(); loadNames(); }}>Muat ulang</button>
        </div>

        {loading ? (
          <ul className="akun-list" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => <li key={i} className="akun-skel" style={{ "--i": i }} />)}
          </ul>
        ) : shown.length === 0 ? (
          <div className="akun-empty">{rows.length === 0 ? "Belum ada aktivitas tercatat." : "Tidak ada aktivitas yang cocok dengan pencarian/filter."}</div>
        ) : (
          <ul className="akun-list">
            {shown.map((x) => {
              const cat = CATS[x.info.cat] || CATS.lain;
              const Icon = cat.Icon;
              const when = new Date(x.r.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
              const hasDetail = x.d && Object.keys(x.d).length > 0;
              return (
                <li key={x.r.id} className="log-item">
                  <span className="log-ico" style={{ background: cat.tone }} aria-hidden="true"><Icon size={18} strokeWidth={2.1} /></span>
                  <div className="log-main">
                    <div className="log-text">{x.info.text}</div>
                    <div className="log-sub">
                      <b>{x.r.actor_username || "Sistem"}</b>
                      {x.r.actor_role && <span className="log-role">{ROLE_LABEL[x.r.actor_role] || x.r.actor_role}</span>}
                      <span>{when}</span>
                      <span className="log-cat">{cat.label}</span>
                    </div>
                    {hasDetail && (
                      <details className="log-detail">
                        <summary>Detail</summary>
                        <pre>{JSON.stringify(x.d, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
