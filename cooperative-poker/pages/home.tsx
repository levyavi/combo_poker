import Head from "next/head";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "@appdeploy/client";

const CDN = "https://cdn.jsdelivr.net/gh/levyavi/combo_poker@main/cooperative-poker/public";

const EVENT_CODE_KEY = "attendee_event_code";
const DEVICE_TOKEN_KEY = "attendee_device_token";
const PLAYER_ID_KEY = "attendee_player_id";
const INVITE_CODE_KEY = "combo_invite_code";

// ── Design tokens ────────────────────────────────────────────────
const C = {
  primary: "#2563eb",
  primaryDark: "#1e40af",
  bg: "#f8fafc",
  card: "#ffffff",
  textMain: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  header: "#1e293b",
  green: "#22c55e",
  divider: "#f1f5f9",
  joinBtn: "#e2e8f0",
} as const;

const CARD_SHADOW = "0 10px 24px rgba(15,23,42,0.08)";
const EVENT_CARD_SHADOW = "0 12px 26px rgba(15,23,42,0.08)";
const CARD_STYLE: React.CSSProperties = {
  background: C.card,
  borderRadius: 16,
  padding: 22,
  boxShadow: CARD_SHADOW,
};

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

function clearStored(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(EVENT_CODE_KEY);
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    localStorage.removeItem(PLAYER_ID_KEY);
  } catch {}
}

function cardImagePath(card: string): string {
  const suit = card.slice(-1);
  const rank = card.length === 3 ? card.slice(0, 2) : card[0];
  const rankName: Record<string, string> = { A: "ace", K: "king", Q: "queen", J: "jack" };
  const suitName: Record<string, string> = { C: "clubs", D: "diamonds", H: "hearts", S: "spades" };
  return `${CDN}/cards/${rankName[rank] ?? rank}_of_${suitName[suit]}.svg`;
}

const RANK_ORDER = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUIT_ORDER = ["D", "C", "H", "S"];

function sortHandByRankThenSuit(cards: string[]): string[] {
  return [...cards].sort((a, b) => {
    const rankA = a.length === 3 ? a.slice(0, 2) : a[0];
    const rankB = b.length === 3 ? b.slice(0, 2) : b[0];
    const suitA = a.slice(-1);
    const suitB = b.slice(-1);
    const rankDiff = RANK_ORDER.indexOf(rankA) - RANK_ORDER.indexOf(rankB);
    return rankDiff !== 0 ? rankDiff : SUIT_ORDER.indexOf(suitA) - SUIT_ORDER.indexOf(suitB);
  });
}

// ── Sub-components ──────────────────────────────────────────────

function Header({ score }: { score: number }) {
  return (
    <header style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", height: 56, padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
      <span style={{ color: "white", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>Cooperative Poker</span>
      <span style={{ color: "white", opacity: 0.9, fontWeight: 500, fontSize: 14 }}>Score: {score} pts</span>
    </header>
  );
}

function EventSection({ title, description, roundState }: {
  title: string;
  description: string;
  roundState: string | null;
}) {
  const dotColor =
    roundState === "ACTIVE" ? C.green :
    roundState === "ENDED" ? "#94a3b8" :
    "#f59e0b";
  const statusLabel =
    roundState === "ACTIVE" ? "Round Active" :
    roundState === "ENDED" ? "Round Ended" :
    roundState === "NOT_STARTED" ? "Not Started" : "-";

  return (
    <section style={{
      borderRadius: 16,
      boxShadow: EVENT_CARD_SHADOW,
      overflow: "hidden",
      position: "relative",
      minHeight: 140,
    }}>
      {/* Background image */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url(${CDN}/event-bg.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }} />
      {/* Dark overlay so text stays readable */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(135deg, rgba(15,23,42,0.72) 0%, rgba(15,23,42,0.45) 100%)",
      }} />
      {/* Content */}
      <div style={{ position: "relative", padding: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "white", lineHeight: 1.3, margin: 0 }}>{title || "Event"}</h1>
        {description ? <p style={{ margin: "4px 0 0", fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{description}</p> : null}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0, display: "inline-block", boxShadow: `0 0 6px ${dotColor}` }} />
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.85)" }}>{statusLabel}</span>
        </div>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px 0" }}>
      {children}
    </p>
  );
}

