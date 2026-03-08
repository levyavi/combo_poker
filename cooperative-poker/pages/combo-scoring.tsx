import Head from "next/head";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

const HAND_NAMES_ORDER = [
  "High card",
  "One pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
];

const COMBO_HAND_SCORES_KEY = "combo_hand_scores";

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

// ── Page ──────────────────────────────────────────────────────────

export default function ComboScoringPage() {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(COMBO_HAND_SCORES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        setScores(parsed && typeof parsed === "object" ? parsed : null);
      } else {
        setScores(null);
      }
    } catch {
      setScores(null);
    }
  }, []);

  const ordered = scores ? HAND_NAMES_ORDER.filter((n) => scores[n] !== undefined) : [];
  const rest = scores ? Object.keys(scores).filter((k) => !HAND_NAMES_ORDER.includes(k)) : [];
  const names = [...ordered, ...rest];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>Scoring - Cooperative Poker</title></Head>

      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: 540, margin: "0 auto", padding: "28px 20px 40px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Page title */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>Scoring</h1>

        {/* Scoring card */}
        <section style={CARD_STYLE}>
          <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, margin: "0 0 18px" }}>
            Points awarded for each 5-card hand. Both you and your partner get the same points for your combo.
          </p>

          {names.length > 0 && scores ? (
            <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
              {names.map((name, i) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    background: i % 2 === 0 ? "white" : C.bg,
                    borderBottom: i < names.length - 1 ? `1px solid ${C.divider}` : "none",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.textMain }}>{name}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap" }}>
                    {scores[name]} pt{scores[name] !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 14, color: "#94a3b8" }}>No scoring data available for this event.</p>
          )}
        </section>

        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            height: 48, borderRadius: 12, border: "none", cursor: "pointer",
            fontSize: 15, fontWeight: 600, color: "white",
            background: "linear-gradient(135deg, #2563eb, #3b82f6)",
            boxShadow: "0 6px 14px rgba(37,99,235,0.35)",
          }}
        >
          Back to combo
        </button>

      </main>
    </div>
  );
}
