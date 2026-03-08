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
const COMBO_HAND_SCORES_KEY = "combo_hand_scores";

// ── Design tokens (same as Home) ─────────────────────────────────
const C = {
  primary: "#2563eb",
  primaryDark: "#1e40af",
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

function getInviteCode(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(INVITE_CODE_KEY);
}

async function normalizeResponse(res: unknown): Promise<{ ok: boolean; status?: number; data: unknown }> {
  if (res && typeof (res as Response).text === "function") {
    const r = res as Response;
    let data: unknown = null;
    try {
      const text = await r.text();
      data = text ? JSON.parse(text) : null;
    } catch { data = null; }
    return { ok: r.ok, status: r.status, data };
  }
  if (res && typeof res === "object" && "data" in res) {
    const r = res as { data?: unknown; status?: number };
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, data: r.data };
  }
  return { ok: false, data: res };
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

function parseCard(card: string): { rank: string; suit: string } {
  return { suit: card.slice(-1), rank: card.length === 3 ? card.slice(0, 2) : card[0] };
}

type CardWithUser = { card: string; rank: string; suit: string; user: string; idx: number };

function indicesToCards(indices: number[], combined: CardWithUser[]): string[] {
  return indices.map((i) => combined.find((c) => c.idx === i)?.card).filter(Boolean) as string[];
}

function serverStringsToIndices(strings: string[], combined: CardWithUser[]): number[] {
  const pool = [...combined];
  const indices: number[] = [];
  for (const card of strings) {
    const pos = pool.findIndex((c) => c.card === card);
    if (pos !== -1) { indices.push(pool[pos].idx); pool.splice(pos, 1); }
  }
  return indices;
}

function sortCards(items: CardWithUser[], sortBy: "rank" | "suit" | "user"): CardWithUser[] {
  const rankVal = (c: CardWithUser) => RANK_ORDER.indexOf(c.rank);
  const suitVal = (c: CardWithUser) => SUIT_ORDER.indexOf(c.suit);
  const userVal = (c: CardWithUser) => (c.user === "You" ? 0 : 1);
  return [...items].sort((a, b) => {
    if (sortBy === "rank") {
      return rankVal(a) - rankVal(b) || suitVal(a) - suitVal(b) || userVal(a) - userVal(b);
    }
    if (sortBy === "suit") {
      return suitVal(a) - suitVal(b) || rankVal(a) - rankVal(b) || userVal(a) - userVal(b);
    }
    // user
    return userVal(a) - userVal(b) || rankVal(a) - rankVal(b) || suitVal(a) - suitVal(b);
  });
}

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

// ── Modal ────────────────────────────────────────────────────────

function Modal({ title, body, actions }: { title: string; body: string; actions: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.5)" }} aria-modal="true" role="dialog">
      <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 320, width: "100%", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: C.textMain, margin: "0 0 10px 0" }}>{title}</p>
        <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 20px 0", lineHeight: 1.5 }}>{body}</p>
        <div style={{ display: "flex", gap: 10 }}>{actions}</div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