function PlayerCards({ cards }: { cards: string[] }) {
  return (
    <section style={CARD_STYLE}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionLabel>Your Cards</SectionLabel>
        <Link
          href="/instructions"
          style={{ fontSize: 13, color: C.primary, fontWeight: 500, textDecoration: "none", marginBottom: 14 }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
        >
          View instructions &rsaquo;
        </Link>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
        {sortHandByRankThenSuit(cards).map((card) => (
          <img
            key={card}
            src={cardImagePath(card)}
            alt={card}
            style={{
              flex: "1 1 0",
              minWidth: 0,
              maxWidth: 90,
              height: "auto",
              boxShadow: "0 8px 16px rgba(15,23,42,0.12)",
              display: "block",
            }}
          />
        ))}
      </div>
    </section>
  );
}

function JoinComboButton({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  const enabled = !disabled;
  const enabledBg = "linear-gradient(135deg, #22c55e, #16a34a)";
  const enabledHover = "linear-gradient(135deg, #16a34a, #15803d)";
  const disabledStyle: React.CSSProperties = { background: C.joinBtn, color: "#64748b", cursor: "not-allowed", opacity: 0.65 };
  const enabledStyle: React.CSSProperties = { background: enabledBg, color: "white", cursor: "pointer" };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 44,
        borderRadius: 10,
        fontWeight: 600,
        fontSize: 14,
        paddingLeft: 18,
        paddingRight: 18,
        border: "none",
        whiteSpace: "nowrap",
        transition: "all 0.15s ease",
        ...(enabled ? enabledStyle : disabledStyle),
      }}
      onMouseEnter={(e) => { if (enabled) e.currentTarget.style.background = enabledHover; }}
      onMouseLeave={(e) => { if (enabled) e.currentTarget.style.background = enabledBg; }}
    >
      {label}
    </button>
  );
}

function ComboActions({ joinCode, setJoinCode, onJoinSubmit, joiningCombo, joinError, onScanClick }: {
  joinCode: string;
  setJoinCode: (v: string) => void;
  onJoinSubmit: () => void;
  joiningCombo: boolean;
  joinError: string | null;
  onScanClick: () => void;
}) {
  return (
    <section style={{ ...CARD_STYLE, display: "flex", flexDirection: "column", gap: 12 }}>
      <Link
        href="/create-combo"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: 48,
          borderRadius: 12,
          background: "linear-gradient(135deg, #2563eb, #3b82f6)",
          color: "white",
          fontWeight: 600,
          fontSize: 16,
          textDecoration: "none",
          transition: "all 0.15s ease",
          boxSizing: "border-box",
          boxShadow: "0 6px 14px rgba(37,99,235,0.35)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, #1d4ed8, #2563eb)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, #2563eb, #3b82f6)"; }}
      >
        Create Combo
      </Link>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type="text"
            maxLength={5}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter code"
            style={{
              width: "100%",
              height: 44,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: "white",
              paddingLeft: 14,
              paddingRight: 40,
              fontFamily: "monospace",
              fontSize: 14,
              color: C.textMain,
              outline: "none",
              boxSizing: "border-box",
              transition: "all 0.15s ease",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.15)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
          />
          <button
            type="button"
            onClick={onScanClick}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              transition: "color 0.15s ease",
            }}
            aria-label="Scan QR code"
          >
            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-4v3a1 1 0 01-1 1h-3m4-11h-3a1 1 0 01-1-1V3" />
            </svg>
          </button>
        </div>
        <JoinComboButton
          onClick={onJoinSubmit}
          disabled={joiningCombo || joinCode.length !== 5}
          label={joiningCombo ? "Joining..." : "Join Combo"}
        />
      </div>
      {joinError && <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{joinError}</p>}
    </section>
  );
}

type LeaderboardEntry = { player_id: string; display_name: string; total_score: number; rank: number };

const TROPHY: Record<number, string> = { 1: `${CDN}/gold-trophy.png`, 2: `${CDN}/silver-trophy.png`, 3: `${CDN}/bronze-trophy.png` };

