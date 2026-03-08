import Head from "next/head";
import { useState } from "react";
import Link from "next/link";

// ── Design tokens ─────────────────────────────────────────────────
const C = {
  primary: "#2563eb",
  bg: "#f8fafc",
  card: "#ffffff",
  textMain: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  divider: "#f1f5f9",
} as const;

const CARD_STYLE: React.CSSProperties = {
  background: C.card,
  borderRadius: 16,
  padding: 22,
  boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
};

// ── Shared components ─────────────────────────────────────────────

function Header() {
  return (
    <header style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", height: 56, padding: "0 20px", display: "flex", alignItems: "center", flexShrink: 0 }}>
      <span style={{ color: "white", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>Cooperative Poker</span>
    </header>
  );
}

function CardTitle({ title }: { title: string }) {
  return (
    <h2 style={{ fontSize: 16, fontWeight: 700, color: C.textMain, margin: "0 0 14px" }}>{title}</h2>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function AboutPage() {
  const [licenseOpen, setLicenseOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>About - Cooperative Poker</title></Head>

      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: 540, margin: "0 auto", padding: "28px 20px 40px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Page title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>About</h1>
          <Link href="/" style={{ fontSize: 14, fontWeight: 500, color: C.primary, textDecoration: "none" }}>Back</Link>
        </div>

        {/* About card */}
        <section style={CARD_STYLE}>
          <CardTitle title="About this app" />
          <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, margin: "0 0 12px" }}>
            This app is designed to help conference attendees break the ice through a quick shared activity. Players receive a small hand of cards and can form poker combinations together with another attendee. The goal is to create a fun, lightweight interaction that encourages conversation and makes it easier to meet new people during the event.
          </p>
          <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, margin: "0 0 12px" }}>
            The experience is intentionally simple and short so participants can play multiple rounds and interact with different people throughout the event.
          </p>
          <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, margin: 0 }}>
            This app was built as part of the{" "}
            <a
              href="https://luma.com/dhfhbj2y"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.primary, textDecoration: "none", fontWeight: 500 }}
            >
              AI Israel Club × AppDeploy: Hackathon #1 2026
            </a>.
          </p>
        </section>

        {/* Open source card */}
        <section style={CARD_STYLE}>
          <CardTitle title="Open source assets" />
          <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, margin: "0 0 12px" }}>
            Some visual assets used in this application come from the{" "}
            <a
              href="https://github.com/MattCain/svg-playing-cards"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.primary, textDecoration: "none", fontWeight: 500 }}
            >
              SVG Playing Cards
            </a>
            {" "}open-source project by Matt Cain, licensed under the MIT License.
          </p>

          {/* Collapsible license */}
          <button
            type="button"
            onClick={() => setLicenseOpen((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer", padding: 0,
              fontSize: 13, fontWeight: 600, color: C.primary,
            }}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: licenseOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease", flexShrink: 0 }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {licenseOpen ? "Hide license" : "View MIT license"}
          </button>

          {licenseOpen && (
            <div style={{
              marginTop: 10, padding: "12px 14px",
              background: C.bg, borderRadius: 10,
              border: `1px solid ${C.border}`,
              fontSize: 12, color: C.textMuted, lineHeight: 1.65,
            }}>
              <p style={{ margin: "0 0 8px" }}>
                Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the &ldquo;Software&rdquo;), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.
              </p>
              <p style={{ margin: "0 0 8px" }}>
                The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
              </p>
              <p style={{ margin: 0 }}>
                THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
              </p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
