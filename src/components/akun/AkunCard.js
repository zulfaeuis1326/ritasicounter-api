import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, HardHat, Binoculars, UserCog, ShieldCheck } from "lucide-react";
import { ROLE_LABEL } from "@/lib/roles";
import Combobox from "@/components/Combobox";
import { canTouch, roleOptions } from "@/lib/akunPerms";

// Ikon avatar mengikuti role: operator, pengawas, admin, superadmin.
const ROLE_ICON = { operator: HardHat, pengawas: Binoculars, admin: UserCog, superadmin: ShieldCheck };

const TONES = ["var(--tile-blue)", "var(--tile-green)", "var(--tile-orange)", "var(--tile-red)", "var(--hue-5)"];
function toneFor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

function DotsIcon() {
  return <MoreHorizontal size={18} strokeWidth={2.2} aria-hidden="true" />;
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
        {ROLE_ICON[u.role] ? (function () { const RoleIcon = ROLE_ICON[u.role]; return <RoleIcon size={21} strokeWidth={2.1} />; })() : u.username.slice(0, 2).toUpperCase()}
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

      <div className={"akun-actions" + (!pending && u.role === "operator" ? " akun-actions-unit" : "")}>
        {pending ? (
          <>
            <button className="akun-btn akun-btn-primary" onClick={() => onAsk(u, "approve")}>Approve</button>
            <button className="akun-btn akun-btn-ghost-danger" onClick={() => onAsk(u, "reject")}>Tolak</button>
          </>
        ) : (
          <>
            {u.role === "operator" && (
              <div className="akun-combo">
                <Combobox
                  value={u.unit_id ? String(u.unit_id) : ""}
                  onChange={(v) => {
                    if ((v || "") !== (u.unit_id ? String(u.unit_id) : "")) onAssignUnit(u, v ? Number(v) : null);
                  }}
                  options={units.map((un) => ({ value: String(un.id), label: un.name }))}
                  placeholder="Cari unit..."
                  emptyLabel="Pilih unit..."
                />
              </div>
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
