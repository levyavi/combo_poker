import Head from "next/head";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "@appdeploy/client";
import { QRCodeSVG } from "qrcode.react";

const EVENT_CODE_KEY = "attendee_event_code";
const DEVICE_TOKEN_KEY = "attendee_device_token";
const PLAYER_ID_KEY = "attendee_player_id";
const INVITE_CODE_KEY = "combo_invite_code";

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
    <header style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", height: 56, padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
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
            <span style={{ fontSize: 12, fontWeight: 500, color: isActive ? C.primary : "#64748b", transition: "all 0.15s ease" }}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Page ────────────────────────────────────────────────────────

export default function CreateComboPage() {
  const router = useRouter();
  const [stored, setStored] = useState<{ eventCode: string; deviceToken: string; playerId?: string } | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>("");

  useEffect(() => {
    setStored(getStored());
  }, []);

  useEffect(() => {
    if (inviteCode && typeof window !== "undefined") {
      setQrUrl(`${window.location.origin}/join-combo?code=${inviteCode}`);
    }
  }, [inviteCode]);

  useEffect(() => {
    if (!stored) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        // If we have a stored code (e.g. after a refresh), verify it's still PENDING before reusing
        const existingCode = typeof window !== "undefined" ? localStorage.getItem(INVITE_CODE_KEY) : null;
        if (existingCode) {
          const query = new URLSearchParams({
            invite_code: existingCode,
            ...(stored.playerId ? { player_id: stored.playerId } : { event_code: stored.eventCode, device_session_token: stored.deviceToken }),
          });
          const stateRes = await api.get(`/api/combo/state?${query}`);
          const { ok, data } = await normalizeResponse(stateRes);
          const state = ok && data && typeof data === "object" ? (data as { state?: string }).state ?? "" : "";
          if (cancelled) return;
          if (state === "PENDING") {
            setInviteCode(existingCode);
            setLoading(false);
            return;
          }
          if (state === "SELECTING") {
            router.push("/icebreak");
            return;
          }
          // Stale/cancelled/submitted — clear and fall through to create a new one
          localStorage.removeItem(INVITE_CODE_KEY);
        }

        const res = await api.post("/api/combo/create_invite", {
          body: JSON.stringify(
            stored.playerId
              ? { player_id: stored.playerId }
              : { event_code: stored.eventCode, device_session_token: stored.deviceToken }
          ),
          headers: { "Content-Type": "application/json" },
        });
        const { ok, data } = await normalizeResponse(res);
        if (cancelled) return;
        if (ok && data && typeof data === "object" && "invite_code" in data) {
          const code = (data as { invite_code: string }).invite_code;
          setInviteCode(code);
          if (typeof window !== "undefined") localStorage.setItem(INVITE_CODE_KEY, code);
        } else {
          const errMsg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "";
          if (errMsg === "Already in a combo") {
            // Recover: find the stale active combo on the server
            const query = new URLSearchParams(
              stored.playerId ? { player_id: stored.playerId } : { event_code: stored.eventCode, device_session_token: stored.deviceToken }
            );
            const mineRes = await api.get(`/api/combo/mine?${query}`);
            const mine = await normalizeResponse(mineRes);
            if (cancelled) return;
            if (mine.ok && mine.data && typeof mine.data === "object") {
              const m = mine.data as { found?: boolean; invite_code?: string; state?: string };
              if (m.found && m.invite_code) {
                if (m.state === "SELECTING") { router.push("/icebreak"); return; }
                if (m.state === "PENDING") {
                  setInviteCode(m.invite_code);
                  if (typeof window !== "undefined") localStorage.setItem(INVITE_CODE_KEY, m.invite_code);
                  setLoading(false);
                  return;
                }
              }
            }
          }
          if (typeof window !== "undefined") localStorage.removeItem(INVITE_CODE_KEY);
          setError(errMsg || "Failed to create invite");
        }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Network error";
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [stored]);

  useEffect(() => {
    if (!inviteCode || !stored) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const query = new URLSearchParams({
          invite_code: inviteCode,
          ...(stored.playerId ? { player_id: stored.playerId } : { event_code: stored.eventCode, device_session_token: stored.deviceToken }),
        });
        const res = await api.get(`/api/combo/state?${query}`);
        const { ok, data } = await normalizeResponse(res);
        if (cancelled || !ok || !data || typeof data !== "object") return;
        const state = (data as { state?: string }).state ?? "";
        if (state === "SELECTING") {
          router.push("/icebreak");
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(poll, 2000);
    poll();
    return () => { cancelled = true; clearInterval(interval); };
  }, [inviteCode, stored, router]);

  const handleCancelCombo = async () => {
    if (!stored || !inviteCode) {
      if (typeof window !== "undefined") localStorage.removeItem(INVITE_CODE_KEY);
      router.push("/home");
      return;
    }
    setCancelling(true);
    try {
      await api.post("/api/combo/leave", {
        body: JSON.stringify({
          invite_code: inviteCode,
          ...(stored.playerId ? { player_id: stored.playerId } : { event_code: stored.eventCode, device_session_token: stored.deviceToken }),
        }),
        headers: { "Content-Type": "application/json" },
      });
    } catch { /* continue to home even if leave fails */ }
    finally {
      if (typeof window !== "undefined") localStorage.removeItem(INVITE_CODE_KEY);
      setCancelling(false);
      router.push("/home");
    }
  };

  // ── Guards ───────────────────────────────────────────────────

  if (typeof window !== "undefined" && !stored && getStored() === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 16 }}>
        <Head><title>Create combo - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>No event session. Please enter an event first.</p>
        <Link href="/" style={{ marginTop: 16, color: C.primary, textDecoration: "underline" }}>Enter event</Link>
      </div>
    );
  }

  if (!stored) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <Head><title>Create combo - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>Loading...</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>Create combo - Cooperative Poker</title></Head>

      <Header />

      <main style={{ flex: 1, width: "100%", maxWidth: 540, margin: "0 auto", padding: "28px 20px 80px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Page title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>Create combo</h1>
          <button
            type="button"
            onClick={handleCancelCombo}
            disabled={cancelling}
            style={{ background: "none", border: "none", cursor: cancelling ? "not-allowed" : "pointer", color: C.primary, fontSize: 14, fontWeight: 500, opacity: cancelling ? 0.5 : 1, transition: "all 0.15s ease", padding: 0 }}
          >
            {cancelling ? "Cancelling..." : "Cancel combo"}
          </button>
        </div>

        {/* Main invite card */}
        <section style={CARD_STYLE}>
          {loading && !inviteCode ? (
            <p style={{ color: C.textMuted, textAlign: "center", margin: 0 }}>Creating invite code...</p>
          ) : error ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ color: "#dc2626", fontSize: 14, margin: 0 }}>{error}</p>
              <Link
                href="/home"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 12, background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white", fontWeight: 600, fontSize: 15, textDecoration: "none" }}
              >
                Back to event home
              </Link>
            </div>
          ) : inviteCode ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              {/* Label */}
              <p style={{ fontSize: 14, fontWeight: 500, color: C.textMuted, margin: 0 }}>Share with your partner</p>

              {/* Code */}
              <p style={{ fontSize: 40, fontWeight: 700, color: "#16a34a", letterSpacing: "0.2em", fontFamily: "monospace", margin: 0 }}>
                {inviteCode}
              </p>

              {/* QR code */}
              {qrUrl && (
                <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: "inline-flex" }}>
                  <QRCodeSVG value={qrUrl} size={180} />
                </div>
              )}

              {/* Instructions */}
              <p style={{ fontSize: 13, color: C.textMuted, textAlign: "center", margin: 0 }}>
                Your partner can type the code or scan the QR code.
              </p>

              {/* Waiting status */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 6px #22c55e" }} />
                <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Waiting for your partner to join...</p>
              </div>
            </div>
          ) : null}
        </section>

        {/* How joining works card */}
        {inviteCode && (
          <section style={CARD_STYLE}>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.textMain, margin: "0 0 16px 0" }}>How joining works</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                "Your partner enters the code",
                "Or scans the QR code",
                "The combo starts automatically",
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                    color: "white",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 14, color: C.textMuted }}>{step}</span>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      <BottomNav active="home" />
    </div>
  );
}
