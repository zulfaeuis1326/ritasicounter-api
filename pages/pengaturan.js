import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { atLeast } from "../lib/roles";
import Topbar from "../components/home/Topbar";

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error " + res.status);
  return data;
}

// Operator  : pilih excavator (PC/Loader) tempat memuat.
// Pengawas  : pilih lokasi PIT kerja (wajib setiap login).
export default function Pengaturan() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(undefined);
  const [info, setInfo] = useState(null);
  const [choice, setChoice] = useState("");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);

  const loadAuth = useCallback(async () => {
    const d = await api("GET", "/api/auth/me");
    if (!d.user) { router.push("/login"); return null; }
    setAuthUser(d.user);
    return d.user;
  }, [router]);
  const loadInfo = useCallback(async () => {
    const d = await api("GET", "/api/auth/work-setting");
    setInfo(d);
    return d;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const u = await loadAuth();
        if (!u) return;
        const d = await loadInfo();
        setChoice(String((u.role === "operator" ? d.fleetId : d.workPitId) || ""));
      } catch (e) { setBanner({ type: "error", text: "Gagal memuat: " + e.message }); }
    })();
  }, [loadAuth, loadInfo]);

  if (!authUser || !info) {
    return <div className="container"><div className="card"><div className="hint">{banner ? banner.text : "Memuat..."}</div></div></div>;
  }
  const isOperator = authUser.role === "operator";
  const wajib = !isOperator && router.query.wajib;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function save() {
    setSaving(true);
    setBanner(null);
    try {
      const id = choice === "" ? null : Number(choice);
      await api("POST", "/api/auth/work-setting", isOperator ? { fleetId: id } : { pitId: id });
      const d = await loadInfo(); // baca ulang dari database untuk membuktikan tersimpan
      await loadAuth();
      const tersimpan = isOperator ? (d.fleetId || null) === id : ((d.workPitId || null) === id && d.workSet);
      if (!tersimpan) { setBanner({ type: "warn", text: "Server menjawab sukses, tapi data belum sesuai. Muat ulang halaman dan cek lagi." }); return; }
      // Operator selesai memilih excavator -> langsung kembali ke Input Ritasi (tidak terjebak di halaman ini)
      if (isOperator || router.query.wajib) { router.push("/"); return; }
      setBanner({ type: "ok", text: "Tersimpan di database dan sudah dicek ulang." });
    } catch (e) {
      setBanner({ type: "error", text: "Gagal menyimpan: " + e.message });
    } finally { setSaving(false); }
  }

  // kelompokkan excavator per PIT (untuk daftar pilihan operator)
  const groups = {};
  (info.fleets || []).forEach((f) => { const k = f.pit_name || "Tanpa lokasi"; (groups[k] = groups[k] || []).push(f); });

  return (
    <div className="v4-page">
      <Topbar authUser={authUser} canMonitorAll={atLeast(authUser.role, "pengawas")} isAdmin={atLeast(authUser.role, "admin")} isOperator={isOperator} onLogout={handleLogout} currentPage="pengaturan" />
      <main className="container">
        {banner && <div className={"fl-banner fl-banner-" + banner.type} role="status">{banner.type === "ok" ? "✓ " : ""}{banner.text}</div>}

        {isOperator ? (
          <div className="card">
            <h2 className="sec-title-icon">Pengaturan Operator</h2>
            <div className="fl-row"><span className="fl-name">Unit kamu</span><span className="fl-badge">{info.unitName || "belum dipilih"}</span></div>
            <div className="field-label mt-12 mb-6">Excavator (PC / Loader) tempat kamu memuat</div>
            <select className="field-input" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Ikuti PC milik unit (bawaan)</option>
              {Object.keys(groups).map((k) => (
                <optgroup key={k} label={k}>
                  {groups[k].map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="hint mt-8">Ritasi yang kamu catat setelah ini dicatat atas excavator yang dipilih. Ritasi sebelumnya tidak berubah. Pilihan dilepas otomatis saat kamu logout.</div>
            <button className="auth-submit mt-12" disabled={saving} onClick={save}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        ) : (
          <div className="card">
            <h2 className="sec-title-icon">Lokasi PIT kerja</h2>
            <div className="hint mb-8">{wajib ? "Pilih lokasi PIT tempat kamu bertugas sebelum lanjut. Halaman Catat Ritasi akan langsung menampilkan PIT ini." : "Ganti lokasi kalau kamu pindah tugas. Pilihan dilepas otomatis saat logout."}</div>
            {[{ id: "", name: "Semua PIT" }, ...info.pits].map((p) => (
              <label key={p.id || "all"} className={"pick-row" + (choice === String(p.id) ? " active" : "")}>
                <input type="radio" name="pit" checked={choice === String(p.id)} onChange={() => setChoice(String(p.id))} />
                <span className="pick-name">{p.name}</span>
              </label>
            ))}
            <button className="auth-submit mt-12" disabled={saving} onClick={save}>{saving ? "Menyimpan..." : (wajib ? "Simpan dan Lanjut" : "Simpan Lokasi")}</button>
          </div>
        )}
        <div className="app-footer">designed by Najib.dev</div>
      </main>
    </div>
  );
}
