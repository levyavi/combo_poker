import Head from "next/head";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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

type InteractionItem = {
  id: string;
  state: string;
  submitted_at: string | null;
  is_leader: boolean;
  partner_display_name?: string;
  hand_rank_name?: string | null;
};

// ── Shared components ─────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────

export default function InteractionsPage() {
  const [stored, setStored] = useState<{ eventCode: string; deviceToken: string; playerId?: string } | null>(null);
  const [list, setList] = useState<InteractionItem[]>([]);
  const [roundState, setRoundState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!stored) return;
    setError(null);
    try {
      const query = new URLSearchParams(
        stored.playerId ? { player_id: stored.playerId } : { event_code: stored.eventCode, device_session_token: stored.deviceToken }
      );
      const res = await api.get(`/api/interactions?${query}`);
      const { ok, data } = await normalizeResponse(res);
      if (ok && data && typeof data === "object" && "interactions" in data) {
        const raw = (data as { interactions?: unknown[] }).interactions;
        const arr = Array.isArray(raw) ? raw : [];
        const normalized: InteractionItem[] = (arr as Record<string, unknown>[]).map((item) => ({
          id: String(item.id ?? ""),
          state: String(item.state ?? ""),
          submitted_at: item.submitted_at != null ? String(item.submitted_at) : null,
          is_leader: !!(item.is_leader ?? item.isLeader),
          partner_display_name: String(item.partner_display_name ?? item.partnerDisplayName ?? "Partner").trim() || "Partner",
          hand_rank_name: (item.hand_rank_name ?? item.handRankName) != null ? String(item.hand_rank_name ?? item.handRankName) : null,
        }));
        setList(normalized);
        const d = data as { round_state?: string; roundState?: string };
        setRoundState(d.round_state ?? d.roundState ?? null);
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
  }, [stored]);

  useEffect(() => { setStored(getStored()); }, []);

  useEffect(() => {
    if (stored) fetchList();
    else setLoading(false);
  }, [stored, fetchList]);

  // ── Guards ────────────────────────────────────────────────────

  if (typeof window !== "undefined" && !stored && getStored() === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 16 }}>
        <Head><title>Interactions - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>No event session.</p>
        <Link href="/" style={{ marginTop: 16, color: C.primary, textDecoration: "underline" }}>Enter event</Link>
      </div>
    );
  }

  if (!stored || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <Head><title>Interactions - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>Loading...</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  const sorted = [...list].sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>Interactions - Cooperative Poker</title></Head>

      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: 540, margin: "0 auto", padding: "28px 20px 80px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Page title */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>Interactions</h1>

        {roundState === "ENDED" && (
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>The round has ended. Your past interactions are shown below.</p>
        )}

        {/* List card */}
        <section style={CARD_STYLE}>
          {error && <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p>}

          {sorted.length === 0 ? (
            <p style={{ fontSize: 14, color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>
              No interactions yet. Create or join combos to see them here.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {sorted.map((item, i) => {
                const isLast = i === sorted.length - 1;
                return (
                  <li
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 0",
                      borderBottom: isLast ? "none" : `1px solid ${C.divider}`,
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: C.textMain, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.partner_display_name ?? "Partner"}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                        {item.hand_rank_name && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", background: "#f0fdf4", borderRadius: 6, padding: "1px 7px" }}>
                            {item.hand_rank_name}
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "—"}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/contact/${item.id}`}
                      style={{
                        fontSize: 13, fontWeight: 600, color: C.primary,
                        textDecoration: "none", whiteSpace: "nowrap",
                        padding: "6px 12px", borderRadius: 8,
                        background: "#eff6ff",
                      }}
                    >
                      View
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </main>

      <BottomNav active="interactions" />
    </div>
  );
}
