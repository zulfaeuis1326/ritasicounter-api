import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { atLeast } from "../../lib/roles";
import Combobox from "../../components/Combobox";

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function KelolaFleet() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(undefined);
  const [fleets, setFleets] = useState([]);
  const [units, setUnits] = useState([]);
  const [pits, setPits] = useState([]);
  const [error, setError] = useState(null);

  const [selectedUnitId, setSelectedUnitId] = useState("");

  const [showAddPit, setShowAddPit] = useState(false);
  const [showAddPc, setShowAddPc] = useState(false);
  const [newPitName, setNewPitName] = useState("");
  const [newFleetName, setNewFleetName] = useState("");
  const [newFleetPit, setNewFleetPit] = useState("");

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

  const loadAll = useCallback(async () => {
    try {
      const [fRes, uRes, pRes] = await Promise.all([
        fetch("/api/fleets"),
        fetch("/api/units"),
        fetch("/api/pits"),
      ]);
      if (fRes.ok) setFleets(await fRes.json());
      if (uRes.ok) setUnits(await uRes.json());
      if (pRes.ok) setPits(await pRes.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (authUser) loadAll();
  }, [authUser, loadAll]);

  async function handleAddPit(e) {
    e.preventDefault();
    if (!newPitName.trim()) return;
    try {
      const res = await fetch("/api/pits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPitName.trim() }),
      });
      if (res.ok) {
        setNewPitName("");
        setShowAddPit(false);
        await loadAll();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal tambah lokasi: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal tambah lokasi (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleAddFleet(e) {
    e.preventDefault();
    if (!newFleetName.trim()) return;
    try {
      const res = await fetch("/api/fleets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFleetName.trim(), pitId: newFleetPit || null }),
      });
      if (res.ok) {
        setNewFleetName("");
        setNewFleetPit("");
        setShowAddPc(false);
        await loadAll();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal tambah PC: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal tambah PC (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleAssignFleet(unitId, fleetId) {
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_fleet", unitId, fleetId: fleetId || null }),
      });
      if (res.ok) await loadAll();
      else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal assign PC: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal assign PC (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleSetUnitPit(unitId, pitId) {
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_pit", unitId, pitId: pitId || null }),
      });
      if (res.ok) await loadAll();
      else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal ubah lokasi: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal ubah lokasi (koneksi/server bermasalah): ${err.message}`);
    }
  }

  if (authUser === undefined || authUser === null) {
    return (
      <div className="container">
        <div className="card"><div className="hint">Memuat...</div></div>
      </div>
    );
  }

  const unitOptions = units.map((u) => ({
    value: String(u.id),
    label: `${u.name}${u.fleet_name ? " → " + u.fleet_name : ""}${u.pit_name ? " (" + u.pit_name + ")" : ""}`,
  }));
  const fleetOptions = fleets.map((f) => ({ value: String(f.id), label: f.name }));
  const pitOptions = pits.map((p) => ({ value: String(p.id), label: p.name }));

  const selectedUnit = units.find((u) => String(u.id) === selectedUnitId) || null;

  return (
    <div className="container">
      <div className="card header-card">
        <div className="clock" style={{ fontSize: 22 }}>Kelola Fleet</div>
        <a href="/" className="hint" style={{ display: "block", textAlign: "center", marginTop: 6 }}>
          ← Kembali ke Monitoring
        </a>
      </div>

      {error && (
        <div className="card"><div className="hint" style={{ color: "var(--danger)" }}>Error: {error}</div></div>
      )}

      <div className="card">
        <div className="section-title">Unit Hauler → Masuk PC Berapa, Lokasi Mana</div>
        <div className="field-label" style={{ marginBottom: 6 }}>Unit</div>
        <Combobox
          value={selectedUnitId}
          onChange={setSelectedUnitId}
          options={unitOptions}
          placeholder="Cari unit, misal H572..."
        />

        {selectedUnit && (
          <div className="fleet-detail-panel">
            <div className="fleet-detail-title">{selectedUnit.name}</div>

            <div className="field-label" style={{ marginBottom: 6 }}>Masuk PC (Fleet)</div>
            <Combobox
              value={selectedUnit.fleet_id ? String(selectedUnit.fleet_id) : ""}
              onChange={(val) => handleAssignFleet(selectedUnit.id, val)}
              options={fleetOptions}
              placeholder="Cari PC, misal E520..."
              emptyLabel="-- Belum gabung PC --"
            />

            <div className="field-label" style={{ marginBottom: 6, marginTop: 12 }}>Lokasi (PIT)</div>
            <Combobox
              value={selectedUnit.pit_id ? String(selectedUnit.pit_id) : ""}
              onChange={(val) => handleSetUnitPit(selectedUnit.id, val)}
              options={pitOptions}
              placeholder="Cari lokasi..."
              emptyLabel="-- Belum ada lokasi --"
            />
          </div>
        )}
      </div>

      <div className="card">
        <button className="add-toggle-btn" onClick={() => setShowAddPc(!showAddPc)}>
          <span>+ Tambah PC / Loader Baru</span>
          <span className={"add-toggle-chevron" + (showAddPc ? " add-toggle-chevron-open" : "")}>
            <ChevronIcon />
          </span>
        </button>
        {showAddPc && (
          <form onSubmit={handleAddFleet} className="add-form">
            <div className="field-label" style={{ marginBottom: 6 }}>Nama PC</div>
            <input
              className="field-input"
              value={newFleetName}
              onChange={(e) => setNewFleetName(e.target.value)}
              placeholder="Contoh: E52099"
              style={{ marginBottom: 12 }}
            />
            <div className="field-label" style={{ marginBottom: 6 }}>Lokasi (PIT)</div>
            <Combobox
              value={newFleetPit}
              onChange={setNewFleetPit}
              options={pitOptions}
              placeholder="Cari lokasi..."
              emptyLabel="-- Tanpa lokasi dulu --"
            />
            <button className="auth-submit" style={{ marginTop: 12 }}>Simpan PC</button>
          </form>
        )}
      </div>

      <div className="card">
        <button className="add-toggle-btn" onClick={() => setShowAddPit(!showAddPit)}>
          <span>+ Tambah Lokasi Baru</span>
          <span className={"add-toggle-chevron" + (showAddPit ? " add-toggle-chevron-open" : "")}>
            <ChevronIcon />
          </span>
        </button>
        {showAddPit && (
          <form onSubmit={handleAddPit} className="add-form">
            <input
              className="field-input"
              value={newPitName}
              onChange={(e) => setNewPitName(e.target.value)}
              placeholder="Contoh: PIT BARU"
              style={{ marginBottom: 12 }}
            />
            <button className="auth-submit">Simpan Lokasi</button>
          </form>
        )}
      </div>

      <div className="app-footer">designed by Najib.dev</div>
    </div>
  );
}
