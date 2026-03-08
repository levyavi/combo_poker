import Head from "next/head";
import Link from "next/link";

// ── Design tokens (same as Home) ─────────────────────────────────
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

// ── Scoring table data ───────────────────────────────────────────
const HANDS = [
  { name: "High card",       pts: 1,   desc: "No matching cards"                         },
  { name: "One pair",        pts: 2,   desc: "Two cards of the same rank"                },
  { name: "Two pair",        pts: 4,   desc: "Two different pairs"                       },
  { name: "Three of a kind", pts: 8,   desc: "Three cards of the same rank"              },
  { name: "Straight",        pts: 16,  desc: "Five consecutive ranks"                    },
  { name: "Flush",           pts: 32,  desc: "Five cards of the same suit"               },
  { name: "Full house",      pts: 64,  desc: "Three of a kind + one pair"                },
  { name: "Four of a kind",  pts: 128, desc: "Four cards of the same rank"               },
  { name: "Straight flush",  pts: 256, desc: "Five consecutive cards of the same suit"   },
];

// ── Shared components ────────────────────────────────────────────

function Header() {
  return (
    <header style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", height: 56, padding: "0 20px", display: "flex", alignItems: "center", flexShrink: 0 }}>
      <span style={{ color: "white", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>Cooperative Poker</span>
    </header>
  );
}

const NAV_ICONS: Record<string, (active: boolean) => React.ReactNode> = {
  home: (a) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={a ? C.primary : "none"} stroke={a ? C.primary : "#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" /><path d="M9 21V12h6v9" />
    </svg>
  ),
  leaderboard: (a) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? C.primary : "#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h12v6a6 6 0 01-12 0V2z" /><path d="M6 2H3a1 1 0 00-1 1v1a4 4 0 004 4" /><path d="M18 2h3a1 1 0 011 1v1a4 4 0 01-4 4" /><path d="M12 14v4" /><path d="M8 18h8" />
    </svg>
  ),
  interactions: (a) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? C.primary : "#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" />
      <path d="M2 20c0-3.314 3.134-6 7-6s7 2.686 7 6" /><path d="M17 14c2.21 0 4 1.567 4 3.5" />
    </svg>
  ),
  profile: (a) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? C.primary : "#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" />
    </svg>
  ),
};

function BottomNav({ active }: { active: "home" | "leaderboard" | "interactions" | "profile" }) {
  const tabs = [
    { key: "home",         label: "Home",         href: "/home"         },
    { key: "leaderboard",  label: "Leaderboard",  href: "/leaderboard"  },
    { key: "interactions", label: "Interactions", href: "/interactions" },
    { key: "profile",      label: "Profile",      href: "/profile"      },
  ] as const;
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 64, background: "white", borderTop: `1px solid ${C.border}`, boxShadow: "0 -4px 16px rgba(0,0,0,0.08)", paddingBottom: 6, display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 10 }}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link key={tab.key} href={tab.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 70, padding: "6px 8px", textDecoration: "none", position: "relative", transition: "all 0.15s ease" }}>
            {isActive && <span style={{ position: "absolute", top: -7, left: "50%", transform: "translateX(-50%)", width: 24, height: 2, background: C.primary, borderRadius: 2 }} />}
            {NAV_ICONS[tab.key](isActive)}
            <span style={{ fontSize: 12, fontWeight: 500, color: isActive ? C.primary : "#64748b", transition: "all 0.15s ease" }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function CardTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: C.textMain, margin: 0 }}>{title}</h2>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

export default function InstructionsPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>Instructions - Cooperative Poker</title></Head>

      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: 540, margin: "0 auto", padding: "28px 20px 80px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Page title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>Instructions</h1>
          <Link href="/home" style={{ fontSize: 14, fontWeight: 500, color: C.primary, textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            Home
          </Link>
        </div>

        {/* Card 1 — Goal */}
        <section style={CARD_STYLE}>
          <CardTitle icon="🎯" title="Goal of the game" />
          <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, margin: 0 }}>
            Cooperative Poker is a team-based card game played at live events. You pair up with another attendee
            and work together to build the strongest possible 5-card poker hand from your combined 8 cards.
            The stronger your hand, the more points you both earn — so choose wisely and collaborate!
          </p>
        </section>

        {/* Card 2 — How to play */}
        <section style={CARD_STYLE}>
          <CardTitle icon="🃏" title="How to play" />
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              "Join the event by entering the event code on the home screen.",
              "Create a combo and share your invite code, or join a partner's combo by entering their code.",
              "Break the ice — read the conversation starter and learn about your partner.",
              "Both players see all 8 combined cards. The combo leader selects the best 5-card hand.",
              "Submit the combo to earn points. Your score is added to the leaderboard.",
              "Repeat with new partners to climb the leaderboard!",
            ].map((text, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, paddingTop: 4 }}>{text}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Card 3 — Scoring */}
        <section style={CARD_STYLE}>
          <CardTitle icon="🏆" title="Scoring" />
          <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, margin: "0 0 16px 0" }}>
            Points are awarded based on the strength of the 5-card poker hand you submit. Higher hands earn exponentially more points.
          </p>
          <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {HANDS.map((hand, i) => (
              <div
                key={hand.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: i % 2 === 0 ? "white" : C.bg,
                  borderBottom: i < HANDS.length - 1 ? `1px solid ${C.divider}` : "none",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.textMain }}>{hand.name}</span>
                  <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 8 }}>{hand.desc}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap", marginLeft: 12 }}>
                  {hand.pts} pt{hand.pts !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 12, marginBottom: 0, lineHeight: 1.5 }}>
            Note: The event organiser may customise point values. Actual scores may differ.
          </p>
        </section>

        {/* Card 4 — Tips */}
        <section style={CARD_STYLE}>
          <CardTitle icon="💡" title="Tips" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { tip: "Talk to your partner",    detail: "The icebreaker is there to help — use it to start a real conversation." },
              { tip: "Think together",           detail: "The leader picks the cards, but both players benefit from the score. Discuss before submitting." },
              { tip: "Meet more people",         detail: "Each combo is with a different partner. The more combos you play, the more points you can earn." },
              { tip: "Cooldown between repeats", detail: "If you play a combo with the same partner again, there is a cooldown period before you can pair up with them once more." },
              { tip: "No duplicate combos",      detail: "You cannot submit the exact same 5-card hand you already played with the same partner — but you can play a different hand together." },
              { tip: "Interactions list",        detail: "After playing combos you can view everyone you have interacted with in the Interactions tab. Tap any person to see the contact details they chose to share." },
            ].map(({ tip, detail }) => (
              <div key={tip} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary, flexShrink: 0, marginTop: 6 }} />
                <p style={{ fontSize: 14, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 600, color: C.textMain }}>{tip}</span>
                  {" — "}
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </section>

      </main>

      <BottomNav active="home" />
    </div>
  );
}
