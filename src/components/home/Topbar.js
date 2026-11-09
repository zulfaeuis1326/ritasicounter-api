import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ROLE_LABEL } from "@/lib/roles";
import {
  LogOut, ChevronsLeft, MousePointerClick, SlidersHorizontal, ClipboardCheck,
  LayoutDashboard, Truck, Users, ClipboardPen, ScrollText,
} from "lucide-react";

function LogoutIcon() {
  return <LogOut size={15} strokeWidth={2.2} />;
}
function CollapseIcon({ collapsed }) {
  return <ChevronsLeft size={17} strokeWidth={2.2} style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />;
}
function ClickIcon() {
  return <MousePointerClick size={18} strokeWidth={2.1} />;
}
function SlidersIcon() {
  return <SlidersHorizontal size={18} strokeWidth={2.1} />;
}
function CheckIcon() {
  return <ClipboardCheck size={18} strokeWidth={2.1} />;
}
function ChartIcon() {
  return <LayoutDashboard size={18} strokeWidth={2.1} />;
}
function TruckIcon() {
  return <Truck size={18} strokeWidth={2.1} />;
}
function CatatIcon() {
  return <ClipboardPen size={18} strokeWidth={2.1} />;
}
function LogIcon() {
  return <ScrollText size={18} strokeWidth={2.1} />;
}
function UsersIcon() {
  return <Users size={18} strokeWidth={2.1} />;
}

const SIDEBAR_KEY = "rc_sidebar_collapsed";

