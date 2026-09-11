import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { atLeast } from "../lib/roles";
import { ToastProvider, useToast } from "../components/Toast";
import Topbar from "../components/home/Topbar";
import ShiftBanner from "../components/home/ShiftBanner";
import StatCards from "../components/home/StatCards";
import RitasiPanel from "../components/home/RitasiPanel";
import RekapTable from "../components/home/RekapTable";
import JamManualModal from "../components/home/JamManualModal";
import UnitSetupScreen from "../components/home/UnitSetupScreen";

export default function Home() {
  return (
    <ToastProvider>
      <HomeContent />
    </ToastProvider>
  );
}

function HomeContent() {
  const router = useRouter();
  const toast = useToast();

  const [authUser, setAuthUser] = useState(undefined);
  const [clock, setClock] = useState("");
  const [units, setUnits] = useState([]);
  const [fleets, setFleets] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [material, setMaterial] = useState("");
  const [selectedJam, setSelectedJam] = useState("");
  const [jamModalOpen, setJamModalOpen] = useState(false);
  const [recap, setRecap] = useState(null);
  const [recapError, setRecapError] = useState(null);
  const [history, setHistory] = useState([]);
  const [pastShifts, setPastShifts] = useState([]);
  const [loadingClick, setLoadingClick] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [showAllUnits, setShowAllUnits] = useState(false);

  // Layar setup unit operator
  const [setupUnits, setSetupUnits] = useState([]);
  const [settingUnit, setSettingUnit] = useState(false);
  const [newSetupUnitName, setNewSetupUnitName] = useState("");

  const isAdmin = !!authUser && atLeast(authUser.role, "admin");
  const isOperator = !!authUser && authUser.role === "operator";
  const canMonitorAll = !!authUser && atLeast(authUser.role, "pengawas");
  const canClickRitasi = !!authUser && (isOperator || isAdmin);
  const needsUnitSetup = isOperator && !authUser.unit_id;

  // ===== Auto-set unit untuk operator (unit terkunci, gak lewat dropdown) =====
  useEffect(function () {
    if (isOperator && authUser && authUser.unit_id && !selectedUnit) {
      setSelectedUnit(String(authUser.unit_id));
    }
  }, [isOperator, authUser, selectedUnit]);

  // ===== Auth check =====
  useEffect(function () {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.user) {
          router.push("/login");
        } else {
          setAuthUser(data.user);
        }
      })
      .catch(function () { router.push("/login"); });
  }, [router]);

  // ===== Clock =====
  useEffect(function () {
    function tick() {
      setClock(new Date().toLocaleTimeString("id-ID"));
    }
    tick();
    const t = setInterval(tick, 1000);
    return function () { clearInterval(t); };
  }, []);

  // ===== Loaders =====
  const loadUnits = useCallback(async function () {
    try {
      const res = await fetch("/api/units");
      if (res.ok) setUnits(await res.json());
    } catch (err) { /* diamkan, non-kritis */ }
  }, []);

  const loadFleets = useCallback(async function () {
    try {
      const res = await fetch("/api/fleets");
      if (res.ok) setFleets(await res.json());
    } catch (err) { /* diamkan, non-kritis */ }
  }, []);

  const loadSetupUnits = useCallback(async function () {
    try {
      const res = await fetch("/api/units");
      if (res.ok) setSetupUnits(await res.json());
    } catch (err) { /* diamkan */ }
  }, []);

  const loadRecap = useCallback(async function () {
    try {
      const res = await fetch("/api/ritasi");
      if (res.ok) {
        setRecap(await res.json());
        setRecapError(null);
      } else {
        const d = await res.json().catch(function () { return {}; });
        setRecapError(d.error || "Error " + res.status);
      }
    } catch (err) {
      setRecapError(err.message);
    }
  }, []);

  const loadHistory = useCallback(async function () {
    try {
      const res = await fetch("/api/ritasi/history");
      if (res.ok) {
        const d = await res.json();
        setHistory(d.clicks || []);
      }
    } catch (err) { /* diamkan */ }
  }, []);

  const loadPastShifts = useCallback(async function () {
    try {
      const res = await fetch("/api/shift/list");
      if (res.ok) setPastShifts(await res.json());
    } catch (err) { /* diamkan */ }
  }, []);

  // ===== Setup unit screen loader =====
  useEffect(function () {
    if (!needsUnitSetup) return;
    loadSetupUnits();
  }, [needsUnitSetup, loadSetupUnits]);

  // ===== Load & polling utama =====
  useEffect(function () {
    if (!authUser || needsUnitSetup) return;
    if (isAdmin) loadUnits();
    if (canMonitorAll) {
      loadPastShifts();
      loadFleets();
    }
    loadRecap();
    loadHistory();
    const poll = setInterval(function () {
      loadRecap();
      loadHistory();
    }, 2500);
    return function () { clearInterval(poll); };
  }, [authUser, needsUnitSetup, isAdmin, canMonitorAll, loadUnits, loadRecap, loadPastShifts, loadHistory, loadFleets]);

  // Auto-perbaiki selectedUnit kalau nyasar/dihapus (khusus admin)
  useEffect(function () {
    if (!isAdmin) return;
    if (selectedUnit && !units.find(function (u) { return String(u.id) === String(selectedUnit); })) {
      setSelectedUnit("");
    }
  }, [units, selectedUnit, isAdmin]);

  // ===== Handlers =====
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleClick() {
    if (!selectedUnit) { toast("Pilih unit dulu.", "error"); return; }
    if (!material) { toast("Pilih material dulu.", "error"); return; }
    setLoadingClick(true);
    try {
      const res = await fetch("/api/ritasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: Number(selectedUnit),
          material: material,
          jam: selectedJam === "" ? undefined : Number(selectedJam),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(function () { return {}; });
        toast("Gagal: " + (data.error || res.status), "error");
        return;
      }
      const data = await res.json();
      setRecap(data);
      setSelectedJam("");
      loadHistory();
      toast("Ritasi tercatat ✓");
    } catch (err) {
      toast("Gagal mencatat ritasi (koneksi bermasalah)", "error");
    } finally {
      setLoadingClick(false);
    }
  }

  async function handleSetUnit(unitId) {
    setSettingUnit(true);
    try {
      const res = await fetch("/api/auth/set-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: unitId }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(function () { return {}; });
        toast("Gagal memilih unit: " + (data.error || res.status), "error");
      }
    } catch (err) {
      toast("Gagal memilih unit (koneksi bermasalah)", "error");
    } finally {
      setSettingUnit(false);
    }
  }

  async function handleRegisterOwnUnit(e) {
    e.preventDefault();
    if (!newSetupUnitName.trim()) return;
    setSettingUnit(true);
    try {
      const res = await fetch("/api/auth/set-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUnitName: newSetupUnitName.trim() }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(function () { return {}; });
        toast("Gagal mendaftarkan unit: " + (data.error || res.status), "error");
      }
    } catch (err) {
      toast("Gagal mendaftarkan unit (koneksi bermasalah)", "error");
    } finally {
      setSettingUnit(false);
    }
  }

  async function handleDeleteUnit(unitId) {
    const u = units.find(function (x) { return String(x.id) === String(unitId); });
    if (!confirm("Hapus unit \"" + (u ? u.name : unitId) + "\"? Riwayat ritasi sebelumnya tetap tersimpan.")) return;
    try {
      const res = await fetch("/api/units", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: unitId }),
      });
      if (res.ok) {
        setSelectedUnit("");
        loadUnits();
        toast("Unit dihapus");
      } else {
        const data = await res.json().catch(function () { return {}; });
        toast("Gagal hapus unit: " + (data.error || res.status), "error");
      }
    } catch (err) {
      toast("Gagal hapus unit (koneksi bermasalah)", "error");
    }
  }

  async function handleAddUnit(e) {
    e.preventDefault();
    if (!newUnitName.trim()) return;
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newUnitName.trim() }),
      });
      if (res.ok) {
        setNewUnitName("");
        loadUnits();
        toast("Unit ditambahkan");
      } else {
        const data = await res.json().catch(function () { return {}; });
        toast("Gagal tambah unit: " + (data.error || res.status), "error");
      }
    } catch (err) {
      toast("Gagal tambah unit (koneksi bermasalah)", "error");
    }
  }

  async function handleDeleteHistory(id) {
    if (!confirm("Hapus entri ritasi ini?")) return;
    try {
      const res = await fetch("/api/ritasi/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecap(data.recap);
        loadHistory();
        toast("Entri dihapus");
      } else {
        const data = await res.json().catch(function () { return {}; });
        toast("Gagal hapus: " + (data.error || res.status), "error");
      }
    } catch (err) {
      toast("Gagal hapus (koneksi bermasalah)", "error");
    }
  }

  async function handleCloseShift() {
    if (!confirm("Tutup shift sekarang? Data shift ini akan dikunci.")) return;
    try {
      const res = await fetch("/api/shift/close", { method: "POST" });
      if (res.ok) {
        loadRecap();
        loadPastShifts();
        toast("Shift ditutup");
      } else {
        const data = await res.json().catch(function () { return {}; });
        toast("Gagal tutup shift: " + (data.error || res.status), "error");
      }
    } catch (err) {
      toast("Gagal tutup shift (koneksi bermasalah)", "error");
    }
  }

  function handleExport() {
    if (!recap || !recap.shift) return;
    window.open("/api/shift/export?shiftId=" + recap.shift.id, "_blank");
  }

  // ===== Derived =====
  const allRecapUnits = (recap && recap.units) || [];
  const selectedUnitRecap = recap && recap.units
    ? recap.units.find(function (u) { return String(u.id) === selectedUnit; })
    : null;
  const currentHourData = selectedUnitRecap && selectedUnitRecap.hourly
    ? selectedUnitRecap.hourly.find(function (h) { return h.jam === (recap ? recap.currentHour : null); })
    : null;

  // ===== Render =====
  if (authUser === undefined) {
    return <div className="container"><div className="card"><div className="hint">Memuat...</div></div></div>;
  }
  if (!authUser) return null;

  if (needsUnitSetup) {
    return (
      <UnitSetupScreen
        authUser={authUser}
        setupUnits={setupUnits}
        settingUnit={settingUnit}
        newSetupUnitName={newSetupUnitName}
        onChangeNewSetupUnitName={setNewSetupUnitName}
        onSetUnit={handleSetUnit}
        onRegisterOwnUnit={handleRegisterOwnUnit}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="v4-page">
      <Topbar authUser={authUser} canMonitorAll={canMonitorAll} isAdmin={isAdmin} isOperator={isOperator} onLogout={handleLogout} />

      <main className="container">
        <ShiftBanner recap={recap} recapError={recapError} clock={clock} />

        {canMonitorAll && (
          <StatCards recap={recap} allRecapUnits={allRecapUnits} totalFleetCount={fleets.length} />
        )}

        <div className="v4-grid">
          {canClickRitasi && (
            <RitasiPanel
              isAdmin={isAdmin}
              authUser={authUser}
              units={units}
              selectedUnit={selectedUnit}
              onChangeSelectedUnit={setSelectedUnit}
              onDeleteUnit={handleDeleteUnit}
              material={material}
              onChangeMaterial={setMaterial}
              selectedJam={selectedJam}
              onOpenJamModal={function () { setJamModalOpen(true); }}
              recap={recap}
              currentHourData={currentHourData}
              selectedUnitRecap={selectedUnitRecap}
              loadingClick={loadingClick}
              onClick={handleClick}
            />
          )}

          <div>
            {canMonitorAll && (
              <RekapTable
                allRecapUnits={allRecapUnits}
                showAllUnits={showAllUnits}
                setShowAllUnits={setShowAllUnits}
                canMonitorAll={canMonitorAll}
                recap={recap}
                onExport={handleExport}
              />
            )}

            {isAdmin && (
              <section className="card">
                <h2 className="sec-title-icon">Tambah Unit</h2>
                <form onSubmit={handleAddUnit} style={{ display: "flex", gap: 8 }}>
                  <input
                    value={newUnitName}
                    onChange={function (e) { setNewUnitName(e.target.value); }}
                    placeholder="Contoh: HD-05"
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-secondary" style={{ width: "auto", padding: "0 16px" }}>
                    Tambah
                  </button>
                </form>
              </section>
            )}

            {canMonitorAll && (
              <section className="card">
                <h2 className="sec-title-icon">Shift & Approval</h2>
                <div className="hint" style={{ marginBottom: 10 }}>
                  Tutup shift ini kalau produksi shift sudah selesai. Export tetap bisa dilakukan
                  kapan saja tanpa menutup shift.
                </div>
                <button className="btn btn-danger" onClick={handleCloseShift} disabled={!recap || !recap.shift}>
                  Tutup Shift Ini
                </button>
                {pastShifts.length > 0 && (
                  <>
                    <div className="field-label" style={{ marginTop: 14, marginBottom: 6 }}>Riwayat Shift</div>
                    {pastShifts.map(function (s) {
                      return (
                        <div key={s.id} className="stat-row">
                          <span>{s.label}</span>
                          <a href={"/api/shift/export?shiftId=" + s.id} target="_blank" rel="noreferrer">Download</a>
                        </div>
                      );
                    })}
                  </>
                )}
              </section>
            )}

            <section className="card">
              <h2 className="sec-title-icon">Riwayat & Revisi Ritasi</h2>
              <div className="hint" style={{ marginBottom: 8 }}>
                Salah pencet material? Hapus entri yang salah di sini.
              </div>
              {history.length === 0 && <div className="hint">Belum ada ritasi tercatat.</div>}
              {history.map(function (h) {
                return (
                  <div key={h.id} className="history-row">
                    <div className="history-info">
                      <b>{h.unit_name}</b> - {h.material} - jam {String(h.jam).padStart(2, "0")}:00
                      <div className="hint">
                        {h.operator_name || "(tanpa nama)"} - {new Date(h.clicked_at).toLocaleTimeString("id-ID")}
                      </div>
                    </div>
                    {(isAdmin || h.operator_id === authUser.id) && (
                      <button className="btn-mini-danger" onClick={function () { handleDeleteHistory(h.id); }}>
                        Hapus
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          </div>
        </div>
      </main>

      <JamManualModal
        open={jamModalOpen}
        onClose={function () { setJamModalOpen(false); }}
        shiftType={recap && recap.shift ? recap.shift.shift_type : 1}
        currentHour={recap ? recap.currentHour : 0}
        onPick={setSelectedJam}
      />

      <div className="app-footer">designed by Najib.dev</div>
    </div>
  );
}
