import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { atLeast, ALL_ROLES, ROLE_LABEL } from "../../lib/roles";
import { useAuthCheck } from "../../hooks/useAuthCheck";
import Topbar from "../../components/home/Topbar";

export default function AdminOperators() {
  const router = useRouter();
  const { authUser, authError, retry: retryAuth } = useAuthCheck(router, {
    minRole: (role) => atLeast(role, "admin"),
    redirectIfBelow: "/",
  });
  const [list, setList] = useState([]);
  const [units, setUnits] = useState([]);
  const [error, setError] = useState(null);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/operators", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal memuat daftar akun");
        return;
      }
      setList(data);
      setError(null);
    } catch (err) {
      setError(err.message || "Gagal memuat daftar akun");
    }
  }, []);

  const loadUnits = useCallback(async () => {
    try {
      const res = await fetch("/api/units", { cache: "no-store" });
      const data = await res.json();
      setUnits(Array.isArray(data) ? data : []);
    } catch (err) {
      // Gagal load unit bukan fatal -- dropdown assign unit cuma kosong, sisa halaman tetap jalan.
    }
  }, []);

  useEffect(() => {
    if (!authUser) return;
    loadList();
    loadUnits();
  }, [authUser, loadList, loadUnits]);

  async function handleApprove(userId, username) {
    if (!confirm(`Approve akun "${username}"? Dia akan bisa login setelah ini.`)) return;
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "approve" }),
      });
      if (res.ok) {
        await loadList();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal approve: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal approve (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleReject(userId, username) {
    if (!confirm(`Tolak pendaftaran "${username}"? Akun ini akan dihapus permanen.`)) return;
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "reject" }),
      });
      if (res.ok) {
        await loadList();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal tolak: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal tolak (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleRevoke(userId, username) {
    if (!confirm(`Paksa logout "${username}" dari semua perangkat? Dia harus login ulang.`)) return;
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "revoke_sessions" }),
      });
      if (res.ok) {
        alert(`"${username}" berhasil di-paksa logout.`);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal paksa logout: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal paksa logout (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleSetRole(userId, username, newRole) {
    if (!confirm(`Ubah role "${username}" jadi ${ROLE_LABEL[newRole] || newRole}?`)) return;
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

  async function handleAssignUnit(userId, username, unitId) {
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "set_unit", unitId }),
      });
      if (res.ok) {
        await loadList();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal assign unit: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal assign unit (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleReset(userId, username) {
    if (!confirm(`Reset unit "${username}"? Dia harus pilih unit lagi pas login berikutnya.`)) return;
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
        alert(`Gagal reset unit: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal reset unit (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleDelete(userId, username) {
    if (!confirm(`Hapus akun "${username}" secara permanen? Ini tidak bisa dibatalkan.`)) return;
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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (authError) {
    return (
      <div className="container">
        <div className="card">
          <div className="hint" style={{ color: "var(--danger)" }}>{authError}</div>
          <button className="btn btn-secondary" style={{ width: "auto", padding: "0 16px", marginTop: 10 }} onClick={retryAuth}>
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="container">
        <div className="card"><div className="hint">Memuat...</div></div>
      </div>
    );
  }

  const isSuperadmin = authUser.role === "superadmin";
  const isAdmin = atLeast(authUser.role, "admin");
  const canMonitorAll = atLeast(authUser.role, "pengawas");
  const assignableRoles = ALL_ROLES;

  return (
    <div className="v4-page">
      <Topbar authUser={authUser} canMonitorAll={canMonitorAll} isAdmin={isAdmin} isOperator={false} onLogout={handleLogout} currentPage="akun" />

      <div className="container">
        {error && <div className="card"><div className="hint" style={{ color: "var(--danger)" }}>{error}</div></div>}

        <div className="section-title">Daftar Akun</div>
        {list.map((u) => (
          <div key={u.id} className="history-row">
            <div className="history-info">
              <b>{u.username}</b> ({ROLE_LABEL[u.role] || u.role})
              {u.status === "pending" && (
                <span className="badge-pending" style={{ marginLeft: 6, color: "var(--amber, #d97706)", fontWeight: 700, fontSize: 11 }}>
                  MENUNGGU APPROVAL
                </span>
              )}
              <div className="hint">
                {u.role === "operator"
                  ? (u.unit_name ? `Unit: ${u.unit_name}` : "Belum pilih unit")
                  : "Tidak terkunci ke unit manapun"}
              </div>
            </div>

            {u.status === "pending" ? (
              <div className="akun-row-actions">
                <button className="btn btn-secondary" style={{ width: "auto", padding: "0 14px" }} onClick={() => handleApprove(u.id, u.username)}>
                  Approve
                </button>
                <button className="btn-mini-danger" onClick={() => handleReject(u.id, u.username)}>
                  Tolak
                </button>
              </div>
            ) : (
            <div className="akun-row-actions">
              {u.role === "operator" && (
                <div className="akun-op-actions">
                  <select
                    className="akun-unit-select"
                    defaultValue={u.unit_id || ""}
                    onChange={(e) => handleAssignUnit(u.id, u.username, e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Pilih unit...</option>
                    {units.map((un) => (
                      <option key={un.id} value={un.id}>{un.name}</option>
                    ))}
                  </select>
                  <div className="akun-op-btnrow">
                    {u.unit_id && (
                      <button className="btn-mini-danger" onClick={() => handleReset(u.id, u.username)}>
                        Reset Unit
                      </button>
                    )}
                    {u.id !== authUser.id && (
                      <button className="btn-mini-danger" onClick={() => handleRevoke(u.id, u.username)}>
                        Paksa Logout
                      </button>
                    )}
                    {u.id !== authUser.id && (
                      <button className="btn-mini-danger" onClick={() => handleDelete(u.id, u.username)}>
                        Hapus Akun
                      </button>
                    )}
                  </div>
                </div>
              )}

              {u.role !== "operator" && u.id !== authUser.id && (
                <>
                  {isSuperadmin && (u.role === "admin" || u.role === "pengawas") && (
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
                  )}
                  <button className="btn-mini-danger" onClick={() => handleRevoke(u.id, u.username)}>
                    Paksa Logout
                  </button>
                  {(authUser.role === "superadmin" || (u.role !== "admin" && u.role !== "superadmin")) && (
                    <button className="btn-mini-danger" onClick={() => handleDelete(u.id, u.username)}>
                      Hapus Akun
                    </button>
                  )}
                </>
              )}
            </div>
            )}
          </div>
        ))}
        {list.length === 0 && !error && <div className="hint">Belum ada akun.</div>}
      </div>
    </div>
  );
}
