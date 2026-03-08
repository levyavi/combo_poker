import Head from "next/head";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "@appdeploy/client";

const EVENT_CODE_KEY = "attendee_event_code";
const DEVICE_TOKEN_KEY = "attendee_device_token";
const PLAYER_ID_KEY = "attendee_player_id";
const INVITE_CODE_KEY = "combo_invite_code";

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
      position: "fixed", bottom: 0, left: 0, right: 0,
      height: 64, background: "white",
      borderTop: `1px solid ${C.border}`,
      boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
      paddingBottom: 6,
      display: "flex", justifyContent: "space-around", alignItems: "center",
      zIndex: 10,
    }}>
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

export default function IcebreakPage() {
  const router = useRouter();
  const [stored, setStored] = useState<{ eventCode: string; deviceToken: string; playerId?: string } | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<Record<string, string>>({});
  const [waitingForPartner, setWaitingForPartner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStored(getStored());
    setInviteCode(getInviteCode() ?? (router.query.invite_code as string) ?? null);
  }, [router.query.invite_code]);

  const fetchQuestion = useCallback(async () => {
    if (!stored || !inviteCode) return;
    setError(null);
    try {
      const query = new URLSearchParams({
        invite_code: inviteCode,
        ...(stored.playerId ? { player_id: stored.playerId } : { event_code: stored.eventCode, device_session_token: stored.deviceToken }),
      });
      const res = await api.get(`/api/icebreak/question?${query}`);
      const { ok, data } = await normalizeResponse(res);
      if (ok && data && typeof data === "object" && "question" in data) {
        const d = data as {
          question: string;
          waiting_for_partner?: boolean;
          waitingForPartner?: boolean;
          partner_profile?: Record<string, string>;
          partnerProfile?: Record<string, string>;
        };
        setQuestion(d.question);
        setWaitingForPartner(!!(d.waiting_for_partner ?? d.waitingForPartner));
        const raw = d.partner_profile ?? d.partnerProfile ?? (d as Record<string, unknown>).partner_profile;
        const profile: Record<string, unknown> =
          raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
        const normalized: Record<string, string> = {};
        const get = (obj: Record<string, unknown>, ...keys: string[]) => {
          for (const k of keys) {
            const v = obj[k];
            if (v != null && String(v).trim() !== "") return String(v).trim();
          }
          return "";
        };
        const nameVal = get(profile, "display_name", "displayName", "DisplayName");
        if (nameVal && nameVal !== "Partner") normalized.display_name = nameVal;
        if (get(profile, "workplace", "Workplace")) normalized.workplace = get(profile, "workplace", "Workplace");
        if (get(profile, "title", "Title")) normalized.title = get(profile, "title", "Title");
        if (get(profile, "interests", "Interests")) normalized.interests = get(profile, "interests", "Interests");
        if (get(profile, "email", "Email")) normalized.email = get(profile, "email", "Email");
        if (get(profile, "phone", "Phone")) normalized.phone = get(profile, "phone", "Phone");
        if (get(profile, "linkedin_url", "linkedinUrl")) normalized.linkedin_url = get(profile, "linkedin_url", "linkedinUrl");
        if (get(profile, "website_url", "websiteUrl")) normalized.website_url = get(profile, "website_url", "websiteUrl");
        setPartnerProfile(normalized);
      } else if (data && typeof data === "object" && "error" in data) {
        setError((data as { error: string }).error);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [stored, inviteCode]);

  useEffect(() => {
    if (!stored || !inviteCode) { setLoading(false); return; }
    setLoading(true);
    fetchQuestion();
  }, [stored, inviteCode, fetchQuestion]);

  useEffect(() => {
    if (!waitingForPartner || !stored || !inviteCode) return;
    const interval = setInterval(fetchQuestion, 2000);
    return () => clearInterval(interval);
  }, [waitingForPartner, stored, inviteCode, fetchQuestion]);

  // ── Guards ───────────────────────────────────────────────────

  if (typeof window !== "undefined" && (!stored || !inviteCode) && (!getStored() || !getInviteCode()) && !router.query.invite_code) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 16, gap: 8 }}>
        <Head><title>Break the ice - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>No combo session. Create or join a combo first.</p>
        <Link href="/create-combo" style={{ color: C.primary, textDecoration: "underline" }}>Create combo</Link>
        <Link href="/join-combo" style={{ color: C.primary, textDecoration: "underline" }}>Join combo</Link>
      </div>
    );
  }

  if (!stored || !inviteCode || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <Head><title>Break the ice - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>Loading...</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────

  const hasPartner = !waitingForPartner;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>Break the ice - Cooperative Poker</title></Head>

      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: 540, margin: "0 auto", padding: "28px 20px 80px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Page title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>Break the ice</h1>
          <Link href="/home" style={{ fontSize: 14, fontWeight: 500, color: C.primary, textDecoration: "none", transition: "all 0.15s ease" }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            Home
          </Link>
        </div>

        {/* Main card */}
        <section style={CARD_STYLE}>
          {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 16 }}>{error}</p>}

          {/* Icebreaker question */}
          {question && (
            <div style={{ marginBottom: hasPartner ? 20 : 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px 0" }}>
                Conversation starter
              </p>
              <p style={{ fontSize: 16, color: C.textMain, fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>
                &ldquo;{question}&rdquo;
              </p>
              {waitingForPartner && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 6px #22c55e" }} />
                  <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Waiting for your partner to join...</p>
                </div>
              )}
            </div>
          )}

          {/* Partner section */}
          {hasPartner && (
            <>
              <div style={{ borderTop: `1px solid ${C.divider}`, margin: "0 0 20px 0" }} />

              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px 0" }}>
                Your partner
              </p>

              {Object.keys(partnerProfile).length > 0 ? (
                <>
                  {partnerProfile.display_name && (
                    <p style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: "0 0 12px 0", letterSpacing: "-0.01em" }}>
                      {partnerProfile.display_name}
                    </p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {partnerProfile.workplace && (
                      <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
                        <span style={{ color: "#94a3b8" }}>Workplace: </span>
                        <span style={{ color: C.textMain, fontWeight: 500 }}>{partnerProfile.workplace}</span>
                      </p>
                    )}
                    {partnerProfile.title && (
                      <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
                        <span style={{ color: "#94a3b8" }}>Title: </span>
                        <span style={{ color: C.textMain, fontWeight: 500 }}>{partnerProfile.title}</span>
                      </p>
                    )}
                    {partnerProfile.interests && (
                      <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
                        <span style={{ color: "#94a3b8" }}>Interests: </span>
                        <span style={{ color: C.textMain, fontWeight: 500 }}>{partnerProfile.interests}</span>
                      </p>
                    )}
                    {partnerProfile.email && (
                      <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
                        <span style={{ color: "#94a3b8" }}>Email: </span>
                        <a href={`mailto:${partnerProfile.email}`} style={{ color: C.primary, fontWeight: 500, textDecoration: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >{partnerProfile.email}</a>
                      </p>
                    )}
                    {partnerProfile.phone && (
                      <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
                        <span style={{ color: "#94a3b8" }}>Phone: </span>
                        <a href={`tel:${partnerProfile.phone}`} style={{ color: C.primary, fontWeight: 500, textDecoration: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >{partnerProfile.phone}</a>
                      </p>
                    )}
                    {partnerProfile.linkedin_url && (
                      <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
                        <span style={{ color: "#94a3b8" }}>LinkedIn: </span>
                        <a href={partnerProfile.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: C.primary, fontWeight: 500, textDecoration: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >Profile</a>
                      </p>
                    )}
                    {partnerProfile.website_url && (
                      <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
                        <span style={{ color: "#94a3b8" }}>Website: </span>
                        <a href={partnerProfile.website_url} target="_blank" rel="noopener noreferrer" style={{ color: C.primary, fontWeight: 500, textDecoration: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >Link</a>
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>No profile details shared yet.</p>
              )}
            </>
          )}

          {/* Continue button */}
          {hasPartner && (
            <>
              <div style={{ borderTop: `1px solid ${C.divider}`, margin: "20px 0 0 0" }} />
              <Link
                href="/combo"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 20,
                  height: 48,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: 16,
                  textDecoration: "none",
                  boxShadow: "0 6px 14px rgba(37,99,235,0.35)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, #1d4ed8, #2563eb)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, #2563eb, #3b82f6)"; }}
              >
                Continue to combo
              </Link>
            </>
          )}
        </section>

      </main>

      <BottomNav active="home" />
    </div>
  );
}
