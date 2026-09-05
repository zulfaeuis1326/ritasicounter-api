import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import "../styles/globals.css";
import ThemeToggle from "../components/ThemeToggle";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  // Halaman utama (V4) punya tombol tema sendiri di Topbar, jadi tombol
  // melayang global disembunyikan di situ biar gak dobel.
  const hideFloatingToggle = router.pathname === "/";

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Script id="theme-init" strategy="beforeInteractive">
        {`
          try {
            var saved = window.localStorage.getItem("ritasi-theme");
            var theme = (saved === "dark" || saved === "light") ? saved : "light";
            document.documentElement.setAttribute("data-theme", theme);
          } catch (err) {
            document.documentElement.setAttribute("data-theme", "light");
          }
        `}
      </Script>
      {!hideFloatingToggle && <ThemeToggle />}
      <Component {...pageProps} />
    </>
  );
}
