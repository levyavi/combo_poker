import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "@appdeploy/client";

const EVENT_CODE_KEY = "attendee_event_code";
const DEVICE_TOKEN_KEY = "attendee_device_token";
const PLAYER_ID_KEY = "attendee_player_id";
const PROFILE_DISPLAY_NAME_KEY = "attendee_profile_display_name";
const PROFILE_WORKPLACE_KEY = "attendee_profile_workplace";
const PROFILE_TITLE_KEY = "attendee_profile_title";
const PROFILE_INTERESTS_KEY = "attendee_profile_interests";
const PROFILE_EMAIL_KEY = "attendee_profile_email";
const PROFILE_PHONE_KEY = "attendee_profile_phone";
const PROFILE_WEBSITE_URL_KEY = "attendee_profile_website_url";

// ── Design tokens ────────────────────────────────────────────────
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

async function normalizeResponse(res: unknown): Promise<{ ok: boolean; data: unknown }> {
  if (res && typeof (res as Response).text === "function") {
    const r = res as Response;
    let data: unknown = null;
    try {
      const text = await r.text();
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: r.ok, data };
  }
  if (res && typeof res === "object" && "data" in res) {
    const r = res as { data?: unknown; status?: number };
    return { ok: (r.status ?? 200) >= 200 && (r.status ?? 200) < 300, data: r.data };
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

// ── Field component ───────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: C.textMain }}>
        {label}{required && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  height: 44,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  padding: "0 12px",
  fontSize: 14,
  color: C.textMain,
  background: "white",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

// ── Modal ─────────────────────────────────────────────────────────

function Modal({ title, body, confirmLabel, confirmDanger, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; confirmDanger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.45)" }} aria-modal="true" role="dialog">
      <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 320, width: "100%", boxShadow: "0 20px 48px rgba(0,0,0,0.2)" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: C.textMain, margin: "0 0 8px" }}>{title}</p>
        <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 20px", lineHeight: 1.55 }}>{body}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, height: 42, borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: C.divider, color: C.textMain }}>
            Stay
          </button>
          <button type="button" onClick={onConfirm} style={{ flex: 1, height: 42, borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: confirmDanger ? "#dc2626" : "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const isNew = router.query.new === "1";
  const [stored, setStored] = useState<{ eventCode: string; deviceToken: string; playerId?: string } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [title, setTitle] = useState("");
  const [interests, setInterests] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const userHasEditedRef = useRef(false);

  // Load any locally cached profile (from a previous successful save)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedDisplay = localStorage.getItem(PROFILE_DISPLAY_NAME_KEY);
      const savedWorkplace = localStorage.getItem(PROFILE_WORKPLACE_KEY);
      const savedTitle = localStorage.getItem(PROFILE_TITLE_KEY);
      const savedInterests = localStorage.getItem(PROFILE_INTERESTS_KEY);
      const savedEmail = localStorage.getItem(PROFILE_EMAIL_KEY);
      const savedPhone = localStorage.getItem(PROFILE_PHONE_KEY);
      const savedWebsiteUrl = localStorage.getItem(PROFILE_WEBSITE_URL_KEY);
      if (savedDisplay != null || savedWorkplace != null || savedTitle != null || savedInterests != null || savedEmail != null || savedPhone != null || savedWebsiteUrl != null) {
        setDisplayName(savedDisplay ?? "");
        setWorkplace(savedWorkplace ?? "");
        setTitle(savedTitle ?? "");
        setInterests(savedInterests ?? "");
        setEmail(savedEmail ?? "");
        setPhone(savedPhone ?? "");
        setWebsiteUrl(savedWebsiteUrl ?? "");
      }
    } catch {}
  }, []);

  useEffect(() => {
    setStored(getStored());
  }, []);

  const storedEventCode = stored?.eventCode ?? "";
  const storedDeviceToken = stored?.deviceToken ?? "";
  const loadTriggeredRef = useRef(false);

  useEffect(() => {
    if (!storedEventCode || !storedDeviceToken || loadTriggeredRef.current) return;
    if (typeof window !== "undefined") {
      const hasLocalProfile =
        localStorage.getItem(PROFILE_DISPLAY_NAME_KEY) ||
        localStorage.getItem(PROFILE_WORKPLACE_KEY) ||
        localStorage.getItem(PROFILE_TITLE_KEY) ||
        localStorage.getItem(PROFILE_INTERESTS_KEY) ||
        localStorage.getItem(PROFILE_EMAIL_KEY) ||
        localStorage.getItem(PROFILE_PHONE_KEY) ||
        localStorage.getItem(PROFILE_WEBSITE_URL_KEY);
      if (hasLocalProfile) return;
    }
    loadTriggeredRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const pidForLoad = typeof window !== "undefined" ? localStorage.getItem(PLAYER_ID_KEY) : null;
        const res = await api.post("/api/player/create_or_load", {
          body: JSON.stringify({
            player_id: pidForLoad ?? undefined,
            event_code: storedEventCode,
            device_session_token: storedDeviceToken,
          }),
          headers: { "Content-Type": "application/json" },
        });
        const { ok, data } = await normalizeResponse(res);
        if (cancelled || !ok || !data || typeof data !== "object") return;
        if (userHasEditedRef.current) return;
        const p = data as Record<string, unknown>;
        const displayNameVal = (p.display_name ?? p.displayName ?? "").toString();
        const workplaceVal = (p.workplace ?? "").toString();
        const titleVal = (p.title ?? "").toString();
        const interestsVal = (p.interests ?? "").toString();
        const emailVal = (p.email ?? "").toString();
        const phoneVal = (p.phone ?? "").toString();
        const websiteUrlVal = (p.website_url ?? p.websiteUrl ?? "").toString();
        const pid = p.player_id ?? p.playerId;
        if (pid && typeof window !== "undefined" && !pidForLoad) {
          try { localStorage.setItem(PLAYER_ID_KEY, String(pid)); } catch {}
        }
        setDisplayName(displayNameVal);
        setWorkplace(workplaceVal);
        setTitle(titleVal);
        setInterests(interestsVal);
        setEmail(emailVal);
        setPhone(phoneVal);
        setWebsiteUrl(websiteUrlVal);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [storedEventCode, storedDeviceToken]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stored) return;
    setError(null);
    setSubmitting(true);
    try {
      const playerId = typeof window !== "undefined" ? localStorage.getItem(PLAYER_ID_KEY) : null;
      const payload = playerId
        ? { player_id: playerId, display_name: displayName.trim() || "Player", workplace: workplace.trim() || null, title: title.trim() || null, interests: interests.trim() || null, email: email.trim() || null, phone: phone.trim() || null, website_url: websiteUrl.trim() || null }
        : { event_code: stored.eventCode, device_session_token: stored.deviceToken, display_name: displayName.trim() || "Player", workplace: workplace.trim() || null, title: title.trim() || null, interests: interests.trim() || null, email: email.trim() || null, phone: phone.trim() || null, website_url: websiteUrl.trim() || null };
      const res = await api.put("/api/player/profile", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      const { ok } = await normalizeResponse(res);
      if (ok) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(PROFILE_DISPLAY_NAME_KEY, displayName.trim() || "Player");
            localStorage.setItem(PROFILE_WORKPLACE_KEY, workplace.trim());
            localStorage.setItem(PROFILE_TITLE_KEY, title.trim());
            localStorage.setItem(PROFILE_INTERESTS_KEY, interests.trim());
            localStorage.setItem(PROFILE_EMAIL_KEY, email.trim());
            localStorage.setItem(PROFILE_PHONE_KEY, phone.trim());
            localStorage.setItem(PROFILE_WEBSITE_URL_KEY, websiteUrl.trim());
          } catch {}
        }
        router.push("/home");
      } else {
        setError("Failed to save profile");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    ...INPUT_STYLE,
    borderColor: focusedField === field ? "#3b82f6" : C.border,
    boxShadow: focusedField === field ? "0 0 0 3px rgba(59,130,246,0.15)" : "none",
  });

  const onEdit = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    userHasEditedRef.current = true;
    setter(e.target.value);
  };

  // ── Guards ───────────────────────────────────────────────────

  if (typeof window !== "undefined" && !stored && getStored() === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 16 }}>
        <Head><title>Profile - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>No event session.</p>
        <Link href="/" style={{ marginTop: 16, color: C.primary, textDecoration: "underline" }}>Enter event</Link>
      </div>
    );
  }

  if (!stored) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <Head><title>Profile - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>Loading...</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>Profile - Cooperative Poker</title></Head>

      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: 540, margin: "0 auto", padding: `28px 20px ${isNew ? "40px" : "80px"}`, display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Page title */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>
          {isNew ? "Set up your profile" : "Profile"}
        </h1>

        {/* Info note */}
        <p style={{ fontSize: 14, color: C.textMuted, margin: 0, lineHeight: 1.55 }}>
          {isNew
            ? "Enter your name to get started. All fields you fill in may be shared with participants you interact with."
            : "All fields you fill in may be shared with participants you interact with."}
        </p>

        {/* Form card */}
        <section style={CARD_STYLE}>
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            <Field label="Display name" required>
              <input
                type="text"
                value={displayName}
                onChange={onEdit(setDisplayName)}
                onFocus={() => setFocusedField("displayName")}
                onBlur={() => setFocusedField(null)}
                style={inputStyle("displayName")}
                placeholder="Your name"
              />
            </Field>

            <Field label="Workplace / Company">
              <input
                type="text"
                value={workplace}
                onChange={onEdit(setWorkplace)}
                onFocus={() => setFocusedField("workplace")}
                onBlur={() => setFocusedField(null)}
                style={inputStyle("workplace")}
                placeholder="Optional"
              />
            </Field>

            <Field label="Title">
              <input
                type="text"
                value={title}
                onChange={onEdit(setTitle)}
                onFocus={() => setFocusedField("title")}
                onBlur={() => setFocusedField(null)}
                style={inputStyle("title")}
                placeholder="Optional"
              />
            </Field>

            <Field label="Interests">
              <input
                type="text"
                value={interests}
                onChange={onEdit(setInterests)}
                onFocus={() => setFocusedField("interests")}
                onBlur={() => setFocusedField(null)}
                style={inputStyle("interests")}
                placeholder="Optional"
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={onEdit(setEmail)}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                style={inputStyle("email")}
                placeholder="Optional"
              />
            </Field>

            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={onEdit(setPhone)}
                onFocus={() => setFocusedField("phone")}
                onBlur={() => setFocusedField(null)}
                style={inputStyle("phone")}
                placeholder="Optional"
              />
            </Field>

            <Field label="Website URL">
              <input
                type="url"
                value={websiteUrl}
                onChange={onEdit(setWebsiteUrl)}
                onFocus={() => setFocusedField("websiteUrl")}
                onBlur={() => setFocusedField(null)}
                style={inputStyle("websiteUrl")}
                placeholder="Optional"
              />
            </Field>

            {error && <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}

            {isNew && !displayName.trim() && (
              <p style={{ fontSize: 13, color: "#d97706", margin: 0 }}>Please enter your display name to continue.</p>
            )}

            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button
                type="submit"
                disabled={submitting || (isNew && !displayName.trim())}
                style={{
                  flex: 1, height: 48, borderRadius: 12, border: "none",
                  cursor: (submitting || (isNew && !displayName.trim())) ? "not-allowed" : "pointer",
                  fontSize: 15, fontWeight: 600, color: "white",
                  background: (submitting || (isNew && !displayName.trim())) ? "#93c5fd" : "linear-gradient(135deg, #2563eb, #3b82f6)",
                  boxShadow: (submitting || (isNew && !displayName.trim())) ? "none" : "0 6px 14px rgba(37,99,235,0.35)",
                  transition: "all 0.15s ease",
                }}
              >
                {submitting ? "Saving…" : isNew ? "Save & continue" : "Save"}
              </button>
              {!isNew && (
                <button
                  type="button"
                  onClick={() => {
                    if (userHasEditedRef.current) setShowCancelConfirm(true);
                    else router.push("/home");
                  }}
                  style={{ flex: 1, height: 48, borderRadius: 12, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 600, background: C.divider, color: C.textMain }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

      </main>

      {!isNew && <BottomNav active="profile" />}

      {showCancelConfirm && (
        <Modal
          title="Discard changes?"
          body="You have unsaved changes. Are you sure you want to leave? Your changes will be lost."
          confirmLabel="Leave"
          onConfirm={() => { setShowCancelConfirm(false); router.push("/home"); }}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}
    </div>
  );
}
