import { useState, useEffect } from "react";

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 7 11 7a21.6 21.6 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const JABATAN_OPTIONS = [
  { value: "operator", label: "Operator" },
  { value: "pengawas", label: "Pengawas" },
];

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [jabatan, setJabatan] = useState("operator");
  const [units, setUnits] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [newUnitName, setNewUnitName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(function () {
    fetch("/api/units")
      .then(function (res) { return res.json(); })
      .then(function (data) { if (Array.isArray(data)) setUnits(data); })
      .catch(function () { /* daftar unit gagal dimuat - tetap bisa daftarkan unit baru manual */ });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    if (jabatan === "operator" && !selectedUnitId && !newUnitName.trim()) {
      setError("Operator wajib pilih unit yang sudah ada atau daftarkan unit baru");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          role: jabatan,
          unitId: jabatan === "operator" ? selectedUnitId : undefined,
          newUnitName: jabatan === "operator" ? newUnitName : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal daftar");
        return;
      }
      window.location.href = "/";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img src="/logo.png" alt="Logo" className="auth-logo" onError={function (e) { e.target.style.display = "none"; }} />
        <div className="auth-title">Daftar Akun</div>
        <div className="auth-subtitle">Buat akun baru untuk mulai pakai RitasiCounter</div>

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="username">Username</label>
            <input
              id="username"
              className="field-input"
              value={username}
              onChange={function (e) { setUsername(e.target.value); }}
              autoCapitalize="none"
              autoComplete="username"
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="password">Password</label>
            <div className="field-password-wrap">
              <input
                id="password"
                className="field-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={function (e) { setPassword(e.target.value); }}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="field-password-toggle"
                onClick={function () { setShowPassword(!showPassword); }}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <div className="field-hint">Minimal 8 karakter</div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="jabatan">Jabatan</label>
            <select
              id="jabatan"
              className="field-input"
              value={jabatan}
              onChange={function (e) { setJabatan(e.target.value); }}
            >
              {JABATAN_OPTIONS.map(function (opt) {
                return <option key={opt.value} value={opt.value}>{opt.label}</option>;
              })}
            </select>
            <div className="field-hint">Jabatan Admin hanya bisa diberikan manual oleh superadmin.</div>
          </div>

          {jabatan === "operator" && (
            <div className="field-group">
              <label className="field-label" htmlFor="unit">Unit Kamu</label>
              <select
                id="unit"
                className="field-input"
                value={selectedUnitId}
                onChange={function (e) { setSelectedUnitId(e.target.value); }}
                style={{ marginBottom: 8 }}
              >
                <option value="">-- Pilih unit yang sudah ada --</option>
                {units.map(function (u) {
                  return <option key={u.id} value={u.id}>{u.name}</option>;
                })}
              </select>
              <input
                className="field-input"
                value={newUnitName}
                onChange={function (e) { setNewUnitName(e.target.value); }}
                placeholder="Atau ketik nomor unit baru, misal HD-07"
              />
              <div className="field-hint">Pilih salah satu: dari daftar di atas, atau ketik nomor unit baru kalau belum terdaftar.</div>
            </div>
          )}

          {error && <div className="field-error">{error}</div>}

          <button className="auth-submit" disabled={loading}>
            {loading ? "Memproses..." : "Daftar"}
          </button>
        </form>

        <div className="auth-switch">
          Sudah punya akun? <a href="/login">Login di sini</a>
        </div>
      </div>
      <div className="app-footer">designed by Najib.dev</div>
    </div>
  );
}
