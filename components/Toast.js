import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

// Provider taruh sekali di halaman (bukan global _app.js, karena cuma dipakai
// di halaman utama V4 — halaman lain masih pakai alert() bawaan browser).
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((message, kind = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={"toast toast-" + t.kind}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Pemakaian: const toast = useToast(); toast("Ritasi tercatat"); toast("Gagal", "error");
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback aman kalau lupa dibungkus provider - jangan sampai crash.
    return (message) => { console.warn("ToastProvider belum dipasang:", message); };
  }
  return ctx;
}
