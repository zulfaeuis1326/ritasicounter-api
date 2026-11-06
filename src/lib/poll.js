// Jalankan fn berkala tiap intervalMs. Mengembalikan fungsi pembersih (dipakai sebagai
// return di useEffect). Polling berhenti saat tab disembunyikan dan langsung menyegarkan
// sekali begitu tab dibuka lagi, supaya HP operator tidak boros baterai dan kuota.
export function startPolling(fn, intervalMs) {
  let timer = null;

  function start() {
    if (timer === null) timer = setInterval(fn, intervalMs);
  }
  function stop() {
    if (timer !== null) { clearInterval(timer); timer = null; }
  }
  function onVisibility() {
    if (document.hidden) {
      stop();
    } else {
      fn();
      start();
    }
  }

  if (!document.hidden) start();
  document.addEventListener("visibilitychange", onVisibility);

  return function cleanup() {
    stop();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
