import { useEffect, useState, useCallback, useRef } from "react";
import { startPolling } from "@/lib/poll";
import { useRouter } from "next/router";
import { atLeast } from "@/lib/roles";
import Topbar from "@/components/home/Topbar";
import { useToast } from "@/components/Toast";
import { buildWaText } from "@/lib/waText";

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
  const [pitSel, setPitSel] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState({});
  const busyRef = useRef({});
  const [notes, setNotes] = useState({});
  // Popup catat ritasi per unit
  const [popup, setPopup] = useState(null);
  const [pMat, setPMat] = useState("");
  const [pQty, setPQty] = useState("1");
  const [pJam, setPJam] = useState("");
  const [pNote, setPNote] = useState("");
  const [histAll, setHistAll] = useState(null);
  const [histBusy, setHistBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const lastMat = useRef("");
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
    return startPolling(() => { loadRecap(); loadNotes(); }, 8000);
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

  // Catat rit. Mengembalikan true kalau berhasil.
  async function add(u, qty, material, jamVal) {
    if (busyRef.current[u.id]) return false;
    busyRef.current[u.id] = true;
    setBusy({ ...busyRef.current });
    try {
      const res = await fetch("/api/ritasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: u.id,
          material,
          jam: jamVal === "" ? undefined : Number(jamVal),
          qty,
          clientRequestId: newId(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast("Gagal: " + (data.error || res.status), "error"); return false; }
      setRecap(data);
      try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { /* abaikan */ }
      const ids = data.clickIds || (data.clickId ? [data.clickId] : []);
      toast(u.name + " " + material + " +" + qty, "info",
        ids.length ? { label: "Batalkan", onClick: () => undo(ids, u.name) } : null);
      return true;
    } catch (e) {
      toast("Koneksi bermasalah, coba lagi.", "error");
      return false;
    } finally {
      busyRef.current[u.id] = false;
      setBusy({ ...busyRef.current });
    }
  }

  async function saveNote(u, text) {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: u.id, note: text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast("Keterangan gagal disimpan: " + (d.error || res.status), "error");
        return;
      }
      setNotes((prev) => { const n = { ...prev }; if (text) n[u.id] = text; else delete n[u.id]; return n; });
    } catch (e) {
      toast("Keterangan gagal disimpan (koneksi).", "error");
    }
  }

  const loadHist = useCallback(async () => {
    try {
      const res = await fetch("/api/ritasi/history", { cache: "no-store" });
      if (res.ok) setHistAll((await res.json()).clicks || []);
      else setHistAll([]);
    } catch (e) { setHistAll([]); }
  }, []);

  function openPopup(u) {
    setPopup(u);
    setPMat(lastMat.current || "");
    setPQty("1");
    setPJam("");
    setPNote(notes[u.id] || "");
    setConfirmDel(null);
    setHistAll(null);
    loadHist();
  }

  async function submitPopup() {
    if (!popup || !pMat) return;
    const q = Number(pQty);
    if (!Number.isInteger(q) || q < 1 || q > 50) { toast("Jumlah harus bilangan 1-50", "error"); return; }
    const ok = await add(popup, q, pMat, pJam);
    if (!ok) return;
    lastMat.current = pMat;
    const text = pNote.trim().slice(0, 200);
    if (text !== (notes[popup.id] || "")) await saveNote(popup, text);
    setPopup(null);
  }

  // Koreksi material: hapus entri lama lalu catat ulang dengan jam yang sama.
  async function correct(g, newMat) {
    if (!popup || newMat === g.material) return;
    setHistBusy(true);
    let deleted = 0;
    for (const id of g.ids) {
      try {
        const r = await fetch("/api/ritasi/history", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (r.ok) deleted++;
      } catch (e) { /* hitung gagal */ }
    }
    if (deleted === 0) {
      toast("Gagal mengubah material", "error");
    } else {
      let ok = false;
      try {
        const r = await fetch("/api/ritasi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId: popup.id, material: newMat, jam: g.jam, qty: deleted, clientRequestId: newId() }),
        });
        ok = r.ok;
      } catch (e) { ok = false; }
      if (!ok) toast("Entri lama sudah terhapus tapi pencatatan baru gagal. Catat ulang " + deleted + " rit " + newMat + ".", "error");
      else if (deleted < g.ids.length) toast("Sebagian saja yang berubah (" + deleted + " dari " + g.ids.length + " rit)", "error");
      else toast(popup.name + ": " + g.material + " diubah ke " + newMat);
    }
    await loadRecap();
    await loadHist();
    setHistBusy(false);
  }

  async function deleteGroup(g) {
    setConfirmDel(null);
    setHistBusy(true);
    await undo(g.ids, popup ? popup.name : "Entri");
    await loadHist();
    setHistBusy(false);
  }

  // Esc menutup popup
  useEffect(() => {
    if (!popup) return;
    const onKey = (e) => { if (e.key === "Escape") setPopup(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popup]);

  if (authUser === undefined || authUser === null) {
    return <div className="container"><div className="card"><div className="hint">Memuat...</div></div></div>;
  }

  // ---- Area & daftar unit ----
  // Hanya unit aktif yang sudah ditempatkan (punya PIT). Pengawas yang memilih satu PIT
  // hanya melihat PIT itu; "Semua PIT" (GL all area) melihat semua PIT.
  const units = (recap && recap.units) || [];
  const areaPit = authUser.work_pit_name || "";
  const assigned = units.filter((u) => u.active !== false && u.pit_name && (!areaPit || u.pit_name === areaPit));
  const unassignedCount = units.filter((u) => u.active !== false && !u.pit_name).length;

  const NO_PC = "Tanpa PC";
  const pitMap = new Map();
  assigned.forEach((u) => {
    const pit = u.pit_name;
    const fleet = u.fleet_name || NO_PC;
    if (!pitMap.has(pit)) pitMap.set(pit, { name: pit, total: 0, fleets: new Map() });
    const p = pitMap.get(pit);
    if (!p.fleets.has(fleet)) p.fleets.set(fleet, { name: fleet, total: 0, units: [] });
    const f = p.fleets.get(fleet);
    f.units.push(u);
    f.total += u.total;
    p.total += u.total;
  });
  const pits = Array.from(pitMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  pits.forEach((p) => {
    p.fleetList = Array.from(p.fleets.values()).sort((a, b) =>
      a.name === NO_PC ? 1 : b.name === NO_PC ? -1 : a.name.localeCompare(b.name));
  });
  const q = search.trim().toLowerCase();
  const shownPits = pits.filter((p) => areaPit || !pitSel || p.name === pitSel);
  const pitScope = areaPit || pitSel;

  const hours = (recap && recap.hours) || [];
  const curIdx = recap ? hours.indexOf(recap.currentHour) : -1;
  const allowedHours = curIdx >= 0 ? hours.slice(0, curIdx + 1) : hours;
  const pad = (h) => String(h).padStart(2, "0") + ":00";

  const waFromIdx = waFrom === "" ? 0 : Number(waFrom);
  const waToIdx = waTo === "" ? Math.max(allowedHours.length - 1, 0) : Number(waTo);
  const waText = waOpen
    ? buildWaText(recap, { pit: pitScope, fromIdx: waFromIdx, toIdx: waToIdx, perJam: waPerJam, onlyActive: waOnly, notes })
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

  // ---- data popup ----
  const popupUnit = popup ? (units.find((x) => x.id === popup.id) || popup) : null;
  const canModify = (g) => g.operator_id === authUser.id || isAdmin;
  const histGroups = (() => {
    if (!popupUnit || !histAll) return [];
    const map = new Map();
    histAll.filter((c) => c.unit_id === popupUnit.id).forEach((c) => {
      const k = c.material + "|" + c.jam + "|" + c.operator_id;
      if (!map.has(k)) map.set(k, { key: k, material: c.material, jam: c.jam, operator_id: c.operator_id, operator_name: c.operator_name, ids: [] });
      map.get(k).ids.push(c.id);
    });
    return Array.from(map.values()).slice(0, 6);
  })();

  return (
    <div className="v4-page">
      <Topbar authUser={authUser} canMonitorAll={true} isAdmin={isAdmin} isOperator={false} onLogout={handleLogout} currentPage="catat" />
      <main className="container">
        <div className="card">
          <h2 className="sec-title-icon">Catat Ritasi per Hauler</h2>
          <div className="ct-area">Area: <b>{areaPit || "Semua PIT"}</b></div>

          <div className="catat-row">
            <label className="catat-field catat-grow">
              <span className="catat-label">Cari unit</span>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="mis. C577003" />
            </label>
          </div>

          {!areaPit && pits.length > 0 && (
            <div className="catat-chips">
              <button className={"chip" + (pitSel === "" ? " active" : "")} onClick={() => setPitSel("")}>Semua PIT</button>
              {pits.map((p) => (
                <button key={p.name} className={"chip" + (pitSel === p.name ? " active" : "")} onClick={() => setPitSel(p.name)}>
                  {p.name} <b>{p.total}</b>
                </button>
              ))}
            </div>
          )}

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
              <div className="catat-label">Cakupan: {pitScope || "Semua PIT"}{areaPit ? "" : " (ubah lewat chip PIT di atas)"}</div>
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
            {p.fleetList.map((f) => {
              const list = q ? f.units.filter((u) => u.name.toLowerCase().includes(q)) : f.units;
              if (list.length === 0) return null;
              const key = p.name + "/" + f.name;
              const open = q !== "" || !collapsed[key];
              return (
                <section key={key} className="fl-group ct-group">
                  <div className="fl-group-head">
                    <button type="button" className="fl-group-toggle" aria-expanded={open} onClick={() => setCollapsed({ ...collapsed, [key]: !collapsed[key] })}>
                      <span className={"fl-chev" + (open ? " is-open" : "")} aria-hidden="true" />
                      <span className="fl-group-name">{f.name}</span>
                      <span className="fl-badge">{f.units.length} HD</span>
                    </button>
                    <b className="ct-group-total">{f.total} rit</b>
                  </div>
                  {open && (
                    <div className="fl-tiles">
                      {list.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className={"fl-tile ct-tile" + (u.total > 0 ? " has-rit" : "")}
                          onClick={() => openPopup(u)}
                          title={u.name + (notes[u.id] ? " · " + notes[u.id] : "")}
                        >
                          <span className="fl-tile-name">{u.name}</span>
                          {u.total > 0 && <span className="ct-tile-total">{u.total} rit</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ))}

        {recap && assigned.length === 0 && (
          <div className="card">
            <div className="hint">
              {areaPit ? "Belum ada unit yang ditempatkan di " + areaPit + "." : "Belum ada unit yang ditempatkan di PIT mana pun."}
            </div>
          </div>
        )}
        {recap && (
          <div className="ct-hint">
            {unassignedCount > 0 ? unassignedCount + " unit belum ditempatkan dan tidak ditampilkan. " : ""}
            Unit belum ada di daftar? <a className="ct-link" href="/admin/fleet">Tempatkan dulu di Kelola Fleet</a>.
          </div>
        )}
      </main>

      {popupUnit && (
        <div className="fl-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPopup(null); }}>
          <div className="fl-modal ct-modal" role="dialog" aria-modal="true" aria-labelledby="ct-title">
            <h3 id="ct-title" className="fl-modal-title">{popupUnit.name}</h3>
            <div className="fl-modal-sub">{popupUnit.fleet_name || NO_PC} &middot; {popupUnit.pit_name} &middot; total {popupUnit.total} rit</div>

            <div className="catat-label">Material</div>
            <div className="catat-chips">
              {MATERIALS.map((m) => (
                <button type="button" key={m} className={"chip" + (pMat === m ? " active" : "")} onClick={() => setPMat(m)}>{m}</button>
              ))}
            </div>

            <div className="catat-label">Jumlah rit</div>
            <div className="ct-qty">
              <button type="button" className="qty-btn" aria-label="Kurangi" onClick={() => setPQty(String(Math.max(1, (Number(pQty) || 1) - 1)))}>-</button>
              <input className="field-input" type="number" inputMode="numeric" min="1" max="50" value={pQty} onChange={(e) => setPQty(e.target.value)} aria-label="Jumlah rit" />
              <button type="button" className="qty-btn" aria-label="Tambah" onClick={() => setPQty(String(Math.min(50, (Number(pQty) || 0) + 1)))}>+</button>
              {QUICK.map((n) => (
                <button type="button" key={n} className={"chip" + (Number(pQty) === n ? " active" : "")} onClick={() => setPQty(String(n))}>{n}</button>
              ))}
            </div>

            <div className="ct-two">
              <label className="catat-field">
                <span className="catat-label">Jam</span>
                <select value={pJam} onChange={(e) => setPJam(e.target.value)}>
                  <option value="">Sekarang{recap ? " (" + pad(recap.currentHour) + ")" : ""}</option>
                  {allowedHours.map((h) => <option key={h} value={h}>{pad(h)}</option>)}
                </select>
              </label>
              <label className="catat-field catat-grow">
                <span className="catat-label">Keterangan (opsional)</span>
                <input className="field-input" type="text" maxLength={200} value={pNote} onChange={(e) => setPNote(e.target.value)} placeholder="mis. antri di loading" />
              </label>
            </div>

            <div className="fl-modal-actions">
              <button type="button" className="btn btn-secondary w-auto px-16" onClick={() => setPopup(null)}>Batal</button>
              <button type="button" className="btn btn-primary w-auto px-16" disabled={!pMat || !!busy[popupUnit.id]} onClick={submitPopup}>
                {busy[popupUnit.id] ? "Menyimpan..." : !pMat ? "Pilih material dulu" : "Simpan " + (Number(pQty) || 0) + " rit " + pMat}
              </button>
            </div>

            <div className="ct-hist">
              <div className="catat-label">Entri terbaru unit ini</div>
              {histAll === null ? (
                <div className="hint">Memuat...</div>
              ) : histGroups.length === 0 ? (
                <div className="hint">Belum ada entri di shift ini (dalam 50 entri terbaru).</div>
              ) : histGroups.map((g) => (
                <div key={g.key} className="ct-hist-row">
                  <div className="ct-hist-main">
                    <b>{g.material}</b> &middot; {pad(g.jam)} &middot; {g.ids.length} rit
                    <small>{g.operator_name || "-"}</small>
                  </div>
                  {canModify(g) ? (
                    <div className="ct-hist-actions">
                      <select aria-label="Ubah material" value={g.material} disabled={histBusy} onChange={(e) => correct(g, e.target.value)}>
                        {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {confirmDel === g.key ? (
                        <button type="button" className="qty-btn ct-danger" disabled={histBusy} onClick={() => deleteGroup(g)}>Yakin hapus?</button>
                      ) : (
                        <button type="button" className="qty-btn" disabled={histBusy} onClick={() => setConfirmDel(g.key)}>Hapus</button>
                      )}
                    </div>
                  ) : (
                    <small className="ct-hist-lock">Hanya penginput / admin</small>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
