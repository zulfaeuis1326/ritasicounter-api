import { useTheme } from "../hooks/useTheme";

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.2" y1="4.2" x2="6.3" y2="6.3" />
      <line x1="17.7" y1="17.7" x2="19.8" y2="19.8" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.2" y1="19.8" x2="6.3" y2="17.7" />
      <line x1="17.7" y1="6.3" x2="19.8" y2="4.2" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.5 14.5c-1 0.3 -2 0.5 -3 0.5 -5 0 -9 -4 -9 -9 0 -1 0.2 -2 0.5 -3 -4 1 -7 4.6 -7 8.9 0 5 4.1 9.1 9.1 9.1 4.3 0 7.9 -3 8.9 -7 -0.3 0.1 -0.6 0.2 -0.5 0.5z" />
    </svg>
  );
}

// Tombol tema melayang di pojok kanan atas — dipakai di semua halaman KECUALI
// halaman utama V4 (index.js), yang punya tombol tema sendiri di dalam Topbar.
export default function ThemeToggle() {
  const [theme, toggleTheme] = useTheme();

  if (theme === null) return null;

  return (
    <button
      onClick={toggleTheme}
      aria-label="Ganti tema terang/gelap"
      title={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 1000,
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      }}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