function LeaderboardPreview({ entries }: { entries: LeaderboardEntry[] }) {
  const top3 = entries.slice(0, 3);
  return (
    <section style={CARD_STYLE}>
      <SectionLabel>Leaderboard</SectionLabel>
      {top3.length === 0 ? (
        <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>No scores yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {top3.map((entry, i) => (
            <li
              key={entry.player_id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: i < top3.length - 1 ? `1px solid ${C.divider}` : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {TROPHY[entry.rank] ? (
                  <img src={TROPHY[entry.rank]} alt={`#${entry.rank}`} style={{ width: 28, height: 28, objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, width: 28, textAlign: "center" }}>#{entry.rank}</span>
                )}
                <span style={{ fontSize: 14, fontWeight: 500, color: C.textMain }}>{entry.display_name || "Player"}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{entry.total_score} pts</span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/leaderboard"
        style={{ display: "block", textAlign: "center", marginTop: 14, fontSize: 14, color: C.primary, fontWeight: 500, textDecoration: "none", transition: "all 0.15s ease" }}
        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
      >
        View full leaderboard
      </Link>
    </section>
  );
}

const NAV_ICONS: Record<string, (active: boolean) => React.ReactNode> = {
  home: (a) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={a ? C.primary : "none"} stroke={a ? C.primary : "#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  ),
  leaderboard: (a) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? C.primary : "#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h12v6a6 6 0 01-12 0V2z" /><path d="M6 2H3a1 1 0 00-1 1v1a4 4 0 004 4" /><path d="M18 2h3a1 1 0 011 1v1a4 4 0 01-4 4" /><path d="M12 14v4" /><path d="M8 18h8" />
    </svg>
  ),
  interactions: (a) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? C.primary : "#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2 20c0-3.314 3.134-6 7-6s7 2.686 7 6" />
      <path d="M17 14c2.21 0 4 1.567 4 3.5" />
    </svg>
  ),
  profile: (a) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={a ? C.primary : "#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" />
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
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      height: 64,
      background: "white",
      borderTop: `1px solid ${C.border}`,
      boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
      paddingBottom: 6,
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      zIndex: 10,
    }}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              minWidth: 70,
              padding: "6px 8px",
              textDecoration: "none",
              position: "relative",
              transition: "all 0.15s ease",
            }}
          >
            {isActive && (
              <span style={{
                position: "absolute",
                top: -7,
                left: "50%",
                transform: "translateX(-50%)",
                width: 24,
                height: 2,
                background: C.primary,
                borderRadius: 2,
              }} />
            )}
            {NAV_ICONS[tab.key](isActive)}
            <span style={{
              fontSize: 12,
              fontWeight: 500,
              color: isActive ? C.primary : "#64748b",
              transition: "all 0.15s ease",
            }}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── QR scanner helper ────────────────────────────────────────────

function extractCodeFromScan(text: string): string | null {
  const trimmed = text.trim();
  try {
    const url = new URL(trimmed);
    const param = url.searchParams.get("code") ?? url.searchParams.get("invite_code");
    if (param && /^\d{5}$/.test(param)) return param;
  } catch {}
  const match = trimmed.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}

// ── Page ────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [stored, setStored] = useState<{ eventCode: string; deviceToken: string; playerId?: string } | null>(null);
  const [eventTitle, setEventTitle] = useState<string>("");
  const [eventDescription, setEventDescription] = useState<string>("");
  const [eventId, setEventId] = useState<string | null>(null);
  const [hasActiveCombo, setHasActiveCombo] = useState(false);
  const [roundState, setRoundState] = useState<string | null>(null);
  const [handCount, setHandCount] = useState<number>(0);
  const [handCards, setHandCards] = useState<string[]>([]);
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [joiningCombo, setJoiningCombo] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<unknown>(null);
  const autoJoinTriggered = useRef(false);

  const fetchLeaderboard = useCallback(async (evId: string, playerId?: string) => {
    try {
      const res = await api.get(`/api/leaderboard?event_id=${encodeURIComponent(evId)}`);
      const { ok, data } = await normalizeResponse(res);
      if (ok && data && typeof data === "object" && "leaderboard" in data) {
        const entries = (data as { leaderboard: LeaderboardEntry[] }).leaderboard;
        setLeaderboard(entries);
        if (playerId) {
          const mine = entries.find((e) => e.player_id === playerId);
          if (mine) setTotalScore(mine.total_score);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const fetchState = useCallback(async () => {
    if (!stored) return;
    try {
      const enterRes = await api.post("/api/event/enter", {
        body: JSON.stringify({ event_code: stored.eventCode }),
        headers: { "Content-Type": "application/json" },
      });
      const enter = await normalizeResponse(enterRes);
      if (enter.status === 404) {
        clearStored();
        setStored(null);
        router.replace("/");
        return;
      }
      let currentEventId: string | null = null;
      if (enter.ok && enter.data && typeof enter.data === "object") {
        const d = enter.data as { round_state?: string; event_title?: string; event_description?: string; event_id?: string };
        setRoundState(d.round_state ?? null);
        setEventTitle((d.event_title ?? "").toString().trim());
        setEventDescription((d.event_description ?? "").toString().trim());
        if (d.event_id) {
          currentEventId = d.event_id;
          setEventId(d.event_id);
          fetchLeaderboard(d.event_id, stored.playerId);
        }
      }
      const handQuery = stored.playerId
        ? `player_id=${encodeURIComponent(stored.playerId)}`
        : `event_code=${encodeURIComponent(stored.eventCode)}&device_session_token=${encodeURIComponent(stored.deviceToken)}`;
      const handRes = await api.get(`/api/player/hand?${handQuery}`);
      const hand = await normalizeResponse(handRes);
      const handErr = hand.data && typeof hand.data === "object" ? (hand.data as { error?: string }).error : undefined;
      if (hand.status === 404 || handErr === "Player not found") {
        const pidForLoad = typeof window !== "undefined" ? localStorage.getItem(PLAYER_ID_KEY) : null;
        const createRes = await api.post("/api/player/create_or_load", {
          body: JSON.stringify({
            player_id: pidForLoad ?? undefined,
            event_code: stored.eventCode,
            device_session_token: stored.deviceToken,
          }),
          headers: { "Content-Type": "application/json" },
        });
        const create = await normalizeResponse(createRes);
        if (create.status === 404 || !create.ok) {
          clearStored();
          setStored(null);
          router.replace("/");
          return;
        }
        const data = create.data as { hand_cards?: unknown; player_id?: string };
        if (data?.player_id && typeof window !== "undefined") {
          try { localStorage.setItem(PLAYER_ID_KEY, data.player_id); } catch {}
        }
        const cards = Array.isArray(data?.hand_cards) ? (data.hand_cards as string[]).map(String) : [];
        setHandCount(cards.length);
        setHandCards(cards);
        const newStored = getStored();
        setStored(newStored);
        if (currentEventId) fetchLeaderboard(currentEventId, data?.player_id ?? newStored?.playerId);
        return;
      }
      if (hand.ok && hand.data && typeof hand.data === "object" && "hand" in hand.data) {
        const arr = (hand.data as { hand: unknown }).hand;
        const cards = Array.isArray(arr) ? arr.map(String) : [];
        setHandCount(cards.length);
        setHandCards(cards);
      } else {
        setHandCount(0);
        setHandCards([]);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number }; status?: number })?.response?.status
        ?? (err as { status?: number })?.status;
      const errMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "";
      if (status === 404 || errMsg === "Event not found") {
        clearStored();
        setStored(null);
        router.replace("/");
        return;
      }
      setRoundState(null);
      setHandCount(0);
      setHandCards([]);
    }
  }, [stored, router, fetchLeaderboard]);

  useEffect(() => {
    setStored(getStored());
    if (typeof window !== "undefined") {
      setHasActiveCombo(!!localStorage.getItem(INVITE_CODE_KEY));
    }
  }, []);

  useEffect(() => {
    if (stored) fetchState();
  }, [stored, fetchState]);

  useEffect(() => {
    if (stored && hasActiveCombo) router.replace("/combo");
  }, [stored, hasActiveCombo, router]);

  const handleJoinRound = useCallback(async () => {
    if (!stored) return;
    setError(null);
    setJoinSubmitting(true);
    try {
      const res = await api.post("/api/round/join", {
        body: JSON.stringify(
          stored.playerId
            ? { player_id: stored.playerId }
            : { event_code: stored.eventCode, device_session_token: stored.deviceToken }
        ),
        headers: { "Content-Type": "application/json" },
      });
      const { ok, data } = await normalizeResponse(res);
      if (ok) {
        setHandCount(4);
        fetchState();
      } else {
        const err = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "Failed to join round";
        setError(err);
      }
    } catch {
      setError("Network error");
    } finally {
      setJoinSubmitting(false);
    }
  }, [stored, fetchState]);

  useEffect(() => {
    if (!stored || roundState !== "ACTIVE" || handCount >= 4 || autoJoinTriggered.current || joinSubmitting) return;
    autoJoinTriggered.current = true;
    handleJoinRound();
  }, [roundState, handCount, stored, joinSubmitting, handleJoinRound]);

  // Inline join combo
  const handleJoinCombo = useCallback(async () => {
    if (!stored || joinCode.length !== 5) return;
    setJoinError(null);
    setJoiningCombo(true);
    try {
      const res = await api.post("/api/combo/join", {
        body: JSON.stringify({
          invite_code: joinCode,
          ...(stored.playerId ? { player_id: stored.playerId } : { event_code: stored.eventCode, device_session_token: stored.deviceToken }),
        }),
        headers: { "Content-Type": "application/json" },
      });
      const { ok, data } = await normalizeResponse(res);
      if (ok) {
        if (typeof window !== "undefined") localStorage.setItem(INVITE_CODE_KEY, joinCode);
        router.push("/icebreak");
      } else {
        setJoinError((data as { error?: string })?.error ?? "Failed to join");
      }
    } catch {
      setJoinError("Network error");
    } finally {
      setJoiningCombo(false);
    }
  }, [stored, joinCode, router]);

  // QR scanner
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      const s = scannerRef.current as { stop: () => Promise<void>; clear: () => void };
      try { await s.stop(); } catch {}
      try { s.clear(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleScanClick = useCallback(async () => {
    if (scanning) { stopScanner(); return; }
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("home-qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 200 },
        (decodedText: string) => {
          const code = extractCodeFromScan(decodedText);
          if (code) { setJoinCode(code); stopScanner(); }
        },
        () => {}
      );
    } catch {
      setScanning(false);
    }
  }, [scanning, stopScanner]);

  useEffect(() => { return () => { stopScanner(); }; }, [stopScanner]);

  // ── Loading / redirect guards ──────────────────────────────────

  if (typeof window !== "undefined" && !stored && getStored() === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 16 }}>
        <Head><title>Event Home - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>No event session. Please enter an event code first.</p>
        <Link href="/" style={{ marginTop: 16, color: C.primary, textDecoration: "underline" }}>Enter event</Link>
      </div>
    );
  }

  if (!stored || hasActiveCombo) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <Head><title>Event Home - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>Loading...</p>
      </div>
    );
  }

  const showCards = handCards.length > 0;
  const showComboActions = roundState === "ACTIVE" && showCards;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>{eventTitle || "Event Home"} - Cooperative Poker</title></Head>

      <Header score={totalScore} />

      <main style={{ flex: 1, overflowY: "auto", width: "100%", maxWidth: 540, margin: "0 auto", padding: "28px 20px 80px", display: "flex", flexDirection: "column", gap: 22 }}>

        <EventSection
          title={eventTitle}
          description={eventDescription}
          roundState={roundState}
        />

        {error && <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{error}</p>}
        {joinSubmitting && <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Joining event...</p>}

        {showCards && <PlayerCards cards={handCards} />}

        {showComboActions && (
          <>
            <ComboActions
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              onJoinSubmit={handleJoinCombo}
              joiningCombo={joiningCombo}
              joinError={joinError}
              onScanClick={handleScanClick}
            />
            {scanning && (
              <div style={{ background: "white", borderRadius: 16, boxShadow: CARD_SHADOW, overflow: "hidden" }}>
                <div id="home-qr-reader" />
                <button
                  type="button"
                  onClick={stopScanner}
                  style={{ width: "100%", padding: "10px 0", fontSize: 13, color: C.textMuted, background: "none", border: "none", cursor: "pointer", transition: "all 0.15s ease" }}
                >
                  Cancel scan
                </button>
              </div>
            )}
          </>
        )}

        <LeaderboardPreview entries={leaderboard} />

      </main>

      <BottomNav active="home" />
    </div>
  );
}
