import { useEffect, useRef, useState } from "react";

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomPassword(len = 10) {
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

// Pengganti confirm()/prompt() bawaan browser.
// config: { title, message, confirmLabel, tone: "primary" | "danger",
//           input?: { label, minLength, generate }, choices?: [{value,label}],
//           onConfirm: async (value) => ({ ok, error }) }
export default function AkunModal({ config, onClose }) {
  const { title, message, confirmLabel = "Ya", tone = "primary", input, choices, onConfirm } = config;
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!input) confirmRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (input && value.length < (input.minLength || 1)) {
      setErr(`Minimal ${input.minLength || 1} karakter.`);
      return;
    }
    if (choices && !value) {
      setErr("Pilih salah satu dulu.");
      return;
    }
    setBusy(true);
    setErr("");
    const r = await onConfirm(value);
    if (r && r.ok === false) {
      setErr(r.error || "Gagal, coba lagi.");
      setBusy(false);
      return;
    }
    onClose();
  }

  return (
    <div
      className="akun-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <form className="akun-sheet" role="dialog" aria-modal="true" aria-labelledby="akun-modal-title" onSubmit={submit}>
        <h3 id="akun-modal-title" className="akun-sheet-title">{title}</h3>
        {message && <p className="akun-sheet-msg">{message}</p>}

        {choices && (
          <div className="akun-choices">
            {choices.map((c) => (
              <button
                type="button"
                key={c.value}
                className={"akun-choice" + (value === c.value ? " is-on" : "")}
                onClick={() => { setValue(c.value); setErr(""); }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {input && (
          <div className="akun-field">
            <label htmlFor="akun-modal-input">{input.label}</label>
            <div className="akun-field-row">
              <input
                id="akun-modal-input"
                autoFocus
                autoComplete="new-password"
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => { setValue(e.target.value); setErr(""); }}
                placeholder={`Minimal ${input.minLength || 1} karakter`}
              />
              <button type="button" className="akun-link" onClick={() => setShow((s) => !s)}>
                {show ? "Sembunyikan" : "Tampilkan"}
              </button>
            </div>
            {input.generate && (
              <button
                type="button"
                className="akun-link"
                onClick={() => { setValue(randomPassword()); setShow(true); setErr(""); }}
              >
                Buat otomatis
              </button>
            )}
          </div>
        )}

        {err && <div className="akun-err" role="alert">{err}</div>}

        <div className="akun-sheet-actions">
          <button type="button" className="akun-btn akun-btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
          <button
            ref={confirmRef}
            type="submit"
            className={"akun-btn " + (tone === "danger" ? "akun-btn-solid-danger" : "akun-btn-primary")}
            disabled={busy}
          >
            {busy ? "Memproses..." : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
