import Combobox from "../Combobox";

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
        <div className="hint ta-center" >
          Halo {authUser.username} — pilih 1 unit yang akan kamu operasikan. Setelah dipilih,
          unit ini terkunci sampai kamu logout. Mau ganti unit? Logout dulu, lalu login lagi.
        </div>
      </div>
      <div className="card">
        <div className="field-label mb-6" >Unit</div>
        <Combobox
          value=""
          onChange={function (unitId) { if (unitId && !settingUnit) onSetUnit(unitId); }}
          options={setupUnits.map(function (u) { return { value: String(u.id), label: u.name }; })}
          placeholder="Cari unit kamu..."
          emptyLabel={setupUnits.length === 0 ? "Belum ada unit terdaftar" : null}
        />
        {settingUnit && <div className="hint mt-8" >Menyimpan pilihan unit...</div>}
      </div>
      <div className="card">
        <div className="section-title">Nomor unit kamu tidak ada di atas?</div>
        <form onSubmit={onRegisterOwnUnit} className="d-flex gap-8">
          <input
            value={newSetupUnitName}
            onChange={function (e) { onChangeNewSetupUnitName(e.target.value); }}
            placeholder="Contoh: HD-07"
            className="flex-1"
            disabled={settingUnit}
 />
          <button className="btn btn-secondary w-auto px-16"  disabled={settingUnit}>
            Daftarkan
          </button>
        </form>
        <div className="hint">Ketik nomor unit kamu sendiri kalau belum ada di daftar di atas.</div>
      </div>
      <div className="card">
        <button className="btn-mini-danger" onClick={onLogout}>Logout</button>
      </div>
    </div>
  );
}
