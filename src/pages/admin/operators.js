import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { atLeast, ROLE_LABEL } from "@/lib/roles";
import { roleOptions } from "@/lib/akunPerms";
import { useAuthCheck } from "@/hooks/useAuthCheck";
import Topbar from "@/components/home/Topbar";
import { ToastProvider, useToast } from "@/components/Toast";
import AkunCard from "@/components/akun/AkunCard";
import AkunModal from "@/components/akun/AkunModal";

const FILTERS = [
  ["all", "Semua"],
  ["pending", "Menunggu"],
  ["operator", "Operator"],
  ["pengawas", "Pengawas"],
  ["admin", "Admin"],
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function matchFilter(u, filter) {
  if (filter === "all") return true;
  if (filter === "pending") return u.status === "pending";
  if (filter === "admin") return u.role === "admin" || u.role === "superadmin";
  return u.role === filter;
}

export default function AdminOperators() {
  return (
    <ToastProvider>
      <OperatorsView />
    </ToastProvider>
  );
}

function OperatorsView() {
  const router = useRouter();
  const toast = useToast();
  const { authUser, authError, retry: retryAuth } = useAuthCheck(router, {
    minRole: (role) => atLeast(role, "admin"),
    redirectIfBelow: "/",
  });

  const [list, setList] = useState([]);
  const [units, setUnits] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [leavingId, setLeavingId] = useState(null);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/operators", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal memuat daftar akun");
      } else {
        setList(data);
        setError(null);
      }
    } catch (err) {
      setError(err.message || "Gagal memuat daftar akun");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnits = useCallback(async () => {
    try {
      const res = await fetch("/api/units", { cache: "no-store" });
      const data = await res.json();
      setUnits(Array.isArray(data) ? data : []);
    } catch (err) {
      // Bukan fatal: dropdown unit kosong, sisa halaman tetap jalan.
    }
  }, []);

  useEffect(() => {
    if (!authUser) return;
    loadList();
    loadUnits();
  }, [authUser, loadList, loadUnits]);

  const counts = useMemo(() => {
    const c = {};
    FILTERS.forEach(([k]) => { c[k] = list.filter((u) => matchFilter(u, k)).length; });
    return c;
  }, [list]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter(
      (u) =>
        matchFilter(u, filter) &&
        (!q || u.username.toLowerCase().includes(q) || (u.unit_name || "").toLowerCase().includes(q))
    );
  }, [list, filter, query]);

  // Satu pintu untuk semua aksi admin -- menggantikan 8 handler yang dulu copy-paste.
  async function callAction(userId, action, extra = {}) {
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, ...extra }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: d.error || `Gagal (${res.status})` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Koneksi/server bermasalah: ${err.message}` };
    }
  }

  async function runAction(u, action, extra, okMsg, { leave = false } = {}) {
    const r = await callAction(u.id, action, extra);
    if (!r.ok) return r;
    toast(okMsg);
    if (leave) {
      setLeavingId(u.id);
      await wait(280);
      setLeavingId(null);
    }
    await loadList();
    return r;
  }

  async function handleAssignUnit(u, unitId) {
    const prev = list;
    const unitName = units.find((x) => x.id === unitId)?.name || null;
    setList((l) => l.map((x) => (x.id === u.id ? { ...x, unit_id: unitId, unit_name: unitName } : x)));
    const r = await callAction(u.id, "set_unit", { unitId });
    if (r.ok) {
      toast(unitId ? `Unit ${u.username}: ${unitName}` : `Unit ${u.username} dikosongkan`);
    } else {
      setList(prev);
      toast(r.error, "error");
    }
  }

  function ask(u, kind) {
    const base = { key: `${kind}-${u.id}-${Date.now()}` };
    const name = u.username;
    switch (kind) {
      case "approve":
        setModal({
          ...base, title: `Approve "${name}"?`, message: "Akun ini bisa login setelah disetujui.",
          confirmLabel: "Approve", tone: "primary",
          onConfirm: () => runAction(u, "approve", {}, `${name} disetujui`),
        });
        break;
      case "reject":
        setModal({
          ...base, title: `Tolak "${name}"?`, message: "Pendaftaran ini akan dihapus permanen.",
          confirmLabel: "Tolak", tone: "danger",
          onConfirm: () => runAction(u, "reject", {}, `Pendaftaran ${name} ditolak`, { leave: true }),
        });
        break;
      case "role":
        setModal({
          ...base, title: `Ubah role "${name}"`, message: `Role sekarang: ${ROLE_LABEL[u.role] || u.role}.`,
          confirmLabel: "Simpan role", tone: "primary",
          choices: roleOptions(authUser, u).map((r) => ({ value: r, label: ROLE_LABEL[r] })),
          onConfirm: (val) => runAction(u, "set_role", { newRole: val }, `Role ${name} jadi ${ROLE_LABEL[val]}`),
        });
        break;
      case "password":
        setModal({
          ...base, title: `Reset password "${name}"`,
          message: "Dia akan logout dari semua perangkat. Sampaikan password baru langsung ke orangnya.",
          confirmLabel: "Ganti password", tone: "primary",
          input: { label: "Password baru", minLength: 8, generate: true },
          onConfirm: (val) => runAction(u, "reset_password", { newPassword: val }, `Password ${name} diganti`),
        });
        break;
      case "revoke":
        setModal({
          ...base, title: `Paksa logout "${name}"?`, message: "Dia harus login ulang di semua perangkat.",
          confirmLabel: "Paksa logout", tone: "danger",
          onConfirm: () => runAction(u, "revoke_sessions", {}, `${name} dipaksa logout`),
        });
        break;
      case "unit-reset":
        setModal({
          ...base, title: `Reset unit "${name}"?`, message: "Dia harus memilih unit lagi saat login berikutnya.",
          confirmLabel: "Reset unit", tone: "danger",
          onConfirm: () => runAction(u, "reset_unit", {}, `Unit ${name} direset`),
        });
        break;
      case "delete":
        setModal({
          ...base, title: `Hapus akun "${name}"?`,
          message: "Akun login dihapus permanen dan tidak bisa dibatalkan. Riwayat ritasi tetap tersimpan.",
          confirmLabel: "Hapus akun", tone: "danger",
          onConfirm: () => runAction(u, "delete_user", {}, `Akun ${name} dihapus`, { leave: true }),
        });
        break;
      default:
        break;
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
          <div className="hint c-danger">{authError}</div>
          <button className="btn btn-secondary w-auto px-16 mt-10" onClick={retryAuth}>Coba lagi</button>
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

  const isAdmin = atLeast(authUser.role, "admin");
  const canMonitorAll = atLeast(authUser.role, "pengawas");

  return (
    <div className="v4-page">
      <Topbar authUser={authUser} canMonitorAll={canMonitorAll} isAdmin={isAdmin} isOperator={false} onLogout={handleLogout} currentPage="akun" />

      <div className="container akun-wrap">
        {error && (
          <div className="akun-err-banner" role="alert">
            <span>{error}</span>
            <button className="akun-link" onClick={loadList}>Coba lagi</button>
          </div>
        )}

        {counts.pending > 0 && filter !== "pending" && (
          <button className="akun-pending-banner" onClick={() => setFilter("pending")}>
            <i />
            <span><b>{counts.pending}</b> akun menunggu approval</span>
            <em>Tinjau</em>
          </button>
        )}

        <div className="akun-toolbar">
          <div className="akun-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Cari nama akun atau unit..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Cari akun"
            />
          </div>
          <div className="akun-chips">
            {FILTERS.map(([k, label]) => (
              <button
                key={k}
                className={"akun-chip" + (filter === k ? " is-on" : "")}
                onClick={() => setFilter(k)}
              >
                {label} <b>{counts[k]}</b>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <ul className="akun-list" aria-busy="true">
            {[0, 1, 2, 3].map((i) => <li key={i} className="akun-skel" style={{ "--i": i }} />)}
          </ul>
        ) : shown.length === 0 ? (
          <div className="akun-empty">
            {list.length === 0 ? "Belum ada akun." : "Tidak ada akun yang cocok dengan pencarian/filter."}
          </div>
        ) : (
          <ul className="akun-list">
            {shown.map((u, i) => (
              <AkunCard
                key={u.id}
                u={u}
                index={i}
                actor={authUser}
                units={units}
                leaving={leavingId === u.id}
                onAsk={ask}
                onAssignUnit={handleAssignUnit}
              />
            ))}
          </ul>
        )}
      </div>

      {modal && <AkunModal key={modal.key} config={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
