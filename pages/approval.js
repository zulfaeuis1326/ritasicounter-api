import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { atLeast } from "../lib/roles";
import Topbar from "../components/home/Topbar";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const TABS = [["pending", "Menunggu"], ["approved", "Disetujui"], ["all", "Semua"]];

async function api(method, url, body) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error " + res.status);
  return data;
}
function dayLabel(day, today) {
  if (day === today) return "Hari ini";
  const y = new Date(today + "T00:00:00Z"); y.setUTCDate(y.getUTCDate() - 1);
  if (day === y.toISOString().slice(0, 10)) return "Kemarin";
  const [yy, mm, dd] = day.split("-");
  return Number(dd) + " " + MONTHS[Number(mm) - 1] + " " + yy;
}
const stateOf = (s) => (s.status === "open" ? "open" : s.review_status === "approved" ? "approved" : "pending");
const STATE_LABEL = { open: "Berjalan", pending: "Menunggu", approved: "Disetujui" };

export default function ApprovalShift() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(undefined);
  const [tab, setTab] = useState("pending");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [shiftType, setShiftType] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, all: 0 });
  const [nextCursor, setNextCursor] = useState(null);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState({});
  const [expanded, setExpanded] = useState({});
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const reqId = useRef(0);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (!d.user) router.push("/login");
      else if (!atLeast(d.user.role, "pengawas")) router.push("/");
      else setAuthUser(d.user);
    }).catch(() => router.push("/login"));
  }, [router]);

  // Kotak cari: tunggu 300 ms setelah berhenti mengetik, supaya tidak memanggil server tiap huruf
  useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 300); return () => clearTimeout(t); }, [qInput]);

  const load = useCallback(async (cursor) => {
    const id = ++reqId.current;
    const p = new URLSearchParams({ status: tab, limit: "20" });
    if (q) p.set("q", q);
    if (shiftType) p.set("shiftType", String(shiftType));
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (cursor) p.set("cursor", String(cursor));
    try {
      const d = await api("GET", "/api/shift/approvals?" + p.toString());
      if (id !== reqId.current) return; // jawaban lama diabaikan (filter sudah berubah)
      setItems((prev) => (cursor ? prev.concat(d.items) : d.items));
      setNextCursor(d.nextCursor); setCounts(d.counts); setToday(d.today);
    } catch (e) { if (id === reqId.current) setBanner({ type: "error", text: "Gagal memuat: " + e.message }); }
  }, [tab, q, shiftType, from, to]);

  useEffect(() => {
    if (!authUser) return;
    setLoading(true); setSelected({});
    load(null).finally(() => setLoading(false));
  }, [authUser, load]);

  if (!authUser) return <div className="container"><div className="card"><div className="hint">Memuat...</div></div></div>;
  const isAdmin = atLeast(authUser.role, "admin");

  async function handleLogout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }

  async function loadMore() { setLoadingMore(true); await load(nextCursor); setLoadingMore(false); }

  async function act(action, ids) {
    setSaving(true); setBanner(null);
    try {
      const r = await api("POST", "/api/shift/approvals", { action, ids });
      const skipped = ids.length - r.updated;
      const verb = action === "approve" ? "disetujui" : "dikembalikan ke Menunggu";
      setBanner({ type: skipped > 0 ? "warn" : "ok", text: r.updated + " shift " + verb + " dan tercatat di database." + (skipped > 0 ? " " + skipped + " dilewati (belum ditutup atau statusnya sudah berubah)." : "") });
      setSelected({}); setExpanded({});
      await load(null);
    } catch (e) { setBanner({ type: "error", text: "Gagal menyimpan: " + e.message }); } finally { setSaving(false); }
  }

  const pendingShown = items.filter((s) => stateOf(s) === "pending");
  const selIds = Object.keys(selected).filter((k) => selected[k]).map(Number);
  const allSel = pendingShown.length > 0 && pendingShown.every((s) => selected[s.id]);
  const groups = [];
  items.forEach((s) => { const g = groups[groups.length - 1]; if (g && g.day === s.day) g.items.push(s); else groups.push({ day: s.day, items: [s] }); });
  const filtered = !!(q || shiftType || from || to);

  return (
    <div className="v4-page">
      <Topbar authUser={authUser} canMonitorAll={true} isAdmin={isAdmin} isOperator={false} onLogout={handleLogout} currentPage="approval" />
      <main className="container">
        {banner && <div className={"fl-banner fl-banner-" + banner.type} role="status">{banner.type === "ok" ? "✓ " : ""}{banner.text}</div>}

        <div className="card apv-filter">
          <div className="catat-chips">
            {TABS.map(([k, label]) => (
              <button key={k} className={"chip" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{label} <b>{counts[k]}</b></button>
            ))}
          </div>
          <input className="field-input" type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Cari shift (nama atau tanggal)..." />
          <div className="catat-chips">
            {[[0, "Semua shift"], [1, "Siang"], [2, "Malam"]].map(([k, label]) => (
              <button key={k} className={"chip" + (shiftType === k ? " active" : "")} onClick={() => setShiftType(k)}>{label}</button>
            ))}
          </div>
          <details className="apv-more" open={!!(from || to)}>
            <summary>Filter tanggal</summary>
            <div className="catat-row">
              <label className="catat-field catat-grow"><span className="catat-label">Dari</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="catat-field catat-grow"><span className="catat-label">Sampai</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
          </details>
          {filtered && <button className="chip apv-reset" onClick={() => { setQInput(""); setShiftType(0); setFrom(""); setTo(""); }}>Reset filter</button>}
        </div>

        {tab === "pending" && pendingShown.length > 0 && (
          <label className="wa-check"><input type="checkbox" checked={allSel} onChange={() => { const n = {}; pendingShown.forEach((s) => { n[s.id] = !allSel; }); setSelected(n); }} /> Pilih semua yang tampil ({pendingShown.length})</label>
        )}

        {loading ? <div className="card"><div className="hint">Memuat...</div></div> : groups.length === 0 ? (
          <div className="card"><div className="hint">{tab === "pending" && !filtered ? "Tidak ada shift yang menunggu approval. Semua sudah beres." : "Tidak ada shift yang cocok dengan filter."}</div></div>
        ) : groups.map((g) => (
          <div key={g.day}>
            <div className="apv-day">{dayLabel(g.day, today)}</div>
            {g.items.map((s) => {
              const st = stateOf(s); const open = !!expanded[s.id];
              return (
                <div key={s.id}>
                  <div className="apv-row">
                    {st === "pending" ? (
                      <label className="apv-check"><input type="checkbox" checked={!!selected[s.id]} onChange={(e) => setSelected({ ...selected, [s.id]: e.target.checked })} aria-label={"Pilih " + s.label} /></label>
                    ) : <span className="apv-check" />}
                    <button className="apv-main" onClick={() => setExpanded({ ...expanded, [s.id]: !open })} aria-expanded={open}>
                      <span className="apv-title">{s.label}</span>
                      <span className="apv-meta">{s.shift_type === 1 ? "Siang" : "Malam"} · {s.open_time}–{s.close_time || "berjalan"} · {s.total} rit</span>
                    </button>
                    <span className={"apv-badge apv-" + st}>{STATE_LABEL[st]}</span>
                  </div>
                  {open && (
                    <div className="apv-detail">
                      {st === "approved" && <div>Disetujui oleh <b>{s.reviewed_by_name || "-"}</b> pada {s.reviewed_at ? new Date(s.reviewed_at).toLocaleString("id-ID") : "-"}.</div>}
                      {st === "open" && <div>Shift ini belum ditutup, jadi belum bisa disetujui.</div>}
                      {st === "pending" && <button className="auth-submit" disabled={saving} onClick={() => act("approve", [s.id])}>{saving ? "Menyimpan..." : "Setujui shift ini"}</button>}
                      {st === "approved" && isAdmin && <button className="btn btn-secondary" disabled={saving} onClick={() => act("revoke", [s.id])}>Batalkan approval</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {!loading && items.length > 0 && (
          <div className="apv-foot">
            <div className="hint">Menampilkan {items.length} dari {counts[tab]} shift</div>
            {nextCursor && <button className="btn btn-secondary apv-loadmore" disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Memuat..." : "Muat lebih banyak"}</button>}
          </div>
        )}
      </main>

      {tab === "pending" && selIds.length > 0 && (
        <div className="fl-actionbar">
          <div className="fl-actionbar-title">{selIds.length} shift dipilih</div>
          <button className="btn btn-primary" disabled={saving} onClick={() => act("approve", selIds)}>{saving ? "Menyimpan..." : "Setujui " + selIds.length + " shift"}</button>
        </div>
      )}
    </div>
  );
}