export default function Topbar({ authUser, canMonitorAll, isAdmin, isOperator, onLogout, currentPage }) {
  const [collapsed, setCollapsed] = useState(false);
  const page = currentPage || "input-ritasi";
  const homeLabel = isOperator ? "Input Ritasi" : "Beranda";
  const router = useRouter();

  // Operator hanya punya satu layar kerja (Input Ritasi). Sidebar dan bilah menu bawah disembunyikan lewat
  // kelas ini; satu-satunya jalan ke Pengaturan adalah chip Unit dan Excavator di bilah judul.
  useEffect(function () {
    if (!isOperator) return;
    document.body.classList.add("op-solo");
    return function () { document.body.classList.remove("op-solo"); };
  }, [isOperator]);
  const isPengawas = canMonitorAll && !isAdmin;

  // Pengawas wajib memilih lokasi PIT kerja setiap kali login sebelum memakai aplikasi.
  useEffect(function () {
    if (authUser && authUser.role === "pengawas" && !authUser.work_set && router.pathname !== "/pengaturan") {
      router.replace("/pengaturan?wajib=1");
    }
  }, [authUser, router]);

  useEffect(function () {
    const saved = window.localStorage.getItem(SIDEBAR_KEY) === "1";
    setCollapsed(saved);
    document.body.classList.toggle("sidebar-collapsed", saved);
  }, []);

  function handleToggleSidebar() {
    setCollapsed(function (prev) {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      document.body.classList.toggle("sidebar-collapsed", next);
      return next;
    });
  }

  function NavItem({ id, href, label, icon, show }) {
    if (show === false) return null;
    const isCurrent = page === id;
    const content = (
      <>
        <span className="topbar-nav-icon">{icon}</span>
        <span className="topbar-nav-label">{label}</span>
      </>
    );
    if (isCurrent) return <span className="topbar-nav-current" title={label}>{content}</span>;
    return <a href={href} title={label}>{content}</a>;
  }

  // Judul dan keterangan halaman untuk bilah di atas konten
  const META = {
    "input-ritasi": { title: homeLabel, sub: isOperator ? "Catat setiap ritasi unitmu" : "Pantau ritasi shift yang berjalan", icon: <ClickIcon /> },
    pengaturan: { title: "Pengaturan", sub: isOperator ? "Pilih excavator tempat kamu memuat" : "Pilih lokasi PIT tempat kamu bertugas", icon: <SlidersIcon /> },
    catat: { title: "Catat Ritasi", sub: "Input ritasi per hauler", icon: <CatatIcon /> },
    dashboard: { title: "Dashboard", sub: "Ringkasan produksi", icon: <ChartIcon /> },
    approval: { title: "Approval Shift", sub: "Setujui shift yang sudah ditutup", icon: <CheckIcon /> },
    fleet: { title: "Kelola Fleet", sub: "Penempatan HD, PC, dan lokasi", icon: <TruckIcon /> },
    akun: { title: "Kelola Akun", sub: "Persetujuan dan peran pengguna", icon: <UsersIcon /> },
    log: { title: "Log Aktivitas", sub: "Jejak aksi penting, khusus superadmin", icon: <LogIcon /> },
  };
  const meta = META[page] || { title: "RitasiCounter", sub: "", icon: <ClickIcon /> };

  return (
    <>
    <header className={"topbar" + (isOperator ? " topbar-operator" : "")}>
      <div className="topbar-logo">
        <span className="topbar-mark">
          <img src="/logo.png" alt="Logo" className="topbar-mark-img" onError={function (e) { e.target.style.display = "none"; }} />
        </span>
        <span className="topbar-logo-text">RitasiCounter</span>
      </div>

      <button className="topbar-collapse-btn" onClick={handleToggleSidebar} title={collapsed ? "Buka sidebar" : "Ciutkan sidebar"} aria-label="Toggle sidebar">
        <CollapseIcon collapsed={collapsed} />
      </button>

      <nav className="topbar-nav">
        <NavItem id="input-ritasi" href="/" label={homeLabel} icon={<ClickIcon />} show={!!isOperator} />
        <NavItem id="dashboard" href="/dashboard" label="Dashboard" icon={<ChartIcon />} show={canMonitorAll} />
        <NavItem id="catat" href="/catat" label="Catat Ritasi" icon={<CatatIcon />} show={canMonitorAll} />
        <NavItem id="fleet" href="/admin/fleet" label="Fleet" icon={<TruckIcon />} show={canMonitorAll} />
        <NavItem id="akun" href="/admin/operators" label="Akun" icon={<UsersIcon />} show={isAdmin} />
        <NavItem id="log" href="/admin/log" label="Log" icon={<LogIcon />} show={authUser.role === "superadmin"} />
      </nav>

      {isOperator && (
        <div className="side-card">
            <div className="side-card-title">Excavator</div>
            <div className="side-card-text">{authUser.fleet_name || "Belum dipilih. Pilih tempat kamu memuat."}</div>
            <a className="side-card-btn" href="/pengaturan">Atur excavator</a>
        </div>
      )}

      <div className="topbar-spacer" />

      <div className="topbar-footer">
        <span className="topbar-role-badge">{(ROLE_LABEL[authUser.role] || authUser.role).toUpperCase()}</span>
        <button className="topbar-iconbtn" onClick={onLogout} title="Logout" aria-label="Logout">
          <LogoutIcon />
        </button>
        <div className="topbar-avatar">{authUser.username.charAt(0).toUpperCase()}</div>
      </div>
    </header>

    <div className={"pagebar" + (isOperator ? " pagebar-op" : "")}>
      <div className="pagebar-title">
        {page !== "input-ritasi" && !(page === "dashboard" && !isOperator) && <a className="pagebar-back" href={isOperator ? "/" : "/dashboard"} aria-label={isOperator ? "Kembali ke beranda" : "Kembali ke dashboard"}>&#8249;</a>}
        <span className="pagebar-tile">{meta.icon}</span>
        <div className="pagebar-text">
          <h1 className="pagebar-h1">{meta.title}</h1>
          {meta.sub && <div className="pagebar-sub">{meta.sub}</div>}
        </div>
      </div>
      <div className="pagebar-right">
        <nav className="pagebar-crumb" aria-label="Breadcrumb">{!isOperator && page === "dashboard" ? null : <><span>{isOperator ? "Beranda" : "Dashboard"}</span><span>/</span></>}<b>{meta.title}</b></nav>
        {(isOperator || isPengawas) && !(isOperator && currentPage === "pengaturan") && (
          <a className={"pagebar-chip" + (isOperator && !authUser.fleet_name ? " pagebar-chip-warn" : "")} href="/pengaturan" title="Ubah di Pengaturan">
            {isOperator ? (authUser.unit_name ? authUser.unit_name + " · " : "") + (authUser.fleet_name || "Pilih excavator") : "PIT: " + (authUser.work_pit_name || "Semua")}
          </a>
        )}
        <span className="topbar-role-badge">{(ROLE_LABEL[authUser.role] || authUser.role).toUpperCase()}</span>
        <span className="pagebar-user">{authUser.username}</span>
        <div className="topbar-avatar">{authUser.username.charAt(0).toUpperCase()}</div>
        <button className="topbar-iconbtn" onClick={onLogout} title="Logout" aria-label="Logout">
          <LogoutIcon />
        </button>
      </div>
    </div>
    </>
  );
}
