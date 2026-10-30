import { useEffect, useState } from "react";

// Dipakai di semua halaman yang butuh cek "siapa yang login" (index, dashboard,
// admin/fleet, admin/operators, display). Dulu tiap halaman punya salinan sendiri
// dari logic ini, dan SEMUANYA salah dengan cara yang sama: kalau fetch ke
// /api/auth/me gagal karena APAPUN (server sempet down, koneksi DB lagi lambat,
// timeout, dst), langsung dianggap "belum login" dan ditendang ke /login --
// padahal cookie sesi-nya sendiri masih sah. Efeknya: user kerasa gampang
// "logout sendiri" padahal enggak, cuma server-nya lagi hiccup sesaat.
//
// Aturan yang benar: HANYA redirect ke /login kalau server BENERAN bilang
// "tidak ada user" (res.ok + data.user kosong). Kalau request-nya sendiri
// gagal (network error, 500, timeout dst), JANGAN redirect -- tampilkan
// authError dan biarkan halaman kasih tombol coba lagi, jangan usir user.
export function useAuthCheck(router, { minRole, redirectIfBelow = "/" } = {}) {
  const [authUser, setAuthUser] = useState(undefined); // undefined = masih loading
  const [authError, setAuthError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setAuthError(null);

    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          // Server bermasalah SESAAT (mis. DB timeout) -- ini BUKAN sinyal "belum
          // login", jangan diperlakukan sama seperti itu.
          throw new Error(`Server bermasalah (${res.status}), coba lagi`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!data.user) {
          router.push("/login");
          return;
        }
        if (minRole) {
          // Perlu import atLeast di sini biar hook ini gak wajib tahu bentuk role,
          // tapi supaya tetap ringan, kita terima minRole sebagai fungsi cek siap pakai.
          const ok = typeof minRole === "function" ? minRole(data.user.role) : true;
          if (!ok) {
            router.push(redirectIfBelow);
            return;
          }
        }
        setAuthUser(data.user);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Cek sesi gagal (server hiccup, TIDAK logout paksa):", err);
        setAuthError(err.message || "Gagal memuat sesi. Coba lagi.");
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, retryTick]);

  function retry() {
    setAuthUser(undefined);
    setRetryTick((t) => t + 1);
  }

  return { authUser, authError, retry };
}
