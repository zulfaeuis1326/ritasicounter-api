import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { atLeast } from "../../lib/roles";
import Topbar from "../../components/home/Topbar";

const KEEP = "__keep";   // pilihan "jangan diubah"
const NONE = "__none";   // pilihan "lepas / kosongkan"
const TABS = [["hd", "Penempatan HD"], ["pc", "PC / Loader"], ["pit", "Lokasi (PIT)"], ["add", "Tambah HD"]];

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error " + res.status);
  return data;
}

export default function KelolaFleet() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(undefined);
  const [tab, setTab] = useState("hd");
  const [fleets, setFleets] = useState([]);
  const [units, setUnits] = useState([]);
  const [pits, setPits] = useState([]);
  const [banner, setBanner] = useState(null); // { type: "ok" | "warn" | "error", text }
  const [saving, setSaving] = useState(false);

  // tab Penempatan HD
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState({});
  const [pcChoice, setPcChoice] = useState(KEEP);
  const [pitChoice, setPitChoice] = useState(KEEP);
  const [followPit, setFollowPit] = useState(true);
  // tab PC
  const [fleetPitDraft, setFleetPitDraft] = useState({});
  const [newFleetName, setNewFleetName] = useState("");
  const [newFleetPit, setNewFleetPit] = useState("");
  // tab PIT
  const [newPitName, setNewPitName] = useState("");
  // tab Tambah HD
  const [bulkNames, setBulkNames] = useState("");
  const [addFleet, setAddFleet] = useState("");
  const [addPit, setAddPit] = useState("");

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

  // Muat ulang dari database. Mengembalikan daftar unit terbaru (dipakai untuk memeriksa hasil simpan).
  const loadAll = useCallback(async () => {
    const [f, u, p] = await Promise.all([api("GET", "/api/fleets"), api("GET", "/api/units"), api("GET", "/api/pits")]);
    setFleets(f); setUnits(u); setPits(p);
    return u;
  }, []);

  useEffect(() => {
    if (authUser) loadAll().catch((e) => setBanner({ type: "error", text: "Gagal memuat data: " + e.message }));
  }, [authUser, loadAll]);

  if (authUser === undefined || authUser === null) {
    return <div className="container"><div className="card"><div className="hint">Memuat...</div></div></div>;
  }
  const isAdmin = atLeast(authUser.role, "admin");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  const fail = (e) => setBanner({ type: "error", text: "Gagal menyimpan: " + e.message });

  // ---------- Penempatan HD ----------
  const q = search.trim().toLowerCase();
  const shown = units.filter((u) =>
    (!q || u.name.toLowerCase().includes(q) || (u.fleet_name || "").toLowerCase().includes(q)) &&
    (filter === "all" || (filter === "nofleet" && !u.fleet_id) || (filter === "nopit" && !u.pit_id))
  );
  const selIds = Object.keys(selected).filter((k) => selected[k]).map(Number);
  const allShownSelected = shown.length > 0 && shown.every((u) => selected[u.id]);

  function toggleAllShown() {
    const next = { ...selected };
    shown.forEach((u) => { next[u.id] = !allShownSelected; });
    setSelected(next);
  }

  async function saveAssign() {
    const setFleet = pcChoice !== KEEP;
    const fleetId = pcChoice === NONE || !setFleet ? null : Number(pcChoice);
    let setPit = pitChoice !== KEEP;
    let pitId = pitChoice === NONE || !setPit ? null : Number(pitChoice);
    // HD yang dimasukkan ke PC otomatis ikut PIT milik PC itu (kecuali PIT dipilih sendiri)
    if (setFleet && fleetId && !setPit && followPit) {
      const f = fleets.find((x) => x.id === fleetId);
      if (f && f.pit_id) { setPit = true; pitId = f.pit_id; }
    }
    if (!setFleet && !setPit) { setBanner({ type: "error", text: "Pilih PC atau lokasi tujuan dulu." }); return; }
    setSaving(true);
    try {
      const r = await api("POST", "/api/units", { action: "bulk_assign", unitIds: selIds, setFleet, fleetId, setPit, pitId });
      const fresh = await loadAll(); // baca ulang dari database untuk membuktikan data benar-benar tersimpan
      const cocok = selIds.every((id) => {
        const u = fresh.find((x) => x.id === id);
        return u && (!setFleet || (u.fleet_id || null) === fleetId) && (!setPit || (u.pit_id || null) === pitId);
      });
      setBanner(cocok
        ? { type: "ok", text: "Tersimpan di database: " + r.updated + " unit diperbarui dan sudah dicek ulang." }
        : { type: "warn", text: "Server menjawab sukses, tapi sebagian data belum sesuai. Muat ulang halaman dan cek lagi." });
      setSelected({}); setPcChoice(KEEP); setPitChoice(KEEP);
    } catch (e) { fail(e); } finally { setSaving(false); }
  }

  // ---------- PC / Loader ----------
  async function saveFleetPit(f) {
    const val = fleetPitDraft[f.id];
    setSaving(true);
    try {
      await api("POST", "/api/fleets", { action: "set_pit", fleetId: f.id, pitId: val === NONE ? null : Number(val) });
      await loadAll();
      setFleetPitDraft((p) => { const n = { ...p }; delete n[f.id]; return n; });
      setBanner({ type: "ok", text: "Lokasi PC " + f.name + " tersimpan di database." });
    } catch (e) { fail(e); } finally { setSaving(false); }
  }
  async function addNewFleet(e) {
    e.preventDefault();
    if (!newFleetName.trim()) return;
    setSaving(true);
    try {
      await api("POST", "/api/fleets", { name: newFleetName.trim(), pitId: newFleetPit ? Number(newFleetPit) : null });
      await loadAll();
      setBanner({ type: "ok", text: "PC " + newFleetName.trim() + " tersimpan di database." });
      setNewFleetName(""); setNewFleetPit("");
    } catch (err) { fail(err); } finally { setSaving(false); }
  }

  // ---------- PIT ----------
  async function addNewPit(e) {
    e.preventDefault();
    if (!newPitName.trim()) return;
    setSaving(true);
    try {
      await api("POST", "/api/pits", { name: newPitName.trim() });
      await loadAll();
      setBanner({ type: "ok", text: "Lokasi " + newPitName.trim().toUpperCase() + " tersimpan di database." });
      setNewPitName("");
    } catch (err) { fail(err); } finally { setSaving(false); }
  }

  // ---------- Tambah HD ----------
  async function addUnits(e) {
    e.preventDefault();
    const names = bulkNames.split("\n").map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    setSaving(true);
    try {
      const r = await api("POST", "/api/units", {
        action: "create_many", names,
        fleetId: addFleet ? Number(addFleet) : null, pitId: addPit ? Number(addPit) : null,
      });
      await loadAll();
      const skip = r.skipped.length ? " Sudah ada (dilewati): " + r.skipped.join(", ") + "." : "";
      setBanner({ type: r.created > 0 ? "ok" : "warn", text: r.created + " unit baru tersimpan di database." + skip });
      setBulkNames("");
    } catch (err) { fail(err); } finally { setSaving(false); }
  }

  const noFleet = units.filter((u) => !u.fleet_id).length;
  const noPit = units.filter((u) => !u.pit_id).length;
  const pitSelect = (value, onChange, keepLabel) => (
    <select className="field-input" value={value} onChange={(e) => onChange(e.target.value)}>
      {keepLabel && <option value={KEEP}>{keepLabel}</option>}
      <option value={keepLabel ? NONE : ""}>{keepLabel ? "-- Kosongkan lokasi --" : "-- Tanpa lokasi --"}</option>
      {pits.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );

  return (
    <div className="v4-page">
      <Topbar authUser={authUser} canMonitorAll={true} isAdmin={isAdmin} isOperator={false} onLogout={handleLogout} currentPage="fleet" />
      <main className="container">
        <div className="fl-summary">
          <div><b>{units.length}</b><span>HD</span></div>
          <div><b>{fleets.length}</b><span>PC</span></div>
          <div><b>{pits.length}</b><span>Lokasi</span></div>
          <div className={noFleet ? "fl-warn" : ""}><b>{noFleet}</b><span>HD tanpa PC</span></div>
          <div className={noPit ? "fl-warn" : ""}><b>{noPit}</b><span>HD tanpa lokasi</span></div>
        </div>

        <div className="catat-chips">
          {TABS.filter(([k]) => k !== "add" || isAdmin).map(([k, label]) => (
            <button key={k} className={"chip" + (tab === k ? " active" : "")} onClick={() => { setTab(k); setBanner(null); }}>{label}</button>
          ))}
        </div>

        {banner && <div className={"fl-banner fl-banner-" + banner.type} role="status">{banner.type === "ok" ? "✓ " : ""}{banner.text}</div>}

        {tab === "hd" && (
          <div className="card">
            <h2 className="sec-title-icon">Penempatan HD</h2>
            <div className="hint mb-8">Centang satu atau banyak HD, pilih PC dan/atau lokasi tujuan di bawah, lalu tekan Simpan.</div>
            <input className="field-input mb-8" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari HD atau nama PC..." />
            <div className="catat-chips">
              {[["all", "Semua (" + units.length + ")"], ["nofleet", "Belum ada PC (" + noFleet + ")"], ["nopit", "Belum ada lokasi (" + noPit + ")"]].map(([k, label]) => (
                <button key={k} className={"chip" + (filter === k ? " active" : "")} onClick={() => setFilter(k)}>{label}</button>
              ))}
            </div>
            <label className="wa-check"><input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} /> Pilih semua yang tampil ({shown.length})</label>
            {shown.map((u) => (
              <label key={u.id} className="fl-row">
                <input type="checkbox" checked={!!selected[u.id]} onChange={(e) => setSelected({ ...selected, [u.id]: e.target.checked })} />
                <span className="fl-name">{u.name}</span>
                <span className={"fl-badge" + (u.fleet_name ? "" : " fl-badge-empty")}>{u.fleet_name || "tanpa PC"}</span>
                <span className={"fl-badge" + (u.pit_name ? "" : " fl-badge-empty")}>{u.pit_name || "tanpa lokasi"}</span>
              </label>
            ))}
            {shown.length === 0 && <div className="hint">Tidak ada HD yang cocok.{isAdmin ? " Tambahkan lewat tab Tambah HD." : ""}</div>}
          </div>
        )}

        {tab === "pc" && (
          <>
            <div className="card">
              <h2 className="sec-title-icon">PC / Loader</h2>
              {fleets.map((f) => {
                const draft = fleetPitDraft[f.id];
                const value = draft !== undefined ? draft : (f.pit_id ? String(f.pit_id) : "");
                const members = units.filter((u) => u.fleet_id === f.id).length;
                return (
                  <div key={f.id} className="fl-pcrow">
                    <div className="fl-name">{f.name} <span className="fl-badge">{members} HD</span></div>
                    {pitSelect(value, (v) => setFleetPitDraft({ ...fleetPitDraft, [f.id]: v === "" ? NONE : v }), null)}
                    {draft !== undefined && (
                      <button className="btn btn-primary mt-8" disabled={saving} onClick={() => saveFleetPit(f)}>{saving ? "Menyimpan..." : "Simpan lokasi " + f.name}</button>
                    )}
                  </div>
                );
              })}
              {fleets.length === 0 && <div className="hint">Belum ada PC. Tambahkan di bawah.</div>}
            </div>
            <form className="card" onSubmit={addNewFleet}>
              <h2 className="sec-title-icon">Tambah PC / Loader</h2>
              <div className="field-label mb-6">Nama PC</div>
              <input className="field-input mb-12" value={newFleetName} onChange={(e) => setNewFleetName(e.target.value)} placeholder="Contoh: E52099" />
              <div className="field-label mb-6">Lokasi (PIT)</div>
              {pitSelect(newFleetPit, setNewFleetPit, null)}
              <button className="auth-submit mt-12" disabled={saving || !newFleetName.trim()}>{saving ? "Menyimpan..." : "Simpan PC"}</button>
            </form>
          </>
        )}

        {tab === "pit" && (
          <>
            <div className="card">
              <h2 className="sec-title-icon">Lokasi (PIT)</h2>
              {pits.map((p) => (
                <div key={p.id} className="fl-row">
                  <span className="fl-name">{p.name}</span>
                  <span className="fl-badge">{fleets.filter((f) => f.pit_id === p.id).length} PC</span>
                  <span className="fl-badge">{units.filter((u) => u.pit_id === p.id).length} HD</span>
                </div>
              ))}
            </div>
            <form className="card" onSubmit={addNewPit}>
              <h2 className="sec-title-icon">Tambah Lokasi</h2>
              <input className="field-input mb-12" value={newPitName} onChange={(e) => setNewPitName(e.target.value)} placeholder="Contoh: PIT BARU" />
              <button className="auth-submit" disabled={saving || !newPitName.trim()}>{saving ? "Menyimpan..." : "Simpan Lokasi"}</button>
            </form>
          </>
        )}

        {tab === "add" && isAdmin && (
          <form className="card" onSubmit={addUnits}>
            <h2 className="sec-title-icon">Tambah HD</h2>
            <div className="hint mb-8">Satu nama per baris. Nama yang sudah ada otomatis dilewati.</div>
            <textarea className="field-input mb-12" rows={6} value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} placeholder={"HD-101\nHD-102\nHD-103"} />
            <div className="field-label mb-6">Langsung masukkan ke PC (opsional)</div>
            <select className="field-input mb-12" value={addFleet} onChange={(e) => setAddFleet(e.target.value)}>
              <option value="">-- Tanpa PC --</option>
              {fleets.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <div className="field-label mb-6">Lokasi (opsional)</div>
            {pitSelect(addPit, setAddPit, null)}
            <button className="auth-submit mt-12" disabled={saving || !bulkNames.trim()}>{saving ? "Menyimpan..." : "Simpan Unit"}</button>
          </form>
        )}

        <div className="app-footer">designed by Najib.dev</div>
      </main>

      {tab === "hd" && selIds.length > 0 && (
        <div className="fl-actionbar">
          <div className="fl-actionbar-title">{selIds.length} HD dipilih</div>
          <div className="fl-actionbar-row">
            <select className="field-input" value={pcChoice} onChange={(e) => setPcChoice(e.target.value)}>
              <option value={KEEP}>PC: jangan diubah</option>
              <option value={NONE}>PC: lepas dari PC</option>
              {fleets.map((f) => <option key={f.id} value={f.id}>PC: {f.name}</option>)}
            </select>
            {pitSelect(pitChoice, setPitChoice, "Lokasi: jangan diubah")}
          </div>
          {pcChoice !== KEEP && pcChoice !== NONE && pitChoice === KEEP && (
            <label className="wa-check"><input type="checkbox" checked={followPit} onChange={(e) => setFollowPit(e.target.checked)} /> Ikuti lokasi milik PC</label>
          )}
          <button className="btn btn-primary" disabled={saving} onClick={saveAssign}>{saving ? "Menyimpan..." : "Simpan Penempatan"}</button>
        </div>
      )}
    </div>
  );
}
