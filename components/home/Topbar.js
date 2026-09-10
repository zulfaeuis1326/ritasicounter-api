import { useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { ROLE_LABEL } from "../../lib/roles";

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.2" y1="4.2" x2="6.3" y2="6.3" /><line x1="17.7" y1="17.7" x2="19.8" y2="19.8" />
      <line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.2" y1="19.8" x2="6.3" y2="17.7" /><line x1="17.7" y1="6.3" x2="19.8" y2="4.2" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.5 14.5c-1 0.3 -2 0.5 -3 0.5 -5 0 -9 -4 -9 -9 0 -1 0.2 -2 0.5 -3 -4 1 -7 4.6 -7 8.9 0 5 4.1 9.1 9.1 9.1 4.3 0 7.9 -3 8.9 -7 -0.3 0.1 -0.6 0.2 -0.5 0.5z" />
    </svg>
  );
}
function LogoMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}
function InputIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l1.8 4.6L18 8l-4.2 1.4L12 14l-1.8-4.6L6 8l4.2-1.4z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
    </svg>
  );
}
function DashIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="4" height="10" /><rect x="10" y="6" width="4" height="14" /><rect x="16" y="13" width="4" height="7" />
    </svg>
  );
}
function TruckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="7" width="13" height="9" /><path d="M14 10h4l3 3v3h-7z" />
      <circle cx="6" cy="18" r="1.6" /><circle cx="17.5" cy="18" r="1.6" />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" /><path d="M2 21v-1a6 6 0 0 1 12 0v1" />
      <circle cx="17.5" cy="9.5" r="2.3" /><path d="M15.5 21v-1a4.5 4.5 0 0 1 7 0v1" />
    </svg>
  );
}

const NAV_ITEMS = [
  { key: "input", href: "/", label: "Monitoring Ritasi", icon: InputIcon, show: () => true },
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: DashIcon, show: (p) => p.canMonitorAll },
  { key: "fleet", href: "/admin/fleet", label: "Kelola Fleet", icon: TruckIcon, show: (p) => p.canMonitorAll },
  { key: "operators", href: "/admin/operators", label: "Kelola Akun", icon: PeopleIcon, show: (p) => p.isAdmin },
];

export default function Topbar({ authUser, canMonitorAll, isAdmin, onLogout, active }) {
  const [theme, toggleTheme] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const perms = { canMonitorAll, isAdmin };
  const visibleItems = NAV_ITEMS.filter((item) => item.show(perms));

  return (
    <header className="topbar">
      <div className="topbar-logo">
        <span className="topbar-mark"><LogoMark /></span>
        <span className="topbar-logo-text">RitasiCounter</span>
      </div>

      {/* Nav baris horizontal -- tampil di layar lebar, disembunyikan di mobile lewat CSS */}
      <nav className="topbar-nav">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return active === item.key ? (
            <span key={item.key} className="topbar-nav-current"><Icon /> {item.label}</span>
          ) : (
            <a key={item.key} href={item.href}><Icon /> {item.label}</a>
          );
        })}
      </nav>

      <div className="topbar-spacer" />

      {/* Kontrol kanan -- tampil di layar lebar */}
      <div className="topbar-controls">
        <span className="topbar-role-badge">{(ROLE_LABEL[authUser.role] || authUser.role).toUpperCase()}</span>
        {theme !== null && (
          <button className="topbar-iconbtn" onClick={toggleTheme} title="Ganti tema" aria-label="Ganti tema">
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        )}
        <button className="topbar-iconbtn" onClick={onLogout} title="Logout" aria-label="Logout">
          <LogoutIcon />
        </button>
        <div className="topbar-avatar">{authUser.username.charAt(0).toUpperCase()}</div>
      </div>

      {/* Hamburger -- HANYA tampil di mobile lewat CSS, jadi satu-satunya trigger menu */}
      <button
        className="topbar-hamburger-btn"
        onClick={() => setMenuOpen(true)}
        aria-label="Buka menu"
        aria-expanded={menuOpen}
      >
        <MenuIcon />
      </button>

      {/* Backdrop + panel dropdown mobile */}
      {menuOpen && (
        <>
          <div className="topbar-mobile-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="topbar-mobile-panel" role="dialog" aria-modal="true">
            <div className="topbar-mobile-panel-header">
              <span className="topbar-mobile-panel-title">
                <span className="topbar-mark"><LogoMark /></span> RitasiCounter
              </span>
              <button className="topbar-iconbtn" onClick={() => setMenuOpen(false)} aria-label="Tutup menu">
                <CloseIcon />
              </button>
            </div>

            <nav className="topbar-mobile-nav">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                return active === item.key ? (
                  <span key={item.key} className="topbar-mobile-nav-item topbar-mobile-nav-current">
                    <Icon /> {item.label}
                  </span>
                ) : (
                  <a key={item.key} href={item.href} className="topbar-mobile-nav-item">
                    <Icon /> {item.label}
                  </a>
                );
              })}
            </nav>

            <div className="topbar-mobile-panel-footer">
              <span className="topbar-role-badge">{(ROLE_LABEL[authUser.role] || authUser.role).toUpperCase()}</span>
              <div className="topbar-mobile-footer-actions">
                {theme !== null && (
                  <button className="topbar-iconbtn" onClick={toggleTheme} title="Ganti tema" aria-label="Ganti tema">
                    {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                  </button>
                )}
                <button className="topbar-iconbtn" onClick={onLogout} title="Logout" aria-label="Logout">
                  <LogoutIcon />
                </button>
                <div className="topbar-avatar">{authUser.username.charAt(0).toUpperCase()}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
    }
    
