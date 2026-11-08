import { useEffect, useState } from "react";
import { useRouter } from "next/router";

// Indikator transisi halaman: garis progres tipis di atas layar + spinner kecil di pojok.
// Muncul untuk perpindahan lewat router Next DAN klik tautan <a href> biasa
// (yang memuat ulang halaman), lalu hilang saat halaman baru siap.
// Ada jeda 120ms supaya perpindahan yang sangat cepat tidak berkedip.
export default function RouteLoader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(function () {
    let timer = null;
    let safety = null;
    function start() {
      clearTimeout(timer);
      timer = setTimeout(function () { setBusy(true); }, 120);
      // Pengaman: kalau karena sebab apa pun halaman tidak jadi pindah, indikator hilang sendiri.
      clearTimeout(safety);
      safety = setTimeout(function () { setBusy(false); }, 10000);
    }
    function stop() {
      clearTimeout(timer);
      clearTimeout(safety);
      setBusy(false);
    }

    function onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      let url;
      try { url = new URL(a.href, window.location.href); } catch (err) { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname.indexOf("/api/") === 0) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }

    router.events.on("routeChangeStart", start);
    router.events.on("routeChangeComplete", stop);
    router.events.on("routeChangeError", stop);
    document.addEventListener("click", onClick, true);
    window.addEventListener("pageshow", stop);
    return function () {
      clearTimeout(timer);
      clearTimeout(safety);
      router.events.off("routeChangeStart", start);
      router.events.off("routeChangeComplete", stop);
      router.events.off("routeChangeError", stop);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pageshow", stop);
    };
  }, [router]);

  if (!busy) return null;
  return (
    <div className="rl-root" aria-hidden="true">
      <div className="rl-bar"><span /></div>
      <div className="rl-chip"><span className="rl-spin" /></div>
    </div>
  );
}
