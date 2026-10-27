import Head from "next/head";
import "../styles/base.css";
import "../styles/components.css";
import "../styles/auth.css";
import "../styles/layout.css";
import "../styles/panels.css";
import "../styles/display.css";
import "../styles/extras.css";
import "../styles/tweaks.css";
import "../styles/utilities.css";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
