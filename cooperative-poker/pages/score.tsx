import Head from "next/head";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "@appdeploy/client";

const EVENT_CODE_KEY = "attendee_event_code";
const DEVICE_TOKEN_KEY = "attendee_device_token";
const PLAYER_ID_KEY = "attendee_player_id";

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

// ── Helpers ───────────────────────────────────────────────────────

function getStored(): { eventCode: string; deviceToken: string; playerId?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const eventCode = localStorage.getItem(EVENT_CODE_KEY);
    const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
    if (eventCode && deviceToken) return { eventCode, deviceToken, playerId: playerId ?? undefined };
  } catch {}
  return null;
}

async function normalizeResponse(res: unknown): Promise<{ ok: boolean; status?: number; data: unknown }> {
  if (res && typeof (res as Response).text === "function") {
    const r = res as Response;
    let data: unknown = null;
    try {
      const text = await r.text();
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: r.ok, status: r.status, data };
  }
  if (res && typeof res === "object" && "data" in res) {
    const r = res as { data?: unknown; status?: number };
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, data: r.data };
  }
  return { ok: false, data: res };
}

// ── Shared components ─────────────────────────────────────────────

function Header() {
  return (
    <header style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", height: 56, padding: "0 20px", display: "flex", alignItems: "center", flexShrink: 0 }}>
      <span style={{ color: "white", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>Cooperative Poker</span>
    </header>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function ScorePage() {
  const router = useRouter();
  const [stored, setStored] = useState<{ eventCode: string; deviceToken: string; playerId?: string } | null>(null);
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [lastComboScore, setLastComboScore] = useState<number | null>(null);
  const [lastComboHandRankName, setLastComboHandRankName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const query = (typeof window !== "undefined" ? router.query : {}) as { combo_score?: string; hand_rank?: string };
  const fromQueryScore = query.combo_score != null && query.combo_score !== "" ? Number(query.combo_score) : null;
  const fromQueryRank = query.hand_rank != null && query.hand_rank !== "" ? decodeURIComponent(query.hand_rank) : null;
  const showComboBreakdown = (fromQueryScore != null && !Number.isNaN(fromQueryScore)) || lastComboScore != null;
  const displayComboScore = fromQueryScore != null && !Number.isNaN(fromQueryScore) ? fromQueryScore : lastComboScore;
  const displayComboName = fromQueryRank ?? lastComboHandRankName;

  useEffect(() => {
    setStored(getStored());
  }, []);

  useEffect(() => {
    if (!stored) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.post("/api/player/create_or_load", {
          body: JSON.stringify(
            stored.playerId
              ? { player_id: stored.playerId }
              : { event_code: stored.eventCode, device_session_token: stored.deviceToken }
          ),
          headers: { "Content-Type": "application/json" },
        });
        const { ok, data } = await normalizeResponse(res);
        if (!cancelled && ok && data && typeof data === "object") {
          const d = data as {
            total_score?: number;
            totalScore?: number;
            last_combo_score_awarded?: number | null;
            lastComboScoreAwarded?: number | null;
            last_combo_hand_rank_name?: string | null;
            lastComboHandRankName?: string | null;
          };
          setTotalScore(d.total_score ?? d.totalScore ?? 0);
          const comboScore = d.last_combo_score_awarded ?? d.lastComboScoreAwarded ?? null;
          setLastComboScore(comboScore != null ? Number(comboScore) : null);
          const rankName = d.last_combo_hand_rank_name ?? d.lastComboHandRankName ?? null;
          setLastComboHandRankName(rankName != null ? String(rankName) : null);
        }
      } catch {
        if (!cancelled) setTotalScore(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [stored]);

  // ── Guards ────────────────────────────────────────────────────

  if (typeof window !== "undefined" && !stored && getStored() === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 16 }}>
        <Head><title>Score - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>No event session.</p>
        <Link href="/" style={{ marginTop: 16, color: C.primary, textDecoration: "underline" }}>Enter event</Link>
      </div>
    );
  }

  if (!stored || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <Head><title>Score - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>Loading...</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  const prevScore = Math.max(0, (totalScore ?? 0) - (displayComboScore ?? 0));

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>Score - Cooperative Poker</title></Head>

      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: 540, margin: "0 auto", padding: "28px 20px 40px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Page title */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>Your score</h1>

        {/* Score card */}
        <section style={CARD_STYLE}>
          {showComboBreakdown && displayComboScore != null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Hand name + points earned */}
              <div style={{ textAlign: "center", paddingBottom: 20, borderBottom: `1px solid ${C.divider}` }}>
                {displayComboName && (
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                    {displayComboName}
                  </p>
                )}
                <p style={{ fontSize: 52, fontWeight: 800, color: "#16a34a", margin: 0, lineHeight: 1 }}>
                  +{displayComboScore}
                </p>
                <p style={{ fontSize: 14, color: C.textMuted, margin: "6px 0 0" }}>points earned this combo</p>
              </div>

              {/* Score breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, color: C.textMuted }}>Previous score</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.textMain }}>{prevScore} pts</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, color: C.textMuted }}>This combo</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#16a34a" }}>+{displayComboScore} pts</span>
                </div>
                <div style={{ height: 1, background: C.divider }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.textMain }}>New total</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>{totalScore ?? 0} pts</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <p style={{ fontSize: 52, fontWeight: 800, color: "#16a34a", margin: 0, lineHeight: 1 }}>{totalScore ?? 0}</p>
              <p style={{ fontSize: 14, color: C.textMuted, margin: "10px 0 0", lineHeight: 1.55 }}>
                Total points from combos<br />(both players get full points)
              </p>
            </div>
          )}
        </section>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link
            href="/home"
            style={{
              display: "block", textAlign: "center", height: 48, lineHeight: "48px",
              borderRadius: 12, fontSize: 15, fontWeight: 600, color: "white", textDecoration: "none",
              background: "linear-gradient(135deg, #2563eb, #3b82f6)",
              boxShadow: "0 6px 14px rgba(37,99,235,0.35)",
            }}
          >
            Back to home
          </Link>
          <Link
            href="/leaderboard"
            style={{
              display: "block", textAlign: "center", height: 48, lineHeight: "48px",
              borderRadius: 12, fontSize: 15, fontWeight: 600, color: C.primary, textDecoration: "none",
              background: C.divider,
            }}
          >
            View leaderboard
          </Link>
        </div>

      </main>
    </div>
  );
}