export default function ComboPage() {
  const router = useRouter();
  const [stored, setStored] = useState<{ eventCode: string; deviceToken: string; playerId?: string } | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [leaderHand, setLeaderHand] = useState<string[]>([]);
  const [inviteeHand, setInviteeHand] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const combinedRef = useRef<CardWithUser[]>([]);
  const [isLeader, setIsLeader] = useState(false);
  const [state, setState] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handScores, setHandScores] = useState<Record<string, number> | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [sortBy, setSortBy] = useState<"rank" | "suit" | "user">("rank");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showPartnerLeftModal, setShowPartnerLeftModal] = useState(false);
  const leaderHasEditedRef = useRef(false);
  const navigatingRef = useRef(false);

  const payload = stored?.playerId
    ? { player_id: stored.playerId, invite_code: inviteCode }
    : stored
      ? { event_code: stored.eventCode, device_session_token: stored.deviceToken, invite_code: inviteCode }
      : null;

  const fetchComboState = useCallback(async () => {
    if (!stored || !inviteCode) return;
    try {
      const query = new URLSearchParams({
        invite_code: inviteCode,
        ...(stored.playerId ? { player_id: stored.playerId } : { event_code: stored.eventCode, device_session_token: stored.deviceToken }),
      });
      const res = await api.get(`/api/combo/state?${query}`);
      const { ok, status, data } = await normalizeResponse(res);
      if (ok && data && typeof data === "object") {
        const d = data as {
          state?: string; is_leader?: boolean; leader_hand?: string[]; invitee_hand?: string[];
          selected_cards?: string[]; selectedCards?: string[]; leaderHand?: string[]; inviteeHand?: string[];
          isLeader?: boolean; score_awarded?: number | null; scoreAwarded?: number | null;
          hand_rank_name?: string | null; handRankName?: string | null; hand_scores?: Record<string, number> | null;
        };
        const isLeaderFromServer = d.is_leader ?? d.isLeader ?? false;
        const newState = d.state ?? "";
        setState((prevState) => {
          if (prevState === "PENDING" && newState === "SELECTING" && isLeaderFromServer) router.push("/icebreak");
          return newState;
        });
        if (newState === "SUBMITTED" && !navigatingRef.current) {
          navigatingRef.current = true;
          if (typeof window !== "undefined") localStorage.removeItem(INVITE_CODE_KEY);
          const comboScore = d.score_awarded ?? d.scoreAwarded ?? null;
          const handRank = d.hand_rank_name ?? d.handRankName ?? "";
          const params = new URLSearchParams();
          if (comboScore != null) params.set("combo_score", String(comboScore));
          if (handRank) params.set("hand_rank", handRank);
          router.push(params.toString() ? `/score?${params.toString()}` : "/score");
        }
        if (newState === "CANCELLED") setShowPartnerLeftModal(true);
        setIsLeader(isLeaderFromServer);
        setLeaderHand(Array.isArray(d.leader_hand) ? d.leader_hand : Array.isArray(d.leaderHand) ? d.leaderHand : []);
        setInviteeHand(Array.isArray(d.invitee_hand) ? d.invitee_hand : Array.isArray(d.inviteeHand) ? d.inviteeHand : []);
        const hs = d.hand_scores;
        setHandScores(hs && typeof hs === "object" && !Array.isArray(hs) ? hs : null);
        const sel = d.selected_cards ?? d.selectedCards;
        let serverSelected: string[] = [];
        if (Array.isArray(sel)) {
          serverSelected = sel;
        } else if (typeof sel === "string") {
          try { const p = JSON.parse(sel) as unknown; serverSelected = Array.isArray(p) ? p.map(String) : []; } catch { serverSelected = []; }
        }
        const lhLocal = Array.isArray(d.leader_hand) ? d.leader_hand.map(String) : Array.isArray(d.leaderHand) ? d.leaderHand.map(String) : [];
        const ihLocal = Array.isArray(d.invitee_hand) ? d.invitee_hand.map(String) : Array.isArray(d.inviteeHand) ? d.inviteeHand.map(String) : [];
        const yourH = isLeaderFromServer ? lhLocal : ihLocal;
        const partnerH = isLeaderFromServer ? ihLocal : lhLocal;
        const localCombined: CardWithUser[] = [
          ...yourH.map((card, i) => { const { rank, suit } = parseCard(card); return { card, rank, suit, user: "You", idx: i }; }),
          ...partnerH.map((card, i) => { const { rank, suit } = parseCard(card); return { card, rank, suit, user: "Partner", idx: yourH.length + i }; }),
        ];
        const serverIndices = serverStringsToIndices(serverSelected, localCombined);
        const sorted = (arr: string[]) => [...arr].sort();
        const sameSelection = (a: string[], b: string[]) => a.length === b.length && JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
        if (!isLeaderFromServer) {
          setSelectedIndices(serverIndices);
        } else {
          setSelectedIndices((prev) => {
            if (serverSelected.length === 0) return [];
            const prevCards = indicesToCards(prev, localCombined);
            if (sameSelection(prevCards, serverSelected)) return serverIndices;
            if (prev.length === 0 && !leaderHasEditedRef.current) return serverIndices;
            if (prev.length === 0 && serverIndices.length > 0) return prev;
            return prev;
          });
        }
      } else {
        if (status === 404) { setState("CANCELLED"); setShowPartnerLeftModal(true); }
        setLeaderHand([]); setInviteeHand([]);
      }
    } catch {
      setLeaderHand([]); setInviteeHand([]);
    } finally {
      setLoading(false);
    }
  }, [stored, inviteCode, router]);

  useEffect(() => { setStored(getStored()); setInviteCode(getInviteCode()); }, []);
  useEffect(() => { if (stored && inviteCode) fetchComboState(); }, [stored, inviteCode, fetchComboState]);
  useEffect(() => {
    if (!stored || !inviteCode) return;
    if (state !== "PENDING" && state !== "SELECTING") return;
    const interval = setInterval(fetchComboState, state === "PENDING" ? 1500 : 800);
    return () => clearInterval(interval);
  }, [stored, inviteCode, state, fetchComboState]);

  const handleSelect = (idx: number) => {
    if (!isLeader || state !== "SELECTING") return;
    leaderHasEditedRef.current = true;
    let nextIndices: number[];
    if (selectedIndices.includes(idx)) {
      nextIndices = selectedIndices.filter((i) => i !== idx);
    } else if (selectedIndices.length < 5) {
      nextIndices = [...selectedIndices, idx];
    } else {
      return;
    }
    setSelectedIndices(nextIndices);
    if (payload) {
      api.post("/api/combo/select", {
        body: JSON.stringify({ ...payload, selected_cards: indicesToCards(nextIndices, combinedRef.current) }),
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    }
  };

  const handleSubmitCombo = async () => {
    if (!payload) return;
    setSubmitting(true); setError(null);
    try {
      const res = await api.post("/api/combo/submit", { body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      const { ok, data } = await normalizeResponse(res);
      if (ok && !navigatingRef.current) {
        navigatingRef.current = true;
        if (typeof window !== "undefined") localStorage.removeItem(INVITE_CODE_KEY);
        const score = (data as { score?: number })?.score;
        const handRank = (data as { hand_rank?: string })?.hand_rank ?? "";
        const params = new URLSearchParams();
        if (score != null) params.set("combo_score", String(score));
        if (handRank) params.set("hand_rank", handRank);
        router.push(params.toString() ? `/score?${params.toString()}` : "/score");
      } else {
        setError((data as { error?: string })?.error ?? "Failed to submit");
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveCombo = async () => {
    const code = inviteCode ?? (typeof window !== "undefined" ? localStorage.getItem(INVITE_CODE_KEY) : null);
    const leavePayload = stored?.playerId
      ? { player_id: stored.playerId, invite_code: code }
      : stored ? { event_code: stored.eventCode, device_session_token: stored.deviceToken, invite_code: code } : null;
    if (!leavePayload || !code) { setError("Missing invite code. Refresh and try again."); return; }
    setLeaving(true); setError(null);
    try {
      const res = await api.post("/api/combo/leave", { body: JSON.stringify(leavePayload), headers: { "Content-Type": "application/json" } });
      const { ok, status: leaveStatus, data } = await normalizeResponse(res);
      if (ok || leaveStatus === 404) {
        if (typeof window !== "undefined") localStorage.removeItem(INVITE_CODE_KEY);
        router.push("/home");
      } else {
        setError((data as { error?: string })?.error ?? "Failed to leave");
      }
    } catch {
      setError("Network error");
    } finally {
      setLeaving(false);
    }
  };

  // ── Guards ───────────────────────────────────────────────────

  if (typeof window !== "undefined" && (!stored || !inviteCode) && (!getStored() || !getInviteCode())) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 16, gap: 8 }}>
        <Head><title>Combo - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>No combo session. Create or join a combo first.</p>
        <Link href="/create-combo" style={{ color: C.primary, textDecoration: "underline" }}>Create combo</Link>
        <Link href="/join-combo" style={{ color: C.primary, textDecoration: "underline" }}>Join combo</Link>
      </div>
    );
  }

  if (!stored || !inviteCode || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <Head><title>Combo - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>Loading...</p>
      </div>
    );
  }

  const yourHand = isLeader ? leaderHand : inviteeHand;
  const partnerHand = isLeader ? inviteeHand : leaderHand;
  const combinedWithUser: CardWithUser[] = [
    ...yourHand.map((card, i) => { const { rank, suit } = parseCard(card); return { card, rank, suit, user: "You", idx: i }; }),
    ...partnerHand.map((card, i) => { const { rank, suit } = parseCard(card); return { card, rank, suit, user: "Partner", idx: yourHand.length + i }; }),
  ];
  combinedRef.current = combinedWithUser;
  const sortedCards = sortCards(combinedWithUser, sortBy);
  const canSelect = isLeader && state === "SELECTING";

  // ── Render ───────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>Combo - Cooperative Poker</title></Head>

      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: 540, margin: "0 auto", padding: "28px 20px 80px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Page title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>Combo</h1>
          <button
            type="button"
            onClick={() => {
              if (handScores && typeof window !== "undefined") localStorage.setItem(COMBO_HAND_SCORES_KEY, JSON.stringify(handScores));
              router.push("/combo-scoring");
            }}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, padding: 0, fontSize: 14, fontWeight: 500, textDecoration: "none" }}
          >
            Scoring rules
          </button>
        </div>

        {/* Main combo card */}
        <section style={CARD_STYLE}>

          {/* Selected count + view toggle row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Selected cards:</span>
              <span style={{
                fontSize: 13, fontWeight: 700,
                background: selectedIndices.length === 5 ? "#dcfce7" : C.divider,
                color: selectedIndices.length === 5 ? "#16a34a" : C.textMuted,
                borderRadius: 20, padding: "2px 10px",
                transition: "all 0.15s ease",
              }}>
                {selectedIndices.length} / 5
              </span>
            </div>

            {/* View toggle */}
            <div style={{ display: "flex", background: C.divider, borderRadius: 8, padding: 3, gap: 2 }}>
              {(["cards", "list"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: viewMode === mode ? "white" : "transparent",
                    color: viewMode === mode ? C.textMain : C.textMuted,
                    boxShadow: viewMode === mode ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {mode === "cards" ? "🂡 Cards" : "☰ List"}
                </button>
              ))}
            </div>
          </div>

          {/* Sort chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>Sort by</span>
            {(["rank", "suit", "user"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSortBy(s)}
                style={{
                  padding: "4px 12px", borderRadius: 20, border: `1px solid ${sortBy === s ? C.primary : C.border}`,
                  background: sortBy === s ? C.primary : "white",
                  color: sortBy === s ? "white" : C.textMuted,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease",
                }}
              >
                {s === "rank" ? "# Rank" : s === "suit" ? "♠ Suit" : "👤 Player"}
              </button>
            ))}
          </div>

          {/* Card grid */}
          {viewMode === "cards" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
              {sortedCards.map(({ card, user, idx }) => {
                const isSelected = selectedIndices.includes(idx);
                return (
                  <div key={idx} style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => canSelect && handleSelect(idx)}
                      style={{
                        width: "100%", aspectRatio: "2.5/3.5", padding: 0, background: "none",
                        border: `2px solid ${isSelected ? "#16a34a" : "transparent"}`,
                        borderRadius: 12, cursor: canSelect ? "pointer" : "default",
                        boxShadow: isSelected ? "0 0 0 3px rgba(22,163,74,0.2)" : "0 4px 10px rgba(15,23,42,0.1)",
                        display: "block", transition: "all 0.15s ease",
                      }}
                    >
                      <img src={cardImagePath(card)} alt={card} style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }} />
                    </button>
                    {/* Selected × badge */}
                    {isSelected && canSelect && (
                      <span style={{
                        position: "absolute", top: -4, right: -4,
                        width: 20, height: 20, borderRadius: "50%",
                        background: "#16a34a", color: "white",
                        fontSize: 11, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.2)", border: "2px solid white",
                        cursor: "pointer",
                      }}
                        onClick={(e) => { e.stopPropagation(); handleSelect(idx); }}
                      >
                        ×
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* List view */}
          {viewMode === "list" && (
            <div style={{ marginBottom: 18 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {["Rank", "Suit", "Player"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 12, fontWeight: 600, color: C.textMuted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCards.map(({ card, rank, suit, user, idx }) => {
                    const suitSymbols: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
                    const isSelected = selectedIndices.includes(idx);
                    return (
                      <tr
                        key={idx}
                        onClick={() => canSelect && handleSelect(idx)}
                        style={{
                          borderBottom: `1px solid ${C.divider}`,
                          background: isSelected ? "#f0fdf4" : "transparent",
                          cursor: canSelect ? "pointer" : "default",
                          transition: "background 0.1s ease",
                        }}
                      >
                        <td style={{ padding: "10px 10px", fontWeight: 500, color: C.textMain }}>{rank}</td>
                        <td style={{ padding: "10px 10px", color: suit === "H" || suit === "D" ? "#dc2626" : C.textMain, fontSize: 21 }}>{suitSymbols[suit] ?? suit}</td>
                        <td style={{ padding: "10px 10px", color: C.textMuted }}>{user}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Status messages */}
          {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
          {state === "SELECTING" && !isLeader && (
            <p style={{ fontSize: 13, color: C.textMuted, textAlign: "center", marginBottom: 12 }}>Waiting for leader to select and submit.</p>
          )}
          {state === "SUBMITTED" && (
            <p style={{ fontSize: 14, color: "#16a34a", fontWeight: 600, textAlign: "center", marginBottom: 12 }}>Combo submitted! Redirecting to score...</p>
          )}

          {/* Submit button */}
          {state === "SELECTING" && isLeader && (
            <button
              type="button"
              onClick={handleSubmitCombo}
              disabled={submitting || selectedIndices.length < 5}
              style={{
                width: "100%", height: 48, borderRadius: 12, border: "none", cursor: submitting || selectedIndices.length < 5 ? "not-allowed" : "pointer",
                background: selectedIndices.length === 5 ? "linear-gradient(135deg, #2563eb, #3b82f6)" : C.divider,
                color: selectedIndices.length === 5 ? "white" : C.textMuted,
                fontWeight: 600, fontSize: 16,
                boxShadow: selectedIndices.length === 5 ? "0 6px 14px rgba(37,99,235,0.35)" : "none",
                opacity: submitting ? 0.7 : 1,
                transition: "all 0.15s ease",
              }}
            >
              {submitting ? "Submitting..." : selectedIndices.length < 5 ? `Submit combo (${selectedIndices.length}/5)` : "Submit combo"}
            </button>
          )}

          {/* Leave combo link */}
          {state !== "SUBMITTED" && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(true)}
                disabled={leaving}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, fontWeight: 500, textDecoration: "underline", opacity: leaving ? 0.5 : 1, transition: "all 0.15s ease" }}
              >
                {leaving ? "Leaving..." : "Leave combo"}
              </button>
            </div>
          )}
        </section>

      </main>

      <BottomNav active="home" />

      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <Modal
          title="Are you sure?"
          body="You will leave this combo and return to the event home. The combo will be cancelled."
          actions={
            <>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                style={{ flex: 1, height: 40, borderRadius: 10, border: "none", background: C.divider, color: C.textMain, fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.15s ease" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowLeaveConfirm(false); handleLeaveCombo(); }}
                disabled={leaving}
                style={{ flex: 1, height: 40, borderRadius: 10, border: "none", background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white", fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.15s ease" }}
              >
                {leaving ? "Leaving..." : "Leave"}
              </button>
            </>
          }
        />
      )}

      {/* Partner left modal */}
      {showPartnerLeftModal && (
        <Modal
          title="Combo cancelled"
          body="Your partner left the combo. The combo has been cancelled."
          actions={
            <button
              type="button"
              onClick={() => { if (typeof window !== "undefined") localStorage.removeItem(INVITE_CODE_KEY); setShowPartnerLeftModal(false); router.push("/home"); }}
              style={{ flex: 1, height: 40, borderRadius: 10, border: "none", background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white", fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.15s ease" }}
            >
              OK
            </button>
          }
        />
      )}
    </div>
  );
}
