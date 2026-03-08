import Head from "next/head";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "@appdeploy/client";

const EVENT_CODE_KEY = "attendee_event_code";
const DEVICE_TOKEN_KEY = "attendee_device_token";
const PLAYER_ID_KEY = "attendee_player_id";

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

const CDN = "https://cdn.jsdelivr.net/gh/levyavi/combo_poker@main/cooperative-poker/public";
const TROPHY: Record<number, string> = { 1: `${CDN}/gold-trophy.png`, 2: `${CDN}/silver-trophy.png`, 3: `${CDN}/bronze-trophy.png` };

// ── Helpers ──────────────────────────────────────────────────────

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
    try { const text = await r.text(); data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { ok: r.ok, status: r.status, data };
  }
  if (res && typeof res === "object" && "data" in res) {
    const r = res as { data?: unknown; status?: number };
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, data: r.data };
  }
  return { ok: false, data: res };
}

type LeaderboardEntry = { player_id: string; display_name: string; total_score: number; rank: number };

// ── Shared components ────────────────────────────────────────────

function Header({ score }: { score: number }) {
  return (
    <header style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", height: 56, padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
      <span style={{ color: "white", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>Cooperative Poker</span>
      <span style={{ color: "white", opacity: 0.9, fontWeight: 500, fontSize: 14 }}>Score: {score} pts</span>
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
    { key: "home", label: "Home", href: "/home" },
    { key: "leaderboard", label: "Leaderboard", href: "/leaderboard" },
    { key: "interactions", label: "Interactions", href: "/interactions" },
    { key: "profile", label: "Profile", href: "/profile" },
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

// ── Page ────────────────────────────────────────────────────────

type FilterMode = "top10" | "aroundMe" | "all";

export default function LeaderboardPage() {
  const router = useRouter();
  const [stored, setStored] = useState<{ eventCode: string; deviceToken: string; playerId?: string } | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [list, setList] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userScore, setUserScore] = useState(0);
  const [filter, setFilter] = useState<FilterMode>("top10");

  const fetchLeaderboard = useCallback(async () => {
    if (!eventId) return;
    setError(null);
    try {
      const res = await api.get(`/api/leaderboard?event_id=${encodeURIComponent(eventId)}`);
      const { ok, data } = await normalizeResponse(res);
      if (ok && data && typeof data === "object" && "leaderboard" in data) {
        const arr = (data as { leaderboard: LeaderboardEntry[] }).leaderboard;
        setList(Array.isArray(arr) ? arr : []);
        if (stored?.playerId) {
          const mine = (Array.isArray(arr) ? arr : []).find((e: LeaderboardEntry) => e.player_id === stored.playerId);
          if (mine) setUserScore(mine.total_score);
        }
      } else {
        setList([]);
        if (data && typeof data === "object" && "error" in data) setError((data as { error: string }).error);
      }
    } catch {
      setError("Network error");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [eventId, stored]);

  useEffect(() => { setStored(getStored()); }, []);

  useEffect(() => {
    if (!stored) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.post("/api/player/create_or_load", {
          body: JSON.stringify(stored.playerId ? { player_id: stored.playerId } : { event_code: stored.eventCode, device_session_token: stored.deviceToken }),
          headers: { "Content-Type": "application/json" },
        });
        const { ok, data } = await normalizeResponse(res);
        if (!cancelled && ok && data && typeof data === "object" && "event_id" in data) {
          const eid = (data as { event_id?: string }).event_id ?? (data as { eventId?: string }).eventId;
          if (eid) setEventId(eid);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [stored]);

  useEffect(() => {
    if (eventId) fetchLeaderboard();
    else setLoading(false);
  }, [eventId, fetchLeaderboard]);

  // ── Filter logic ─────────────────────────────────────────────

  const myPlayerId = stored?.playerId ?? null;
  const myIndex = list.findIndex((e) => e.player_id === myPlayerId);

  const filteredList = (() => {
    if (filter === "top10") return list.slice(0, 10);
    if (filter === "aroundMe") {
      if (myIndex === -1) return list.slice(0, 10);
      const start = Math.max(0, myIndex - 3);
      const end = Math.min(list.length, myIndex + 4);
      return list.slice(start, end);
    }
    return list;
  })();

  // ── Guards ───────────────────────────────────────────────────

  if (typeof window !== "undefined" && !stored && getStored() === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 16 }}>
        <Head><title>Leaderboard - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>No event session.</p>
        <Link href="/" style={{ marginTop: 16, color: C.primary, textDecoration: "underline" }}>Enter event</Link>
      </div>
    );
  }

  if (!stored || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <Head><title>Leaderboard - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>Loading...</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>Leaderboard - Cooperative Poker</title></Head>

      <Header score={userScore} />

      <main style={{ flex: 1, width: "100%", maxWidth: 540, margin: "0 auto", padding: "28px 20px 80px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Page title */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>Leaderboard</h1>

        {/* Leaderboard card */}
        <section style={CARD_STYLE}>

          {/* Filter segmented control */}
          <div style={{ display: "flex", background: C.divider, borderRadius: 8, padding: 3, gap: 2, marginBottom: 20 }}>
            {([["top10", "Top 10"], ["aroundMe", "Around Me"], ["all", "All"]] as [FilterMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilter(mode)}
                style={{
                  flex: 1, padding: "6px 0", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  background: filter === mode ? "white" : "transparent",
                  color: filter === mode ? C.textMain : C.textMuted,
                  boxShadow: filter === mode ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}

          {filteredList.length === 0 ? (
            <p style={{ fontSize: 14, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>
              No scores yet. Start playing to appear on the leaderboard.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {filteredList.map((entry, i) => {
                const isMe = entry.player_id === myPlayerId;
                const isLast = i === filteredList.length - 1;
                return (
                  <li
                    key={entry.player_id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 10px",
                      borderRadius: 10,
                      borderBottom: isLast ? "none" : `1px solid ${C.divider}`,
                      background: isMe ? "#eff6ff" : "transparent",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {TROPHY[entry.rank] ? (
                        <img src={TROPHY[entry.rank]} alt={`#${entry.rank}`} style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }} />
                      ) : (
                        <span style={{ width: 32, textAlign: "center", fontSize: 13, fontWeight: 600, color: C.textMuted, flexShrink: 0 }}>#{entry.rank}</span>
                      )}
                      <span style={{ fontSize: 15, fontWeight: isMe ? 600 : 500, color: C.textMain }}>
                        {entry.display_name || "Anonymous"}
                        {isMe && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: C.primary, background: "#dbeafe", borderRadius: 10, padding: "2px 7px" }}>You</span>}
                      </span>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#16a34a" }}>{entry.total_score} pts</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </main>

      <BottomNav active="leaderboard" />
    </div>
  );
}
