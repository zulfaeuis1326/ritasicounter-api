import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { atLeast, ALL_ROLES, ROLE_LABEL } from "../../lib/roles";
import Topbar from "../../components/home/Topbar";

export default function AdminOperators() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(undefined);
  const [list, setList] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => {
        if (!d.user) router.push("/login");
        else if (!atLeast(d.user.role, "admin")) router.push("/");
        else setAuthUser(d.user);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/operators");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Error ${res.status}`);
        return;
      }
      setList(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (authUser) loadList();
  }, [authUser, loadList]);

  async function handleReset(userId, username) {
    if (!confirm(`Reset unit untuk "${username}"? Dia akan diminta memilih unit lagi saat login berikutnya.`)) return;
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "reset_unit" }),
      });
      if (res.ok) {
        await loadList();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal reset: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal reset (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleSetRole(userId, username, newRole) {
    if (!confirm(`Ubah role "${username}" jadi ${ROLE_LABEL[newRole]}?`)) return;
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "set_role", newRole }),
      });
      if (res.ok) {
        await loadList();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal ubah role: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal ubah role (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleDelete(userId, username) {
    if (!confirm(`Hapus akun "${username}"? Login-nya akan hilang permanen (riwayat ritasi yang pernah dia input TETAP ada, cuma tidak lagi tercatat atas nama dia).`)) return;
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "delete_user" }),
      });
      if (res.ok) {
        await loadList();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal hapus akun: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal hapus akun (koneksi/server bermasalah): ${err.message}`);
    }
  }

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [deduping, setDeduping] = useState(false);
  const [dedupeResult, setDedupeResult] = useState(null);

  async function handleImportRoster() {
    if (!confirm("Import 42 PC + 124 HD dari data roster ke database? Aman diulang (yang udah ada dilewati, gak dobel).")) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/admin/import-roster", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setImportResult(data);
      } else {
        alert(`Gagal import: ${data.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal import (koneksi/server bermasalah): ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  async function handleDedupe() {
    if (!confirm("Gabungin unit/PC yang namanya sama (dobel karena beda kapitalisasi/spasi)? Data fleet & PIT yang udah keisi otomatis dipertahankan.")) return;
    setDeduping(true);
    setDedupeResult(null);
    try {
      const res = await fetch("/api/admin/dedupe-units", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setDedupeResult(data);
      } else {
        alert(`Gagal bersihin: ${data.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal bersihin (koneksi/server bermasalah): ${err.message}`);
    } finally {
      setDeduping(false);
    }
  }

  if (authUser === undefined || authUser === null) {
    return (
      <div className="container">
        <div className="card"><div className="hint">Memuat...</div></div>
      </div>
    );
  }

  // Admin biasa cuma boleh set role pengawas/operator; superadmin bebas semua role.
  const assignableRoles = authUser.role === "superadmin" ? ALL_ROLES : ["pengawas", "operator"];

  const isAdmin = atLeast(authUser.role, "admin");
  const canMonitorAll = atLeast(authUser.role, "pengawas");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="v4-page">
      <Topbar authUser={authUser} canMonitorAll={canMonitorAll} isAdmin={isAdmin} isOperator={false} onLogout={handleLogout} currentPage="akun" />

      <main className="container">

      {error && (
        <div className="card"><div className="hint" style={{ color: "var(--danger)" }}>Error: {error}</div></div>
      )}

      <div className="card">
        <div className="section-title">Daftar Akun</div>
        {list.map((u) => (
          <div key={u.id} className="history-row">
            <div className="history-info">
              <b>{u.username}</b> ({ROLE_LABEL[u.role] || u.role})
              <div className="hint">
                {u.role === "operator"
                  ? (u.unit_name ? `Unit: ${u.unit_name}` : "Belum pilih unit")
                  : "Tidak terkunci ke unit manapun"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {u.role === "operator" && u.unit_id && (
                <button className="btn-mini-danger" onClick={() => handleReset(u.id, u.username)}>
                  Reset Unit
                </button>
              )}
              {u.id !== authUser.id && (
                <>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) handleSetRole(u.id, u.username, val);
                      e.target.value = "";
                    }}
                  >
                    <option value="" disabled>Ubah role...</option>
                    {assignableRoles
                      .filter((r) => r !== u.role)
                      .map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                  </select>
                  {/* Admin biasa cuma boleh hapus akun pengawas/operator; superadmin bebas semua */}
                  {(authUser.role === "superadmin" || (u.role !== "admin" && u.role !== "superadmin")) && (
                    <button className="btn-mini-danger" onClick={() => handleDelete(u.id, u.username)}>
                      Hapus Akun
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && !error && <div className="hint">Belum ada akun.</div>}
      </div>

      {authUser.role === "superadmin" && (
        <div className="card">
          <div className="section-title">Import Data Unit (PC & HD)</div>
          <div className="hint" style={{ marginBottom: 8 }}>
            Import sekali jalan dari data roster (42 PC + 124 HD). Aman diklik berkali-kali —
            unit yang sudah ada otomatis dilewati, tidak akan dobel.
          </div>
          <button className="btn btn-secondary" onClick={handleImportRoster} disabled={importing}>
            {importing ? "Mengimport..." : "Import Sekarang"}
          </button>
          {importResult && (
            <div className="hint" style={{ marginTop: 8 }}>
              Fleet (PC): {importResult.fleets.created} baru ditambahkan, {importResult.fleets.skipped} sudah ada (dilewati).<br />
              Unit (HD): {importResult.units.created} baru ditambahkan, {importResult.units.skipped} sudah ada (dilewati).
            </div>
          )}
        </div>
      )}

      {authUser.role === "superadmin" && (
        <div className="card">
          <div className="section-title">Bersihkan Unit Dobel</div>
          <div className="hint" style={{ marginBottom: 8 }}>
            Gabungin unit/PC yang namanya sama tapi kecatat dobel (beda kapitalisasi/spasi).
            Data fleet & PIT yang udah keisi otomatis dipertahankan, gak hilang.
          </div>
          <button className="btn btn-secondary" onClick={handleDedupe} disabled={deduping}>
            {deduping ? "Membersihkan..." : "Bersihkan Sekarang"}
          </button>
          {dedupeResult && (
            <div className="hint" style={{ marginTop: 8 }}>
              {dedupeResult.fleetsMerged} PC digabung, {dedupeResult.unitsMerged} unit HD digabung.
            </div>
          )}
        </div>
      )}

      <div className="app-footer">designed by Najib.dev</div>
      </main>
    </div>
  );
}
