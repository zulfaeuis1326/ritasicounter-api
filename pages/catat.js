import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { atLeast } from "../lib/roles";
import Topbar from "../components/home/Topbar";
import { useToast } from "../components/Toast";
import { buildWaText } from "../lib/waText";

const MATERIALS = ["OB", "COAL", "SOIL", "SOLU", "MUD"];
const QUICK = [1, 2, 5];

function newId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Halaman khusus pengawas: catat ritasi per hauler, dikelompokkan PIT > Fleet > Hauler.
// Cocok untuk mencatat dari laporan radio ("HD-101 tiga rit").
export default function CatatRitasi() {
  const router = useRouter();
  const toast = useToast();
  const [authUser, setAuthUser] = useState(undefined);
  const [recap, setRecap] = useState(null);
  const [recapError, setRecapError] = useState(null);
  const [material, setMaterial] = useState("OB");
  const [jam, setJam] = useState("");
  const [pitSel, setPitSel] = useState("");
  const [openFleets, setOpenFleets] = useState({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState({});
  const busyRef = useRef({});
  const [notes, setNotes] = useState({});
  const [waOpen, setWaOpen] = useState(false);
  const [waFrom, setWaFrom] = useState("");
  const [waTo, setWaTo] = useState("");
  const [waPerJam, setWaPerJam] = useState(false);
  const [waOnly, setWaOnly] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => {
        if (!d.user) router.push("/login");
        else if (!atLeast(d.user.role, "pengawas")) router.push("/");
        else setAuthUser(d.user);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const loadRecap = useCallback(async () => {
    try {
      const res = await fetch("/api/ritasi", { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setRecapError(d.error || "Error " + res.status);
        return;
      }
      setRecap(await res.json());
      setRecapError(null);
    } catch (e) {
      setRecapError("Koneksi bermasalah");
    }
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/notes", { cache: "no-store" });
      if (res.ok) setNotes((await res.json()).notes || {});
    } catch (e) { /* abaikan, coba lagi di polling berikutnya */ }
  }, []);

  useEffect(() => {
    if (!authUser) return;
    loadRecap();
    loadNotes();
    const t = setInterval(() => { loadRecap(); loadNotes(); }, 8000);
    return () => clearInterval(t);
  }, [authUser, loadRecap, loadNotes]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function undo(ids, name) {
    let failed = 0;
    for (const id of ids) {
      try {
        const r = await fetch("/api/ritasi/history", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!r.ok) failed++;
      } catch (e) { failed++; }
    }
    await loadRecap();
    if (failed) toast(failed + " rit gagal dibatalkan", "error");
    else toast(name + " dibatalkan");
  }

  async function add(u, qty) {
    if (busyRef.current[u.id]) return;
    busyRef.current[u.id] = true;
    setBusy({ ...busyRef.current });
    try {
      const res = await fetch("/api/ritasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: u.id,
          material,
          jam: jam === "" ? undefined : Number(jam),
          qty,
          clientRequestId: newId(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast("Gagal: " + (data.error || res.status), "error"); return; }
      setRecap(data);
      try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { /* abaikan */ }
      const ids = data.clickIds || (data.clickId ? [data.clickId] : []);
      toast(u.name + " " + material + " +" + qty, "info",
        ids.length ? { label: "Batalkan", onClick: () => undo(ids, u.name) } : null);
    } catch (e) {
      toast("Koneksi bermasalah, coba lagi.", "error");
    } finally {
      busyRef.current[u.id] = false;
      setBusy({ ...busyRef.current });
    }
  }

  async function editNote(u) {
    const raw = window.prompt("Keterangan untuk " + u.name + " (kosongkan untuk menghapus):", notes[u.id] || "");
    if (raw === null) return;
    const text = raw.trim().slice(0, 200);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: u.id, note: text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast("Gagal: " + (d.error || res.status), "error");
        return;
      }
      setNotes((prev) => { const n = { ...prev }; if (text) n[u.id] = text; else delete n[u.id]; return n; });
      toast(text ? "Keterangan disimpan" : "Keterangan dihapus");
    } catch (e) {
      toast("Koneksi bermasalah, coba lagi.", "error");
    }
  }

  function addCustom(u) {
    const raw = window.prompt("Jumlah rit " + material + " untuk " + u.name + " (1-50):", "3");
    if (raw === null) return;
    const v = Number(raw);
    if (!Number.isInteger(v) || v < 1 || v > 50) { toast("Jumlah harus bilangan 1-50", "error"); return; }
    add(u, v);
  }

  if (authUser === undefined || authUser === null) {
    return <div className="container"><div className="card"><div className="hint">Memuat...</div></div></div>;
  }

  // ---- susun PIT > Fleet > Hauler ----
  const units = (recap && recap.units) || [];
  const pitMap = new Map();
  units.forEach((u) => {
    const pit = u.pit_name || "Belum ada PIT";
    const fleet = u.fleet_name || "Belum ada Fleet";
    if (!pitMap.has(pit)) pitMap.set(pit, { name: pit, total: 0, fleets: new Map() });
    const p = pitMap.get(pit);
    if (!p.fleets.has(fleet)) p.fleets.set(fleet, { name: fleet, total: 0, units: [] });
    const f = p.fleets.get(fleet);
    f.units.push(u);
    f.total += u.total;
    p.total += u.total;
  });
  const pits = Array.from(pitMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const q = search.trim().toLowerCase();
  const shownPits = pits.filter((p) => !pitSel || p.name === pitSel);

  const hours = (recap && recap.hours) || [];
  const curIdx = recap ? hours.indexOf(recap.currentHour) : -1;
  const allowedHours = curIdx >= 0 ? hours.slice(0, curIdx + 1) : hours;
  const pad = (h) => String(h).padStart(2, "0") + ":00";

  const waFromIdx = waFrom === "" ? 0 : Number(waFrom);
  const waToIdx = waTo === "" ? Math.max(allowedHours.length - 1, 0) : Number(waTo);
  const waText = waOpen
    ? buildWaText(recap, { pit: pitSel, fromIdx: waFromIdx, toIdx: waToIdx, perJam: waPerJam, onlyActive: waOnly, notes })
    : "";

  function openWa() {
    window.open("https://wa.me/?text=" + encodeURIComponent(waText), "_blank");
  }
  async function copyWa() {
    try {
      await navigator.clipboard.writeText(waText);
      toast("Teks disalin. Tempel di WhatsApp.");
    } catch (e) {
      const ta = document.getElementById("wa-text");
      if (ta) { ta.select(); document.execCommand("copy"); toast("Teks disalin."); }
    }
  }

  const isAdmin = atLeast(authUser.role, "admin");

  return (
    <div className="v4-page">
      <Topbar authUser={authUser} canMonitorAll={true} isAdmin={isAdmin} isOperator={false} onLogout={handleLogout} currentPage="catat" />
      <main className="container">
        <div className="card">
          <h2 className="sec-title-icon">Catat Ritasi per Hauler</h2>

          <div className="catat-label">Material</div>
          <div className="catat-chips">
            {MATERIALS.map((m) => (
              <button key={m} className={"chip" + (material === m ? " active" : "")} onClick={() => setMaterial(m)}>{m}</button>
            ))}
          </div>

          <div className="catat-row">
            <label className="catat-field">
              <span className="catat-label">Jam</span>
              <select value={jam} onChange={(e) => setJam(e.target.value)}>
                <option value="">Sekarang{recap ? " (" + pad(recap.currentHour) + ")" : ""}</option>
                {allowedHours.map((h) => <option key={h} value={h}>{pad(h)}</option>)}
              </select>
            </label>
            <label className="catat-field catat-grow">
              <span className="catat-label">Cari unit</span>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="mis. HD-101" />
            </label>
          </div>

          <div className="catat-chips">
            <button className={"chip" + (pitSel === "" ? " active" : "")} onClick={() => setPitSel("")}>Semua PIT</button>
            {pits.map((p) => (
              <button key={p.name} className={"chip" + (pitSel === p.name ? " active" : "")} onClick={() => setPitSel(p.name)}>
                {p.name} <b>{p.total}</b>
              </button>
            ))}
          </div>
          <div className="catat-row">
            <button className="wa-btn" onClick={() => setWaOpen(!waOpen)}>{waOpen ? "Tutup laporan WA" : "Kirim ke WhatsApp"}</button>
          </div>
          {waOpen && (
            <div className="wa-panel">
              <div className="catat-row">
                <label className="catat-field catat-grow">
                  <span className="catat-label">Dari jam</span>
                  <select value={waFrom} onChange={(e) => setWaFrom(e.target.value)}>
                    <option value="">Awal shift</option>
                    {allowedHours.map((h, i) => <option key={h} value={i}>{pad(h)}</option>)}
                  </select>
                </label>
                <label className="catat-field catat-grow">
                  <span className="catat-label">Sampai jam</span>
                  <select value={waTo} onChange={(e) => setWaTo(e.target.value)}>
                    <option value="">Jam terakhir</option>
                    {allowedHours.map((h, i) => <option key={h} value={i}>{pad(h)}</option>)}
                  </select>
                </label>
              </div>
              <label className="wa-check"><input type="checkbox" checked={waPerJam} onChange={(e) => setWaPerJam(e.target.checked)} /> Tampilkan rincian per jam</label>
              <label className="wa-check"><input type="checkbox" checked={waOnly} onChange={(e) => setWaOnly(e.target.checked)} /> Hanya unit yang ada ritasi atau keterangan</label>
              <div className="catat-label">Cakupan: {pitSel || "Semua PIT"} (ubah lewat chip PIT di atas)</div>
              <textarea id="wa-text" className="wa-text" readOnly value={waText} rows={12} />
              <div className="catat-row">
                <button className="wa-btn" onClick={openWa}>Buka WhatsApp</button>
                <button className="chip" onClick={copyWa}>Salin teks</button>
              </div>
              {waText.length > 3000 && <div className="hint">Pesan panjang. Kalau WhatsApp memotong teksnya, pakai Salin lalu tempel.</div>}
            </div>
          )}
          {recapError && <div className="hint c-danger">Error: {recapError}</div>}
        </div>

        {shownPits.map((p) => (
          <div key={p.name}>
            <div className="catat-pit"><span>{p.name}</span><b>{p.total} rit</b></div>
            {Array.from(p.fleets.values()).map((f) => {
              const list = q ? f.units.filter((u) => u.name.toLowerCase().includes(q)) : f.units;
              if (list.length === 0) return null;
              const key = p.name + "/" + f.name;
              const open = q !== "" || openFleets[key] === true;
              return (
                <div key={key} className="fleet-card">
                  <button className="fleet-head" onClick={() => setOpenFleets((prev) => ({ ...prev, [key]: !open }))}>
                    <span className={"fleet-caret" + (open ? " open" : "")}>&#9656;</span>
                    <span className="fleet-name">{f.name}</span>
                    <span className="fleet-meta">{f.units.length} HD</span>
                    <b className="fleet-total">{f.total}</b>
                  </button>
                  {open && list.map((u) => (
                    <div key={u.id} className="hauler-row">
                      <div className="hauler-info">
                        <span className="hauler-name">{u.name}</span>
                        <small>total {u.total} &middot; {material} {(u.materialTotals && u.materialTotals[material]) || 0}</small>
                        <button className="note-link" onClick={() => editNote(u)}>
                          {notes[u.id] ? "Ket: " + notes[u.id] : "+ keterangan"}
                        </button>
                      </div>
                      <div className="hauler-btns">
                        {QUICK.map((n) => (
                          <button key={n} className="qty-btn" disabled={!!busy[u.id]} onClick={() => add(u, n)}>+{n}</button>
                        ))}
                        <button className="qty-btn qty-more" disabled={!!busy[u.id]} onClick={() => addCustom(u)}>...</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
        {recap && units.length === 0 && <div className="card"><div className="hint">Belum ada unit aktif. Tambahkan di Kelola Fleet.</div></div>}
      </main>
    </div>
  );
}
