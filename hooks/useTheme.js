import { useEffect, useState } from "react";

const STORAGE_KEY = "ritasi-theme";

// Hook shared buat baca/ubah tema — dipakai components/ThemeToggle.js (tombol
// melayang, ada di semua halaman lain) dan components/home/Topbar.js (tombol
// di dalam topbar, khusus halaman utama V4).
export function useTheme() {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    let saved = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      saved = null;
    }
    const initial = saved === "dark" || saved === "light" ? saved : "light";
    document.documentElement.setAttribute("data-theme", initial);
    setTheme(initial);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (err) {
      // localStorage tidak tersedia (mode privat dsb) - abaikan, tema tetap jalan untuk sesi ini
    }
  }

  return [theme, toggleTheme];
}
