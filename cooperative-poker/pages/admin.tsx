import Head from "next/head";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@appdeploy/client";

const ADMIN_SESSION_STORAGE_KEY = "admin_session_token";

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

const INPUT_STYLE: React.CSSProperties = {
  height: 42,
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

const TEXTAREA_STYLE: React.CSSProperties = {
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  padding: "10px 12px",
  fontSize: 13,
  color: C.textMain,
  background: "white",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
  lineHeight: 1.55,
};

// ── Helpers ───────────────────────────────────────────────────────

function getAdminSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY); } catch { return null; }
}

function setAdminSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, token); } catch {}
}

function authHeaders(): { headers?: Record<string, string> } {
  const token = getAdminSessionToken();
  if (!token) return {};
  return { headers: { "X-Admin-Session": token } };
}

function withSessionToken(url: string): string {
  const token = getAdminSessionToken();
  if (!token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}session_token=${encodeURIComponent(token)}`;
}

async function normalizeResponse(res: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
  if (res && typeof (res as Response).json === "function") {
    const r = res as Response;
    let data: unknown = null;
    try { const text = await r.text(); data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { ok: r.ok, status: r.status, data };
  }
  if (res && typeof res === "object" && "data" in res) {
    const r = res as { data?: unknown; status?: number; statusCode?: number };
    const status = r.status ?? r.statusCode ?? 200;
    return { ok: status >= 200 && status < 300, status, data: r.data };
  }
  if (res && typeof res === "object" && "status" in res) {
    const r = res as { status: number; data?: unknown };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, data: (r as { data?: unknown }).data ?? res };
  }
  if (res && typeof res === "object" && res !== null && !("json" in res)) {
    return { ok: true, status: 200, data: res };
  }
  return { ok: false, status: 0, data: res };
}

// ── Types ─────────────────────────────────────────────────────────

type EventInfo = {
  event_id: string;
  event_code: string;
  event_title?: string | null;
  round_state: string;
  round_started_at?: string | null;
  round_ended_at?: string | null;
  openai_api_key?: string | null;
  combo_pair_cooldown_minutes?: number;
  hand_scores?: Record<string, number> | string | null;
  llm_instructions?: string | null;
  event_description?: string | null;
};

type EventListItem = { event_id: string; event_code: string; event_title?: string; round_state: string };

const HAND_NAMES = [
  "High card", "One pair", "Two pair", "Three of a kind",
  "Straight", "Flush", "Full house", "Four of a kind", "Straight flush",
];

const DEFAULT_HAND_SCORES: Record<string, number> = {
  "High card": 1, "One pair": 2, "Two pair": 4, "Three of a kind": 8,
  Straight: 16, Flush: 32, "Full house": 64, "Four of a kind": 128, "Straight flush": 256,
};

const DEFAULT_LLM_INSTRUCTIONS = `Generate short, friendly questions, that help two people at a networking event discover common interests. The question should attempt to relate to the person asking and the person being asked.

Information about the person asking: {{asking}}
Information about the person being asked: {{asked}}`;

type View = "loading" | "gate" | "list" | "edit" | "error";

// ── Shared components ─────────────────────────────────────────────

function Header({ title }: { title: string }) {
  return (
    <header style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", height: 56, padding: "0 20px", display: "flex", alignItems: "center", flexShrink: 0 }}>
      <span style={{ color: "white", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>{title}</span>
    </header>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: C.textMain }}>{label}</label>
      {children}
    </div>
  );
}

function PrimaryButton({ children, disabled, type = "button", onClick, style }: {
  children: React.ReactNode; disabled?: boolean; type?: "button" | "submit";
  onClick?: () => void; style?: React.CSSProperties;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 44, borderRadius: 10, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 14, fontWeight: 600, color: "white",
        background: disabled ? "#93c5fd" : "linear-gradient(135deg, #2563eb, #3b82f6)",
        boxShadow: disabled ? "none" : "0 4px 10px rgba(37,99,235,0.3)",
        transition: "all 0.15s ease",
        width: "100%",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Modal({ title, body, confirmLabel, onConfirm, onCancel, submitting }: {
  title: string; body: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; submitting?: boolean;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.45)" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 320, width: "100%", boxShadow: "0 20px 48px rgba(0,0,0,0.2)" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: C.textMain, margin: "0 0 8px" }}>{title}</p>
        <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 20px", lineHeight: 1.55 }}>{body}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, height: 42, borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: C.divider, color: C.textMain }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={submitting} style={{ flex: 1, height: 42, borderRadius: 10, border: "none", cursor: submitting ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, background: "#dc2626", color: "white", opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── State badge ───────────────────────────────────────────────────

function StateBadge({ state }: { state: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    ACTIVE:      { bg: "#dcfce7", color: "#166534" },
    NOT_STARTED: { bg: "#f1f5f9", color: "#475569" },
    ENDED:       { bg: "#fef3c7", color: "#92400e" },
  };
  const style = colors[state] ?? { bg: C.divider, color: C.textMuted };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px", ...style }}>
      {state.replace("_", " ")}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [view, setView] = useState<View>("loading");
  const [error, setError] = useState<string | null>(null);

  const [gatePin, setGatePin] = useState("");
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateFocused, setGateFocused] = useState(false);

  const [createCode, setCreateCode] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createOpenAiKey, setCreateOpenAiKey] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFocus, setCreateFocus] = useState<string | null>(null);

  const [allEvents, setAllEvents] = useState<EventListItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [editEvent, setEditEvent] = useState<EventInfo | null>(null);
  const [editForm, setEditForm] = useState<{
    event_code: string; event_title: string; openai_api_key: string;
    event_description: string; combo_pair_cooldown_minutes: number;
    hand_scores: Record<string, number>; llm_instructions: string;
  } | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFocus, setEditFocus] = useState<string | null>(null);
  const [listActionEventId, setListActionEventId] = useState<string | null>(null);

  const checkGateAndFetch = useCallback(async () => {
    try {
      const gateUrl = withSessionToken("/api/admin/gate-status");
      const gateRes = await api.get(gateUrl, authHeaders());
      const gateData = await normalizeResponse(gateRes);
      const unlocked = gateData.ok && gateData.data && typeof gateData.data === "object" && (gateData.data as { unlocked?: boolean }).unlocked;
      if (!unlocked) { setView("gate"); return; }
      setView("list");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error");
      setView("error");
    }
  }, []);

  useEffect(() => { checkGateAndFetch(); }, [checkGateAndFetch]);

  const fetchAllEvents = useCallback(async () => {
    setListError(null);
    try {
      const url = withSessionToken("/api/events");
      const raw = await api.get(url, authHeaders());
      const { ok, status, data } = await normalizeResponse(raw);
      if (ok && data && typeof data === "object" && "items" in data) {
        const items = (data as { items: EventListItem[] }).items;
        setAllEvents(Array.isArray(items) ? items : []);
      } else {
        const errMsg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `Request failed (${status})`;
        setListError(errMsg);
        setAllEvents([]);
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load events");
      setAllEvents([]);
    }
  }, []);

  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);
    setGateSubmitting(true);
    try {
      const raw = await api.post("/api/admin/gate", {
        body: JSON.stringify({ admin_pin: gatePin }),
        headers: { "Content-Type": "application/json" },
      });
      const { ok, status, data } = await normalizeResponse(raw);
      if (ok) {
        let sessionToken = gatePin.trim();
        if (data && typeof data === "object" && "session_token" in (data as { session_token?: unknown })) {
          const val = (data as { session_token?: unknown }).session_token;
          if (typeof val === "string" && val.trim() !== "") sessionToken = val.trim();
        }
        if (sessionToken) setAdminSessionToken(sessionToken);
        setView("list");
        fetchAllEvents();
        return;
      }
      const errMsg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `Failed (${status})`;
      setGateError(errMsg);
    } catch {
      setGateError("Network error");
    } finally {
      setGateSubmitting(false);
    }
  };

  useEffect(() => { if (view === "list") fetchAllEvents(); }, [view, fetchAllEvents]);

  const handleListDelete = (ev: EventListItem) => { setDeleteEventId(ev.event_id); setDeleteConfirm(true); };

  const handleConfirmDelete = async () => {
    if (!deleteEventId) return;
    setDeleteSubmitting(true);
    try {
      const url = withSessionToken("/api/admin/event/delete");
      const token = getAdminSessionToken();
      const raw = await api.post(url, {
        body: JSON.stringify({ event_id: deleteEventId }),
        headers: { "Content-Type": "application/json", ...(token ? { "X-Admin-Session": token } : {}) },
      });
      const { ok } = await normalizeResponse(raw);
      if (ok) { setDeleteEventId(null); setDeleteConfirm(false); await fetchAllEvents(); }
    } catch { /* ignore */ } finally { setDeleteSubmitting(false); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSubmitting(true);
    try {
      const code = createCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length < 5 || code.length > 10) { setCreateError("Event code must be 5–10 letters or numbers."); setCreateSubmitting(false); return; }
      const title = createTitle.trim();
      if (!title) { setCreateError("Event title is required."); setCreateSubmitting(false); return; }
      const url = withSessionToken("/api/admin/event/create");
      const token = getAdminSessionToken();
      const raw = await api.post(url, {
        body: JSON.stringify({ event_code: code, event_title: title, openai_api_key: createOpenAiKey.trim() || undefined }),
        headers: { "Content-Type": "application/json", ...(token ? { "X-Admin-Session": token } : {}) },
      });
      const { ok, status, data } = await normalizeResponse(raw);
      if (ok) { setCreateCode(""); setCreateTitle(""); setCreateOpenAiKey(""); await fetchAllEvents(); return; }
      const errMsg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `Create failed (${status})`;
      setCreateError(errMsg);
    } catch (err: unknown) {
      const res = (err as { response?: { data?: unknown } })?.response;
      const d = res?.data;
      setCreateError((d && typeof d === "object" && "error" in d ? String((d as { error: unknown }).error) : null) || (typeof d === "string" ? d : null) || (err instanceof Error ? err.message : "Network error"));
    } finally { setCreateSubmitting(false); }
  };

  const handleListStart = async (ev: EventListItem) => {
    setListActionEventId(ev.event_id);
    try {
      const token = getAdminSessionToken();
      const raw = await api.post(withSessionToken("/api/admin/event/start"), {
        body: JSON.stringify({ event_id: ev.event_id }),
        headers: { "Content-Type": "application/json", ...(token ? { "X-Admin-Session": token } : {}) },
      });
      const { ok } = await normalizeResponse(raw);
      if (ok) await fetchAllEvents();
    } catch { /* ignore */ } finally { setListActionEventId(null); }
  };

  const handleListEnd = async (ev: EventListItem) => {
    setListActionEventId(ev.event_id);
    try {
      const token = getAdminSessionToken();
      const raw = await api.post(withSessionToken("/api/admin/event/end"), {
        body: JSON.stringify({ event_id: ev.event_id }),
        headers: { "Content-Type": "application/json", ...(token ? { "X-Admin-Session": token } : {}) },
      });
      const { ok } = await normalizeResponse(raw);
      if (ok) await fetchAllEvents();
    } catch { /* ignore */ } finally { setListActionEventId(null); }
  };

  const handleOpenEdit = async (ev: EventListItem) => {
    setEditError(null); setEditEvent(null); setEditForm(null);
    try {
      const url = `/api/admin/event?event_id=${encodeURIComponent(ev.event_id)}`;
      const raw = await api.get(withSessionToken(url), authHeaders());
      const { ok, data } = await normalizeResponse(raw);
      if (!ok || !data || typeof data !== "object") { setEditError("Failed to load event"); return; }
      const d = data as EventInfo & { hand_scores?: string | Record<string, number> | null };
      let handScores: Record<string, number> = { ...DEFAULT_HAND_SCORES };
      if (d.hand_scores != null) {
        if (typeof d.hand_scores === "string") {
          try { handScores = { ...DEFAULT_HAND_SCORES, ...(JSON.parse(d.hand_scores) as Record<string, number>) }; } catch {}
        } else if (typeof d.hand_scores === "object") {
          handScores = { ...DEFAULT_HAND_SCORES, ...d.hand_scores };
        }
      }
      setEditEvent(d as EventInfo);
      setEditForm({
        event_code: (d.event_code ?? "").toString(),
        event_title: (d.event_title ?? "").toString().trim(),
        openai_api_key: (d.openai_api_key ?? "").toString(),
        event_description: (d.event_description ?? "").toString().trim(),
        combo_pair_cooldown_minutes: (d.combo_pair_cooldown_minutes ?? 5) as number,
        hand_scores: handScores,
        llm_instructions: (d.llm_instructions ?? "").toString().trim() || DEFAULT_LLM_INSTRUCTIONS,
      });
      setView("edit");
    } catch { setEditError("Network error"); }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEvent || !editForm) return;
    if (!editForm.event_title.trim()) { setEditError("Event title is required."); return; }
    setEditError(null);
    setEditSubmitting(true);
    try {
      const token = getAdminSessionToken();
      const raw = await api.post(withSessionToken("/api/admin/event/update"), {
        body: JSON.stringify({
          event_id: editEvent.event_id,
          event_code: editForm.event_code.toUpperCase().replace(/[^A-Z0-9]/g, ""),
          event_title: editForm.event_title.trim(),
          openai_api_key: editForm.openai_api_key.trim() || null,
          event_description: editForm.event_description.trim() || "",
          combo_pair_cooldown_minutes: editForm.combo_pair_cooldown_minutes,
          hand_scores: editForm.hand_scores,
          llm_instructions: editForm.llm_instructions.trim() || "",
        }),
        headers: { "Content-Type": "application/json", ...(token ? { "X-Admin-Session": token } : {}) },
      });
      const { ok, data } = await normalizeResponse(raw);
      if (ok) { setEditEvent(null); setEditForm(null); setView("list"); await fetchAllEvents(); return; }
      const errMsg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "Failed to update";
      setEditError(errMsg);
    } catch { setEditError("Network error"); } finally { setEditSubmitting(false); }
  };

  const inputFocus = (key: string, focusSetter: (v: string | null) => void): React.InputHTMLAttributes<HTMLInputElement> => ({
    onFocus: () => focusSetter(key),
    onBlur: () => focusSetter(null),
    style: { ...INPUT_STYLE, borderColor: undefined, boxShadow: undefined },
  });

  const styledInput = (key: string, focused: string | null): React.CSSProperties => ({
    ...INPUT_STYLE,
    borderColor: focused === key ? "#3b82f6" : C.border,
    boxShadow: focused === key ? "0 0 0 3px rgba(59,130,246,0.15)" : "none",
  });

  const styledTextarea = (key: string, focused: string | null): React.CSSProperties => ({
    ...TEXTAREA_STYLE,
    borderColor: focused === key ? "#3b82f6" : C.border,
    boxShadow: focused === key ? "0 0 0 3px rgba(59,130,246,0.15)" : "none",
  });

  // ── Loading ───────────────────────────────────────────────────

  if (view === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <Head><title>Admin - Cooperative Poker</title></Head>
        <p style={{ color: C.textMuted }}>Loading…</p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────

  if (view === "error") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, padding: 16 }}>
        <Head><title>Admin - Cooperative Poker</title></Head>
        <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>
        <button
          onClick={() => { setView("loading"); setError(null); checkGateAndFetch(); }}
          style={{ height: 42, borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "white", background: "linear-gradient(135deg, #2563eb, #3b82f6)", padding: "0 24px" }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Gate ──────────────────────────────────────────────────────

  if (view === "gate") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
        <Head><title>Admin - Cooperative Poker</title></Head>
        <Header title="Admin" />
        <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: C.textMain, margin: "0 0 8px" }}>Admin access</h1>
              <p style={{ fontSize: 14, color: C.textMuted, margin: 0 }}>Enter the admin code to continue.</p>
            </div>
            <div style={CARD_STYLE}>
              <form onSubmit={handleGateSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Admin code">
                  <input
                    type="password"
                    value={gatePin}
                    onChange={(e) => setGatePin(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6))}
                    maxLength={6}
                    onFocus={() => setGateFocused(true)}
                    onBlur={() => setGateFocused(false)}
                    placeholder="Code"
                    required
                    autoFocus
                    style={{ ...INPUT_STYLE, borderColor: gateFocused ? "#3b82f6" : C.border, boxShadow: gateFocused ? "0 0 0 3px rgba(59,130,246,0.15)" : "none" }}
                  />
                </Field>
                {gateError && <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{gateError}</p>}
                <PrimaryButton type="submit" disabled={gateSubmitting}>
                  {gateSubmitting ? "Checking…" : "Continue"}
                </PrimaryButton>
              </form>
            </div>
            <p style={{ textAlign: "center" }}>
              <Link href="/" style={{ fontSize: 13, color: C.textMuted, textDecoration: "none" }}>Back to home</Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ── List ──────────────────────────────────────────────────────

  if (view === "list") {
    const eventToDelete = deleteEventId ? allEvents.find((e) => e.event_id === deleteEventId) : null;
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
        <Head><title>Admin - Cooperative Poker</title></Head>
        <Header title="Cooperative Poker — Admin" />

        <main style={{ flex: 1, width: "100%", maxWidth: 560, margin: "0 auto", padding: "28px 20px 40px", display: "flex", flexDirection: "column", gap: 22 }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>Admin</h1>
            <Link href="/" style={{ fontSize: 14, fontWeight: 500, color: C.primary, textDecoration: "none" }}>Back to home</Link>
          </div>

          {/* Events list */}
          <section style={CARD_STYLE}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.textMain, margin: "0 0 16px" }}>Events</h2>
            {listError && <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{listError}</p>}
            {allEvents.length === 0 && !listError ? (
              <p style={{ fontSize: 14, color: "#94a3b8" }}>No events yet. Create one below.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {allEvents.map((ev, i) => (
                  <li key={ev.event_id ?? ev.event_code} style={{ padding: "12px 0", borderBottom: i < allEvents.length - 1 ? `1px solid ${C.divider}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.textMain }}>{ev.event_code}</span>
                        {ev.event_title && <span style={{ fontSize: 13, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.event_title}</span>}
                        <StateBadge state={ev.round_state} />
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {(ev.round_state === "NOT_STARTED" || ev.round_state === "ENDED") && (
                          <button type="button" onClick={() => handleListStart(ev)} disabled={listActionEventId !== null}
                            style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "none", cursor: listActionEventId ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: "white", background: "#16a34a", opacity: listActionEventId ? 0.6 : 1 }}>
                            {listActionEventId === ev.event_id ? "Starting…" : "Start"}
                          </button>
                        )}
                        {ev.round_state === "ACTIVE" && (
                          <button type="button" onClick={() => handleListEnd(ev)} disabled={listActionEventId !== null}
                            style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "none", cursor: listActionEventId ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: "white", background: "#d97706", opacity: listActionEventId ? 0.6 : 1 }}>
                            {listActionEventId === ev.event_id ? "Stopping…" : "Stop"}
                          </button>
                        )}
                        <button type="button" onClick={() => handleOpenEdit(ev)}
                          style={{ height: 30, padding: "0 12px", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.textMain, background: "white" }}>
                          Edit
                        </button>
                        <button type="button" onClick={() => handleListDelete(ev)}
                          style={{ height: 30, padding: "0 12px", borderRadius: 8, border: "1px solid #fca5a5", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#dc2626", background: "#fff5f5" }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Create event */}
          <section style={CARD_STYLE}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.textMain, margin: "0 0 16px" }}>Create event</h2>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Event code (5–10 chars, A–Z 0–9)">
                <input type="text" value={createCode} onChange={(e) => setCreateCode(e.target.value)}
                  onFocus={() => setCreateFocus("code")} onBlur={() => setCreateFocus(null)}
                  placeholder="EVENT1" maxLength={10}
                  style={styledInput("code", createFocus)} />
              </Field>
              <Field label="Event title *">
                <input type="text" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)}
                  onFocus={() => setCreateFocus("title")} onBlur={() => setCreateFocus(null)}
                  placeholder="e.g. Annual Networking Mixer" required
                  style={styledInput("title", createFocus)} />
              </Field>
              <Field label="OpenAI API key (optional)">
                <input type="password" value={createOpenAiKey} onChange={(e) => setCreateOpenAiKey(e.target.value)}
                  onFocus={() => setCreateFocus("key")} onBlur={() => setCreateFocus(null)}
                  placeholder="sk-…"
                  style={styledInput("key", createFocus)} />
              </Field>
              {createError && <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{createError}</p>}
              <PrimaryButton type="submit" disabled={createSubmitting || createCode.replace(/[^A-Z0-9]/gi, "").length < 5 || !createTitle.trim()}>
                {createSubmitting ? "Creating…" : "Create event"}
              </PrimaryButton>
            </form>
          </section>

        </main>

        {deleteConfirm && eventToDelete && (
          <Modal
            title="Delete event?"
            body={`Delete "${eventToDelete.event_code}"? This cannot be undone.`}
            confirmLabel="Yes, delete"
            onConfirm={handleConfirmDelete}
            onCancel={() => { setDeleteEventId(null); setDeleteConfirm(false); }}
            submitting={deleteSubmitting}
          />
        )}
      </div>
    );
  }

  // ── Edit ──────────────────────────────────────────────────────

  if (view === "edit" && editForm) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg }}>
        <Head><title>Admin - Edit event</title></Head>
        <Header title="Cooperative Poker — Admin" />

        <main style={{ flex: 1, width: "100%", maxWidth: 560, margin: "0 auto", padding: "28px 20px 40px", display: "flex", flexDirection: "column", gap: 22 }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textMain, margin: 0 }}>Edit event</h1>
            <button type="button" onClick={() => { setView("list"); setEditEvent(null); setEditForm(null); setEditError(null); }}
              style={{ fontSize: 14, fontWeight: 500, color: C.primary, background: "none", border: "none", cursor: "pointer" }}>
              ← Back to list
            </button>
          </div>

          <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 22 }}>

            {/* Basic info */}
            <section style={CARD_STYLE}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" }}>Basic info</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Event code (5–10 chars, A–Z 0–9)">
                  <input type="text" value={editForm.event_code} maxLength={10}
                    onChange={(e) => setEditForm((f) => f ? { ...f, event_code: e.target.value } : null)}
                    onFocus={() => setEditFocus("code")} onBlur={() => setEditFocus(null)}
                    style={styledInput("code", editFocus)} />
                </Field>
                <Field label="Event title *">
                  <input type="text" value={editForm.event_title} required placeholder="e.g. Annual Networking Mixer"
                    onChange={(e) => setEditForm((f) => f ? { ...f, event_title: e.target.value } : null)}
                    onFocus={() => setEditFocus("title")} onBlur={() => setEditFocus(null)}
                    style={styledInput("title", editFocus)} />
                </Field>
                <Field label="Event description (optional)">
                  <textarea rows={3} value={editForm.event_description} placeholder="Brief description of the event"
                    onChange={(e) => setEditForm((f) => f ? { ...f, event_description: e.target.value } : null)}
                    onFocus={() => setEditFocus("desc")} onBlur={() => setEditFocus(null)}
                    style={styledTextarea("desc", editFocus)} />
                </Field>
              </div>
            </section>

            {/* Settings */}
            <section style={CARD_STYLE}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" }}>Settings</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="OpenAI API key (optional)">
                  <input type="password" value={editForm.openai_api_key} placeholder="sk-…"
                    onChange={(e) => setEditForm((f) => f ? { ...f, openai_api_key: e.target.value } : null)}
                    onFocus={() => setEditFocus("apikey")} onBlur={() => setEditFocus(null)}
                    style={styledInput("apikey", editFocus)} />
                </Field>
                <Field label="Combo pair cooldown (minutes)">
                  <input type="number" min={1} max={60} value={editForm.combo_pair_cooldown_minutes}
                    onChange={(e) => setEditForm((f) => f ? { ...f, combo_pair_cooldown_minutes: Number(e.target.value) || 5 } : null)}
                    onFocus={() => setEditFocus("cooldown")} onBlur={() => setEditFocus(null)}
                    style={{ ...styledInput("cooldown", editFocus), width: 100 }} />
                </Field>
                <Field label="LLM instructions">
                  <textarea rows={6} value={editForm.llm_instructions}
                    onChange={(e) => setEditForm((f) => f ? { ...f, llm_instructions: e.target.value } : null)}
                    onFocus={() => setEditFocus("llm")} onBlur={() => setEditFocus(null)}
                    style={{ ...styledTextarea("llm", editFocus), fontFamily: "monospace", fontSize: 12 }} />
                  <div style={{ background: C.divider, borderRadius: 10, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Placeholders</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {[
                        { token: "{{asking}}", desc: "JSON profile of the player who will receive the question (name, workplace, title, interests)" },
                        { token: "{{asked}}",  desc: "JSON profile of their partner" },
                      ].map(({ token, desc }) => (
                        <div key={token} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <code style={{ fontSize: 12, fontWeight: 700, color: C.primary, background: "#eff6ff", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap", flexShrink: 0 }}>{token}</code>
                          <span style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Field>
              </div>
            </section>

            {/* Hand scores */}
            <section style={CARD_STYLE}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" }}>Hand scores</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {HAND_NAMES.map((name, i) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: i % 2 === 0 ? "white" : C.bg, borderRadius: 8 }}>
                    <span style={{ fontSize: 14, color: C.textMain }}>{name}</span>
                    <input
                      type="number" min={0}
                      value={editForm.hand_scores[name] ?? DEFAULT_HAND_SCORES[name] ?? 0}
                      onChange={(e) => setEditForm((f) => f ? { ...f, hand_scores: { ...f.hand_scores, [name]: Number(e.target.value) || 0 } } : null)}
                      style={{ width: 72, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, padding: "0 8px", fontSize: 13, fontWeight: 600, color: "#16a34a", textAlign: "right", background: "white", outline: "none" }}
                    />
                  </div>
                ))}
              </div>
            </section>

            {editError && <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{editError}</p>}
            <PrimaryButton type="submit" disabled={editSubmitting}>
              {editSubmitting ? "Saving…" : "Save changes"}
            </PrimaryButton>

          </form>
        </main>
      </div>
    );
  }

  return null;
}
