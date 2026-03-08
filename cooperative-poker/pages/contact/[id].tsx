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

type Contact = {
  player_id?: string;
  display_name?: string;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  workplace?: string | null;
  title?: string | null;
  interests?: string | null;
};

function normalizeContact(raw: unknown): Contact | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const get = (snake: string, camel: string) => (r[snake] ?? r[camel]) != null ? String(r[snake] ?? r[camel]).trim() : "";
  return {
    player_id: get("player_id", "playerId") || undefined,
    display_name: get("display_name", "displayName"),
    email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null,
    linkedin_url: (r.linkedin_url ?? r.linkedinUrl) as string ?? null,
    website_url: (r.website_url ?? r.websiteUrl) as string ?? null,
    workplace: (r.workplace as string) ?? null,
    title: (r.title as string) ?? null,
    interests: (r.interests as string) ?? null,
  };
}

// ── Shared components ─────────────────────────────────────────────

function Header() {
  return (
    <header style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", height: 56, padding: "0 20px", display: "flex", alignItems: "center", flexShrink: 0 }}>
      <span style={{ color: "white", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>Cooperative Poker</span>
    </header>
  );
}

// ── Contact fields renderer ───────────────────────────────────────

type ContactField = { label: string; value: string; href?: string };

function getContactFields(contact: Contact): ContactField[] {
  const fields: ContactField[] = [];
  const str = (v: unknown) => (v ?? "").toString().trim();
  if (str(contact.workplace)) fields.push({ label: "Workplace", value: str(contact.workplace) });
  if (str(contact.title))     fields.push({ label: "Title",     value: str(contact.title) });
  if (str(contact.interests)) fields.push({ label: "Interests", value: str(contact.interests) });
  if (str(contact.email))     fields.push({ label: "Email",     value: str(contact.email),     href: `mailto:${str(contact.email)}` });
  if (str(contact.phone))     fields.push({ label: "Phone",     value: str(contact.phone),     href: `tel:${str(contact.phone)}` });
  if (str(contact.linkedin_url)) fields.push({ label: "LinkedIn", value: "Profile", href: str(contact.linkedin_url) });
  if (str(contact.website_url))  fields.push({ label: "Website",  value: "Link",    href: str(contact.website_url) });
  return fields;
}

// ── Page ──────────────────────────────────────────────────────────

export default function ContactPage() {
  const router = useRouter();
  const id = router.query.id as string | undefined;
  const [stored, setStored] = useState<{ eventCode: string; deviceToken: string; playerId?: string } | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [scoreAwarded, setScoreAwarded] = useState<number | null>(null);
  const [handRankName, setHandRankName] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState<boolean | null>(null);
  const [leaderContact, setLeaderContact] = useState<Contact | null>(null);
  const [inviteeContact, setInviteeContact] = useState<Contact | null>(null);
  const [roundState, setRoundState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setStored(getStored()); }, []);

  useEffect(() => {
    if (!stored || !id) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams(
          stored.playerId ? { player_id: stored.playerId } : { event_code: stored.eventCode, device_session_token: stored.deviceToken }
        );
        const res = await api.get(`/api/interactions/${id}?${query}`);
        const { ok, data } = await normalizeResponse(res);
        if (!cancelled && ok && data && typeof data === "object") {
          const d = data as Record<string, unknown>;
          setState((d.state as string) ?? null);
          setSubmittedAt((d.submitted_at ?? d.submittedAt) != null ? String(d.submitted_at ?? d.submittedAt) : null);
          setScoreAwarded((d.score_awarded ?? d.scoreAwarded) != null ? Number(d.score_awarded ?? d.scoreAwarded) : null);
          setHandRankName((d.hand_rank_name ?? d.handRankName) != null ? String(d.hand_rank_name ?? d.handRankName) : null);
          setIsLeader((d.is_leader ?? d.isLeader) != null ? !!(d.is_leader ?? d.isLeader) : null);
          setLeaderContact(normalizeContact(d.leader_contact ?? d.leaderContact));
          setInviteeContact(normalizeContact(d.invitee_contact ?? d.inviteeContact));
          setRoundState((d.round_state ?? d.roundState) as string ?? null);
        } else if (!cancelled && data && typeof data === "object" && "error" in data) {
          setError((data as { error: string }).error);
        }
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [stored, id]);

  // ── Guards ────────────────────────────────────────────────────

  if (typeof window !== "undefined" && !stored && getStored() === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 16 }}>
        <Head><title>Contact - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>No event session.</p>
        <Link href="/" style={{ marginTop: 16, color: C.primary, textDecoration: "underline" }}>Enter event</Link>
      </div>
    );
  }

  if (!stored || !id || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <Head><title>Contact - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>Loading...</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  const showContact = state === "SUBMITTED" || roundState === "ENDED";
  const partnerContact = isLeader === true ? inviteeContact : isLeader === false ? leaderContact : null;
  const partnerName = (partnerContact?.display_name ?? "").toString().trim() || "Partner";
  const contactFields = partnerContact ? getContactFields(partnerContact) : [];

  async function handleShare() {
    const lines: string[] = [];
    if (partnerName && partnerName !== "Partner") lines.push(partnerName);
    for (const f of contactFields) {
      if (f.href && (f.href.startsWith("http") || f.href.startsWith("mailto:") || f.href.startsWith("tel:"))) {
        lines.push(`${f.label}: ${f.href.replace(/^mailto:|^tel:/, "")}`);
      } else {
        lines.push(`${f.label}: ${f.value}`);
      }
    }
    const text = lines.join("\n");
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: partnerName || "Contact", text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // share cancelled
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>Contact - Cooperative Poker</title></Head>

      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: 540, margin: "0 auto", padding: "28px 20px 40px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Page title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>Contact</h1>
          <Link href="/interactions" style={{ fontSize: 14, fontWeight: 500, color: C.primary, textDecoration: "none" }}>
            Interactions
          </Link>
        </div>

        {error && <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}

        {/* Partner contact card */}
        <section style={CARD_STYLE}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Partner</h2>
            {showContact && contactFields.length > 0 && (
              <button
                onClick={handleShare}
                title="Share contact"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 600,
                  color: copied ? "#16a34a" : C.primary,
                  background: copied ? "#f0fdf4" : "#eff6ff",
                  border: "none", borderRadius: 8, padding: "6px 12px",
                  cursor: "pointer", transition: "background 0.15s, color 0.15s",
                }}
              >
                {copied ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    Share
                  </>
                )}
              </button>
            )}
          </div>

          {showContact ? (
            <>
              <p style={{ fontSize: 17, fontWeight: 700, color: C.textMain, margin: "0 0 16px" }}>{partnerName}</p>
              {contactFields.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {contactFields.map((field) => (
                    <div key={field.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 13, color: C.textMuted, flexShrink: 0 }}>{field.label}</span>
                      {field.href ? (
                        <a
                          href={field.href}
                          target={field.href.startsWith("http") ? "_blank" : undefined}
                          rel={field.href.startsWith("http") ? "noopener noreferrer" : undefined}
                          style={{ fontSize: 14, fontWeight: 500, color: C.primary, textDecoration: "none", textAlign: "right", wordBreak: "break-all" }}
                        >
                          {field.value}
                        </a>
                      ) : (
                        <span style={{ fontSize: 14, fontWeight: 500, color: C.textMain, textAlign: "right", wordBreak: "break-word" }}>{field.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 14, color: "#94a3b8" }}>No contact details shared.</p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
              Partner details are visible after you submit the combo or when the round ends.
            </p>
          )}
        </section>

        {/* Combo summary card */}
        <section style={CARD_STYLE}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>Combo summary</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {handRankName && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: C.textMuted }}>Hand</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#16a34a", background: "#f0fdf4", borderRadius: 6, padding: "2px 10px" }}>{handRankName}</span>
              </div>
            )}
            {scoreAwarded != null && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: C.textMuted }}>Points awarded</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>{scoreAwarded} pts</span>
              </div>
            )}
            {isLeader !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: C.textMuted }}>Your role</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.textMain }}>{isLeader ? "Leader" : "Partner"}</span>
              </div>
            )}
            {submittedAt && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: C.textMuted }}>Submitted</span>
                <span style={{ fontSize: 14, color: C.textMain }}>{new Date(submittedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
