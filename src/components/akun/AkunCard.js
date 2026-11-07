import { useEffect, useRef, useState } from "react";
import { ROLE_LABEL } from "@/lib/roles";
import { canTouch, roleOptions } from "@/lib/akunPerms";

const TONES = ["var(--tile-blue)", "var(--tile-green)", "var(--tile-orange)", "var(--tile-red)", "var(--hue-5)"];
function toneFor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
    </svg>
  );
}

// onAsk(user, kind): buka modal konfirmasi. onAssignUnit(user, unitId): ganti unit langsung.
export default function AkunCard({ u, index, actor, units, leaving, onAsk, onAssignUnit }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function away(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    function esc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const isSelf = actor.id === u.id;
  const pending = u.status === "pending";
  const touch = canTouch(actor, u);

  const items = [];
  if (!pending && touch) {
    if (roleOptions(actor, u).length) items.push({ k: "role", label: "Ubah role" });
    items.push({ k: "password", label: "Reset password" });
    items.push({ k: "revoke", label: "Paksa logout" });
    if (u.role === "operator" && u.unit_id) items.push({ k: "unit-reset", label: "Reset unit" });
    items.push({ k: "delete", label: "Hapus akun", danger: true });
  }

  const unitText =
    u.role === "operator" ? (u.unit_name ? `Unit ${u.unit_name}` : "Belum pilih unit") : "Tidak terkunci ke unit";
  const joined = u.created_at
    ? new Date(u.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <li
      className={
        "akun-card" + (leaving ? " is-leaving" : "") + (pending ? " is-pending" : "") + (open ? " menu-open" : "")
      }
      style={{ "--i": Math.min(index, 12) }}
    >
      <div className="akun-avatar" style={{ background: toneFor(u.username) }} aria-hidden="true">
        {u.username.slice(0, 2).toUpperCase()}
      </div>

      <div className="akun-main">
        <div className="akun-name">
          {u.username}
          {isSelf && <span className="akun-you">Anda</span>}
        </div>
        <div className="akun-meta">
          <span className={"akun-role akun-role-" + u.role}>{ROLE_LABEL[u.role] || u.role}</span>
          {pending && (
            <span className="akun-pending-tag"><i />Menunggu approval</span>
          )}
          <span className="akun-sub">{unitText}</span>
          {joined && <span className="akun-sub">Bergabung {joined}</span>}
        </div>
      </div>

      <div className="akun-actions">
        {pending ? (
          <>
            <button className="akun-btn akun-btn-primary" onClick={() => onAsk(u, "approve")}>Approve</button>
            <button className="akun-btn akun-btn-ghost-danger" onClick={() => onAsk(u, "reject")}>Tolak</button>
          </>
        ) : (
          <>
            {u.role === "operator" && (
              <select
                className="akun-select"
                aria-label={`Unit untuk ${u.username}`}
                value={u.unit_id || ""}
                onChange={(e) => onAssignUnit(u, e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Pilih unit...</option>
                {units.map((un) => (
                  <option key={un.id} value={un.id}>{un.name}</option>
                ))}
              </select>
            )}
            {items.length > 0 && (
              <div className="akun-menu-wrap" ref={menuRef}>
                <button
                  className="akun-more"
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-label={`Aksi untuk ${u.username}`}
                  onClick={() => setOpen((o) => !o)}
                >
                  <DotsIcon />
                </button>
                {open && (
                  <div className="akun-menu" role="menu">
                    {items.map((it) => (
                      <button
                        key={it.k}
                        role="menuitem"
                        className={"akun-menu-item" + (it.danger ? " is-danger" : "")}
                        onClick={() => { setOpen(false); onAsk(u, it.k); }}
                      >
                        {it.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}
