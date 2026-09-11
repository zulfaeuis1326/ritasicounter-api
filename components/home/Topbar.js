import { useEffect, useState } from "react";
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
function CollapseIcon({ collapsed }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(180deg)" : "none" }}>
      <polyline points="15 6 9 12 15 18" />
    </svg>
  );
}
function ClickIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v3M3 9h3M4.5 4.5l2 2M18.5 4.5l-2 2" />
      <path d="M12 12l9 3-4 2-2 4-3-9z" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="6" y="12" width="3" height="8" /><rect x="14" y="8" width="3" height="12" /><rect x="10.5" y="4" width="3" height="16" />
    </svg>
  );
}
function TruckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="7" width="13" height="10" /><path d="M14 10h4l4 4v3h-8z" />
      <circle cx="6" cy="19" r="1.6" /><circle cx="17" cy="19" r="1.6" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
      <circle cx="17.5" cy="8.5" r="2.4" /><path d="M16.5 14.2c2.6 0.4 4.5 2.4 4.5 5.3" />
    </svg>
  );
}

const SIDEBAR_KEY = "rc_sidebar_collapsed";

export default function Topbar({ authUser, canMonitorAll, isAdmin, isOperator, onLogout, currentPage }) {
  const [theme, toggleTheme] = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const page = currentPage || "input-ritasi";
  const homeLabel = isOperator ? "Input Ritasi" : "Monitoring Ritasi";

  useEffect(function () {
    const saved = window.localStorage.getItem(SIDEBAR_KEY) === "1";
    setCollapsed(saved);
    document.body.classList.toggle("sidebar-collapsed", saved);
  }, []);

  function handleToggleSidebar() {
    setCollapsed(function (prev) {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      document.body.classList.toggle("sidebar-collapsed", next);
      return next;
    });
  }

  function NavItem({ id, href, label, icon, show }) {
    if (show === false) return null;
    const isCurrent = page === id;
    const content = (
      <>
        <span className="topbar-nav-icon">{icon}</span>
        <span className="topbar-nav-label">{label}</span>
      </>
    );
    if (isCurrent) return <span className="topbar-nav-current" title={label}>{content}</span>;
    return <a href={href} title={label}>{content}</a>;
  }

  return (
    <header className="topbar">
      <div className="topbar-logo">
        <span className="topbar-mark"><LogoMark /></span>
        <span className="topbar-logo-text">RitasiCounter</span>
      </div>
      <button className="topbar-collapse-btn" onClick={handleToggleSidebar} title={collapsed ? "Buka sidebar" : "Ciutkan sidebar"} aria-label="Toggle sidebar">
        <CollapseIcon collapsed={collapsed} />
      </button>
      <nav className="topbar-nav">
        <NavItem id="input-ritasi" href="/" label={homeLabel} icon={<ClickIcon />} />
        <NavItem id="dashboard" href="/dashboard" label="Dashboard" icon={<ChartIcon />} show={canMonitorAll} />
        <NavItem id="fleet" href="/admin/fleet" label="Kelola Fleet" icon={<TruckIcon />} show={canMonitorAll} />
        <NavItem id="akun" href="/admin/operators" label="Kelola Akun" icon={<UsersIcon />} show={isAdmin} />
      </nav>
      <div className="topbar-spacer" />
      <div className="topbar-footer">
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
    </header>
  );
}
