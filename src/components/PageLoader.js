// Animasi loading pengganti tulisan "Memuat...". Murni CSS (lihat src/styles/loader.css),
// jadi ringan dan tidak menambah request.
export default function PageLoader() {
  return (
    <div className="pl-screen" role="status" aria-live="polite">
      <div className="pl-stack" aria-hidden="true">
        <span className="pl-halo" />
        <span className="pl-ring" />
        <span className="pl-ring pl-ring-2" />
        <img
          src="/logo.png"
          alt=""
          className="pl-logo"
          onError={function (e) { e.target.style.display = "none"; }}
        />
      </div>
      <div className="pl-dots" aria-hidden="true"><i /><i /><i /></div>
      <span className="pl-sr">Memuat</span>
    </div>
  );
}

// Versi kecil (tiga titik melompat) untuk tempat sempit seperti banner atau daftar.
export function InlineLoader() {
  return (
    <span className="pl-inline" role="status" aria-live="polite">
      <span className="pl-dots pl-dots-sm" aria-hidden="true"><i /><i /><i /></span>
      <span className="pl-sr">Memuat</span>
    </span>
  );
}
