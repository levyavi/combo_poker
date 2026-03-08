import Head from "next/head";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "@appdeploy/client";

const EVENT_CODE_KEY = "attendee_event_code";
const DEVICE_TOKEN_KEY = "attendee_device_token";
const PLAYER_ID_KEY = "attendee_player_id";
const DISPLAY_NAME_KEY = "attendee_display_name";

const CDN = "https://cdn.jsdelivr.net/gh/levyavi/combo_poker@main/cooperative-poker/public";

// ── Design tokens ─────────────────────────────────────────────────
const C = {
  primary: "#2563eb",
  bg: "#f8fafc",
  card: "#ffffff",
  textMain: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
} as const;

// ── Helpers ───────────────────────────────────────────────────────

function getStored(): { eventCode: string; deviceToken: string; playerId: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const eventCode = localStorage.getItem(EVENT_CODE_KEY);
    const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);
    const playerId = localStorage.getItem(PLAYER_ID_KEY);
    if (eventCode && deviceToken && playerId) return { eventCode, deviceToken, playerId };
  } catch {}
  return null;
}

function setStored(eventCode: string, deviceToken: string, playerId: string, displayName?: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EVENT_CODE_KEY, eventCode);
    localStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
    localStorage.setItem(PLAYER_ID_KEY, playerId);
    if (displayName != null) localStorage.setItem(DISPLAY_NAME_KEY, displayName);
  } catch {}
}

async function normalizeResponse(res: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
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
    return { ok: (r.status ?? 200) >= 200 && (r.status ?? 200) < 300, status: r.status ?? 200, data: r.data };
  }
  return { ok: false, status: 0, data: res };
}

// ── Page ──────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [eventCode, setEventCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stored, setStoredState] = useState<{ eventCode: string; deviceToken: string; playerId: string } | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => { setStoredState(getStored()); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = eventCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 5 || code.length > 10) {
      setError("Event code must be 5–10 letters or numbers.");
      return;
    }
    setSubmitting(true);
    try {
      const enterRes = await api.post("/api/event/enter", { body: JSON.stringify({ event_code: code }) });
      const enter = await normalizeResponse(enterRes);
      if (!enter.ok || !enter.data || typeof enter.data !== "object") {
        setError(String((enter.data as { error?: string })?.error ?? "Event not found"));
        setSubmitting(false);
        return;
      }
      const body: { event_code: string; device_session_token?: string } = { event_code: code };
      if (stored?.eventCode === code && stored?.deviceToken) {
        body.device_session_token = stored.deviceToken;
      }
      const createRes = await api.post("/api/player/create_or_load", {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });
      const create = await normalizeResponse(createRes);
      if (!create.ok || !create.data || typeof create.data !== "object") {
        setError("Failed to join event");
        setSubmitting(false);
        return;
      }
      const d = create.data as { player_id?: string; device_session_token?: string; display_name?: string };
      const deviceToken = d.device_session_token ?? "";
      const playerId = d.player_id ?? "";
      if (!deviceToken || !playerId) {
        setError("Invalid response from server");
        setSubmitting(false);
        return;
      }
      setStored(code, deviceToken, playerId, d.display_name ?? "");
      setStoredState({ eventCode: code, deviceToken, playerId });
      if (create.status === 201) {
        router.push("/profile?new=1");
      } else {
        router.push("/home");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
      <Head><title>Cooperative Poker</title></Head>

      {/* Header */}
      <header style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", height: 56, padding: "0 20px", display: "flex", alignItems: "center", flexShrink: 0, zIndex: 2, position: "relative" }}>
        <span style={{ color: "white", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>Cooperative Poker</span>
      </header>

      {/* Hero */}
      <div style={{
        position: "relative",
        width: "100%",
        height: 220,
        flexShrink: 0,
        backgroundImage: `url(${CDN}/event-bg.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {/* Dark gradient overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.75) 100%)",
        }} />
        {/* Hero text */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 20px" }}>
          <h1 style={{ fontSize: 34, fontWeight: 800, color: "white", margin: "0 0 8px", letterSpacing: "-0.02em", textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
            Welcome
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.55 }}>
            Enter your event code to join the game
          </p>
        </div>
        {/* Bottom fade into page bg */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 48,
          background: `linear-gradient(to bottom, transparent, ${C.bg})`,
          zIndex: 1,
        }} />
      </div>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 20px 40px", marginTop: -24 }}>
        <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 20, position: "relative", zIndex: 1 }}>

          {/* Card */}
          <div style={{ background: C.card, borderRadius: 16, padding: 24, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.textMain }}>Event code</label>
                <input
                  type="text"
                  value={eventCode}
                  onChange={(e) => setEventCode(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="E.G. EVENT1"
                  maxLength={10}
                  style={{
                    height: 48,
                    borderRadius: 10,
                    border: `1px solid ${focused ? "#3b82f6" : C.border}`,
                    boxShadow: focused ? "0 0 0 3px rgba(59,130,246,0.15)" : "none",
                    padding: "0 14px",
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: C.textMain,
                    background: "white",
                    outline: "none",
                    width: "100%",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  }}
                />
              </div>

              {error && <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  height: 48, borderRadius: 12, border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: 15, fontWeight: 600, color: "white",
                  background: submitting ? "#93c5fd" : "linear-gradient(135deg, #2563eb, #3b82f6)",
                  boxShadow: submitting ? "none" : "0 6px 14px rgba(37,99,235,0.35)",
                  transition: "all 0.15s ease",
                }}
              >
                {submitting ? "Joining…" : "Enter event"}
              </button>
            </form>
          </div>

          {/* Footer links */}
          <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
            <Link href="/about" style={{ fontSize: 13, color: C.textMuted, textDecoration: "none" }}>About</Link>
            <Link href="/admin" style={{ fontSize: 13, color: C.textMuted, textDecoration: "none" }}>Admin</Link>
            {stored && (
              <>
                <Link href="/profile" style={{ fontSize: 13, color: C.textMuted, textDecoration: "none" }}>Profile</Link>
                <Link href="/home" style={{ fontSize: 13, color: C.primary, fontWeight: 600, textDecoration: "none" }}>Back to home</Link>
              </>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
