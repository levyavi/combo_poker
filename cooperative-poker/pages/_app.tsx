import type { AppProps } from "next/app";
import Head from "next/head";
import "../styles/globals.css";

const CDN = "https://cdn.jsdelivr.net/gh/levyavi/combo_poker@main/cooperative-poker/public";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <link rel="icon" type="image/svg+xml" href={`${CDN}/favicon.svg`} />
        <link rel="icon" type="image/png" sizes="32x32" href={`${CDN}/favicon.png`} />
        <link rel="apple-touch-icon" href={`${CDN}/favicon.png`} />
        <meta name="theme-color" content="#2563eb" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
