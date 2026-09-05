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

export default function Topbar({ authUser, canMonitorAll, isAdmin, onLogout, active }) {
  const [theme, toggleTheme] = useTheme();

  return (
    <header className="topbar">
      <div className="topbar-logo">
        <span className="topbar-mark"><LogoMark /></span>
        RitasiCounter
      </div>
      <nav className="topbar-nav">
        {active === "input" ? <span className="topbar-nav-current">Input Ritasi</span> : <a href="/">Input Ritasi</a>}
        {canMonitorAll && (
          active === "dashboard" ? <span className="topbar-nav-current">Dashboard</span> : <a href="/dashboard">Dashboard</a>
        )}
        {canMonitorAll && (
          active === "fleet" ? <span className="topbar-nav-current">Kelola Fleet</span> : <a href="/admin/fleet">Kelola Fleet</a>
        )}
        {isAdmin && (
          active === "operators" ? <span className="topbar-nav-current">Kelola Akun</span> : <a href="/admin/operators">Kelola Akun</a>
        )}
      </nav>
      <div className="topbar-spacer" />
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
    </header>
  );
}
