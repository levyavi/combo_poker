import Head from "next/head";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@appdeploy/client";

const SESSION_TOKEN_KEY = "admin_session_token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    else sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {}
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Append session_token query param so auth works when client does not forward headers */
function adminUrl(path: string): string {
  const token = getStoredToken();
  if (!token) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}session_token=${encodeURIComponent(token)}`;
}

/** Normalize api.get/post return: may be fetch Response or { data, status } / parsed body */
async function normalizeResponse(res: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
  if (res && typeof (res as Response).json === "function") {
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

type EventInfo = {
  event_id: string;
  event_code: string;
  round_state: string;
  round_duration_seconds: number;
  round_started_at: string | null;
  round_ends_at: string | null;
  round_ended_at: string | null;
};

type View = "loading" | "create_or_login" | "dashboard" | "error";

export default function AdminPage() {
  const [view, setView] = useState<View>("loading");
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createCode, setCreateCode] = useState("");
  const [createPin, setCreatePin] = useState("");
  const [createDuration, setCreateDuration] = useState(1800);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [loginCode, setLoginCode] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [roundSubmitting, setRoundSubmitting] = useState(false);
  const [roundError, setRoundError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    try {
      const raw = await api.get(adminUrl("/api/admin/event"), { headers: authHeaders() });
      const { ok, status, data } = await normalizeResponse(raw);
      if (ok && data && typeof data === "object") {
        setEvent(data as EventInfo);
        setView("dashboard");
        return;
      }
      if (status === 401) {
        setStoredToken(null);
        setEvent(null);
        setView("create_or_login");
        return;
      }
      const errMsg = typeof data === "object" && data !== null && "error" in data ? String((data as { error: unknown }).error) : "";
      setError(`Request failed (${status})${errMsg ? `: ${errMsg}` : ""}`);
      setView("error");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setStoredToken(null);
        setEvent(null);
        setView("create_or_login");
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Network error");
      setView("error");
    }
  }, []);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSubmitting(true);
    try {
      const code = createCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length < 5 || code.length > 10) {
        setCreateError("Event code must be 5–10 letters or numbers.");
        setCreateSubmitting(false);
        return;
      }
      const raw = await api.post(adminUrl("/api/admin/event/create"), {
        body: JSON.stringify({
          event_code: code,
          admin_pin: createPin,
          duration: createDuration,
          llm_instructions: "",
        }),
        headers: authHeaders(),
      });
      const { ok, status, data } = await normalizeResponse(raw);
      if (ok && data && typeof data === "object") {
        const d = data as { event_id?: string; event_code?: string; session_token?: string };
        if (d.session_token) setStoredToken(d.session_token);
        if (d.event_id != null && d.event_code != null) {
          setEvent({
            event_id: d.event_id,
            event_code: d.event_code,
            round_state: "NOT_STARTED",
            round_duration_seconds: createDuration,
            round_started_at: null,
            round_ends_at: null,
            round_ended_at: null,
          });
          setView("dashboard");
          return;
        }
        await fetchEvent();
        return;
      }
      const errMsg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `Create failed (${status})`;
      setCreateError(errMsg);
    } catch (err: unknown) {
      const res = (err as { response?: { data?: unknown; status?: number } })?.response;
      const data = res?.data;
      const msg =
        (data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : null) ||
        (typeof data === "string" ? data : null) ||
        (err instanceof Error ? err.message : null) ||
        "Network error";
      setCreateError(msg);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const code = loginCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const raw = await api.post(adminUrl("/api/admin/login"), {
        body: JSON.stringify({ event_code: code, admin_pin: loginPin }),
        headers: authHeaders(),
      });
      const { ok, status, data } = await normalizeResponse(raw);
      if (ok && data && typeof data === "object") {
        const d = data as { event_id?: string; event_code?: string; session_token?: string };
        if (d.session_token) setStoredToken(d.session_token);
        if (d.event_id != null && d.event_code != null) {
          setEvent({
            event_id: d.event_id,
            event_code: d.event_code,
            round_state: "NOT_STARTED",
            round_duration_seconds: 1800,
            round_started_at: null,
            round_ends_at: null,
            round_ended_at: null,
          });
          setView("dashboard");
          return;
        }
        await fetchEvent();
        return;
      }
      const errMsg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `Login failed (${status})`;
      setLoginError(errMsg);
    } catch (err: unknown) {
      const res = (err as { response?: { data?: unknown } })?.response;
      const data = res?.data;
      const msg =
        (data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : null) ||
        (typeof data === "string" ? data : null) ||
        (err instanceof Error ? err.message : null) ||
        "Network error";
      setLoginError(msg);
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleStartRound = async () => {
    setRoundError(null);
    setRoundSubmitting(true);
    try {
      const raw = await api.post(adminUrl("/api/admin/round/start"), { body: "{}", headers: authHeaders() });
      const { ok, data } = await normalizeResponse(raw);
      if (ok) await fetchEvent();
      else {
        const errMsg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "Failed to start round";
        setRoundError(errMsg);
      }
    } catch {
      setRoundError("Network error");
    } finally {
      setRoundSubmitting(false);
    }
  };

  const handleEndRound = async () => {
    setRoundError(null);
    setRoundSubmitting(true);
    try {
      const raw = await api.post(adminUrl("/api/admin/round/end"), { body: "{}", headers: authHeaders() });
      const { ok, data } = await normalizeResponse(raw);
      if (ok) await fetchEvent();
      else {
        const errMsg = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "Failed to end round";
        setRoundError(errMsg);
      }
    } catch {
      setRoundError("Network error");
    } finally {
      setRoundSubmitting(false);
    }
  };

  if (view === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Head><title>Admin – Loading</title></Head>
        <p className="text-slate-600">Loading…</p>
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
        <Head><title>Admin – Error</title></Head>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => {
            setView("loading");
            setError(null);
            fetchEvent();
          }}
          className="mt-4 px-4 py-2 bg-slate-700 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (view === "create_or_login") {
    return (
      <div className="min-h-screen bg-slate-100 py-8 px-4">
        <Head><title>Admin – Create or Login</title></Head>
        <div className="max-w-md mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800">Admin</h1>
            <Link href="/" className="text-slate-600 hover:underline mt-2 inline-block">Back to home</Link>
          </div>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Create event</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event code (5–10 chars, A–Z 0–9)</label>
                <input
                  type="text"
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                  placeholder="EVENT1"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Admin PIN</label>
                <input
                  type="password"
                  value={createPin}
                  onChange={(e) => setCreatePin(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Round duration (seconds)</label>
                <input
                  type="number"
                  value={createDuration}
                  onChange={(e) => setCreateDuration(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                  min={60}
                />
              </div>
              {createError && <p className="text-red-600 text-sm">{createError}</p>}
              <button type="submit" disabled={createSubmitting} className="w-full py-2 bg-slate-800 text-white rounded disabled:opacity-50">
                {createSubmitting ? "Creating…" : "Create event"}
              </button>
            </form>
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Login to existing event</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event code</label>
                <input
                  type="text"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                  placeholder="EVENT1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Admin PIN</label>
                <input
                  type="password"
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2"
                  required
                />
              </div>
              {loginError && <p className="text-red-600 text-sm">{loginError}</p>}
              <button type="submit" disabled={loginSubmitting} className="w-full py-2 bg-slate-800 text-white rounded disabled:opacity-50">
                {loginSubmitting ? "Logging in…" : "Login"}
              </button>
            </form>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <Head><title>Admin – {event?.event_code}</title></Head>
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Dashboard – {event?.event_code}</h1>
          <Link href="/" className="text-slate-600 hover:underline">Home</Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <p><span className="font-medium text-slate-700">Round state:</span> {event?.round_state}</p>
          {event?.round_started_at && (
            <p className="text-sm text-slate-600">Started: {new Date(event.round_started_at).toLocaleString()}</p>
          )}
          {event?.round_ends_at && event.round_state === "ACTIVE" && (
            <p className="text-sm text-slate-600">Ends: {new Date(event.round_ends_at).toLocaleString()}</p>
          )}
          {event?.round_ended_at && (
            <p className="text-sm text-slate-600">Ended: {new Date(event.round_ended_at).toLocaleString()}</p>
          )}

          {roundError && <p className="text-red-600 text-sm">{roundError}</p>}

          <div className="flex gap-3 pt-2">
            {event?.round_state === "NOT_STARTED" && (
              <button
                onClick={handleStartRound}
                disabled={roundSubmitting}
                className="px-4 py-2 bg-green-700 text-white rounded disabled:opacity-50"
              >
                {roundSubmitting ? "Starting…" : "Start round"}
              </button>
            )}
            {event?.round_state === "ACTIVE" && (
              <button
                onClick={handleEndRound}
                disabled={roundSubmitting}
                className="px-4 py-2 bg-amber-700 text-white rounded disabled:opacity-50"
              >
                {roundSubmitting ? "Ending…" : "End round"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
