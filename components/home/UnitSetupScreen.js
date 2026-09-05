export default function UnitSetupScreen({
  authUser,
  setupUnits,
  settingUnit,
  newSetupUnitName,
  onChangeNewSetupUnitName,
  onSetUnit,
  onRegisterOwnUnit,
  onLogout,
}) {
  return (
    <div className="container">
      <div className="card header-card">
        <div className="clock" style={{ fontSize: 22 }}>Pilih Unit Kamu</div>
        <div className="hint" style={{ textAlign: "center" }}>
          Halo {authUser.username} — pilih 1 unit yang akan kamu operasikan. Setelah dipilih,
          unit ini terkunci sampai kamu logout. Mau ganti unit? Logout dulu, lalu login lagi.
        </div>
      </div>
      <div className="card">
        {setupUnits.length === 0 && <div className="hint">Belum ada unit terdaftar — daftarkan unit kamu sendiri di bawah.</div>}
        {setupUnits.map(function (u) {
          return (
            <button
              key={u.id}
              className="btn btn-secondary"
              disabled={settingUnit}
              onClick={function () { onSetUnit(u.id); }}
            >
              {u.name}
            </button>
          );
        })}
      </div>
      <div className="card">
        <div className="section-title">Nomor unit kamu tidak ada di atas?</div>
        <form onSubmit={onRegisterOwnUnit} style={{ display: "flex", gap: 8 }}>
          <input
            value={newSetupUnitName}
            onChange={function (e) { onChangeNewSetupUnitName(e.target.value); }}
            placeholder="Contoh: HD-07"
            style={{ flex: 1 }}
            disabled={settingUnit}
          />
          <button className="btn btn-secondary" style={{ width: "auto", padding: "0 16px" }} disabled={settingUnit}>
            Daftarkan
          </button>
        </form>
        <div className="hint">Ketik nomor unit kamu sendiri kalau belum ada di daftar tombol di atas.</div>
      </div>
      <div className="card">
        <button className="btn-mini-danger" onClick={onLogout}>Logout</button>
      </div>
    </div>
  );
}
