import { db } from "./db";
import type { DbRecord } from "./db";
import type { LambdaEvent, LambdaResponse } from "./types";
import { EVENTS_TABLE, PLAYERS_TABLE, DECKS_TABLE, COMBO_SESSIONS_TABLE, INTERACTION_EDGES_TABLE, DEFAULT_LLM_INSTRUCTIONS } from "./types";
import { jsonResponse, getBody, normEventCode, parseBody } from "./http-utils";
import { isGateUnlocked, requireGate, ADMIN_GATE_PIN, setGateCookie } from "./auth";

export async function findEventByCode(event_code: string): Promise<DbRecord | null> {
  const { items: evList } = await db.list(EVENTS_TABLE, { filter: { event_code }, limit: 1 });
  const first = evList[0];
  if (first) return first;
  const { items: all } = await db.list(EVENTS_TABLE, { limit: 100 });
  const found = all.find((e: DbRecord) => normEventCode(String(e.event_code ?? "")) === event_code);
  return found ?? null;
}

export async function postEventEnter(event: LambdaEvent): Promise<LambdaResponse> {
  const body = getBody(event);
  const event_code = normEventCode(body.event_code);
  if (!event_code) return jsonResponse(400, { error: "event_code required" });
  const ev = await findEventByCode(event_code);
  if (!ev) return jsonResponse(404, { error: "Event not found" });
  const evRec = ev as Record<string, unknown>;
  return jsonResponse(200, {
    event_id: ev.id,
    event_code: ev.event_code,
    event_title: (evRec.event_title as string | undefined) ?? "",
    event_description: (evRec.event_description as string | undefined) ?? "",
    round_state: ev.round_state,
  });
}

export async function getEvents(event: LambdaEvent): Promise<LambdaResponse> {
  if (!isGateUnlocked(event)) return jsonResponse(403, { error: "Admin gate required" });
  const { items } = await db.list(EVENTS_TABLE, { limit: 100 });
  const list = items.map((ev: DbRecord) => ({
    event_id: ev.id,
    event_code: ev.event_code,
    event_title: (ev as Record<string, unknown>).event_title ?? "",
    round_state: ev.round_state,
  }));
  return jsonResponse(200, { items: list });
}

export async function getAdminGateStatus(event: LambdaEvent): Promise<LambdaResponse> {
  return jsonResponse(200, { unlocked: isGateUnlocked(event) });
}

export async function postAdminGate(event: LambdaEvent): Promise<LambdaResponse> {
  const body = getBody(event);
  const pin = (body.admin_pin ?? "").toString().trim();
  if (pin.toLowerCase() !== ADMIN_GATE_PIN) return jsonResponse(401, { error: "Invalid admin PIN" });
  const res = jsonResponse(200, { ok: true, session_token: ADMIN_GATE_PIN });
  res.headers = { ...(res.headers ?? {}), "Set-Cookie": setGateCookie() };
  return res;
}

export async function getAdminEvent(event: LambdaEvent): Promise<LambdaResponse> {
  const gate = requireGate(event);
  if (gate) return gate;
  const q = event.queryStringParameters ?? {};
  const eventId = q.event_id as string | undefined;
  if (!eventId) return jsonResponse(400, { error: "event_id required" });
  const [ev] = await db.get(EVENTS_TABLE, [eventId]);
  if (!ev) return jsonResponse(404, { error: "Event not found" });
  const evRec = ev as Record<string, unknown>;
  return jsonResponse(200, {
    event_id: ev.id ?? eventId,
    event_code: ev.event_code,
    event_title: (evRec.event_title as string | undefined) ?? "",
    round_state: ev.round_state,
    openai_api_key: (evRec.openai_api_key as string | null) ?? null,
    combo_pair_cooldown_minutes: (evRec.combo_pair_cooldown_minutes as number) ?? 5,
    hand_scores: (evRec.hand_scores as string | null) ?? null,
    llm_instructions: (evRec.llm_instructions as string | null) ?? "",
    event_description: (evRec.event_description as string | null) ?? "",
    round_started_at: evRec.round_started_at != null ? new Date(evRec.round_started_at as number).toISOString() : null,
    round_ended_at: evRec.round_ended_at != null ? new Date(evRec.round_ended_at as number).toISOString() : null,
  });
}

export async function postAdminEventDelete(event: LambdaEvent): Promise<LambdaResponse> {
  const gate = requireGate(event);
  if (gate) return gate;
  const body = getBody(event);
  const eventId = body.event_id as string | undefined;
  if (!eventId) return jsonResponse(400, { error: "event_id required" });
  const [ev] = await db.get(EVENTS_TABLE, [eventId]);
  if (!ev) return jsonResponse(404, { error: "Event not found" });

  // Cascade delete all related records
  const tables = [PLAYERS_TABLE, DECKS_TABLE, COMBO_SESSIONS_TABLE, INTERACTION_EDGES_TABLE];
  for (const table of tables) {
    const { items } = await db.list(table, { filter: { event_id: eventId }, limit: 1000 });
    if (items.length > 0) {
      await db.delete(table, items.map((r) => r.id as string));
    }
  }

  const [ok] = await db.delete(EVENTS_TABLE, [eventId]);
  if (!ok) return jsonResponse(500, { error: "Failed to delete event" });
  return jsonResponse(200, { ok: true });
}

export async function postAdminEventStart(event: LambdaEvent): Promise<LambdaResponse> {
  const gate = requireGate(event);
  if (gate) return gate;
  const body = getBody(event);
  const eventId = body.event_id as string | undefined;
  if (!eventId) return jsonResponse(400, { error: "event_id required" });
  const [ev] = await db.get(EVENTS_TABLE, [eventId]);
  if (!ev) return jsonResponse(404, { error: "Event not found" });
  if (ev.round_state === "ACTIVE") return jsonResponse(400, { error: "Event already active" });
  const now = Date.now();
  const evRec = ev as Record<string, unknown>;
  const updates: Record<string, unknown> = { ...evRec, round_state: "ACTIVE", round_started_at: now };
  if (ev.round_state === "ENDED") updates.round_ended_at = null;
  const [ok] = await db.update(EVENTS_TABLE, [{ id: eventId, record: updates }]);
  if (!ok) return jsonResponse(500, { error: "Failed to update" });
  return jsonResponse(200, { round_state: "ACTIVE", round_started_at: new Date(now).toISOString() });
}

export async function postAdminEventEnd(event: LambdaEvent): Promise<LambdaResponse> {
  const gate = requireGate(event);
  if (gate) return gate;
  const body = getBody(event);
  const eventId = body.event_id as string | undefined;
  if (!eventId) return jsonResponse(400, { error: "event_id required" });
  const [ev] = await db.get(EVENTS_TABLE, [eventId]);
  if (!ev) return jsonResponse(404, { error: "Event not found" });
  const now = Date.now();
  const evRec = ev as Record<string, unknown>;
  const [ok] = await db.update(EVENTS_TABLE, [{ id: eventId, record: { ...evRec, round_state: "ENDED", round_ended_at: now } }]);
  if (!ok) return jsonResponse(500, { error: "Failed to update" });
  return jsonResponse(200, { round_state: "ENDED", round_ended_at: new Date(now).toISOString() });
}

export async function postAdminEventCreate(event: LambdaEvent): Promise<LambdaResponse> {
  const raw = parseBody(event) as Record<string, unknown>;
  let body: Record<string, unknown> = raw;
  if (raw.body !== undefined) {
    if (typeof raw.body === "object" && raw.body !== null) body = raw.body as Record<string, unknown>;
    else if (typeof raw.body === "string") {
      try { body = JSON.parse(raw.body) as Record<string, unknown>; } catch { /* use raw */ }
    }
  }
  if (body.data && typeof body.data === "object" && body.data !== null) {
    body = body.data as Record<string, unknown>;
  }
  const gate = requireGate(event);
  if (gate) return gate;
  const b = body as { event_code?: string; event_title?: string; openai_api_key?: string };
  const event_code = (b.event_code ?? "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (event_code.length < 5 || event_code.length > 10) {
    return jsonResponse(400, { error: "Invalid event_code (5-10 alphanumeric)" });
  }
  const event_title = (b.event_title ?? "").toString().trim();
  if (!event_title) return jsonResponse(400, { error: "event_title is required" });
  const { items: existing } = await db.list(EVENTS_TABLE, { filter: { event_code } });
  if (existing.length > 0) return jsonResponse(409, { error: "Event code already exists" });
  const openai_api_key = (b.openai_api_key ?? "").toString().trim() || null;
  const now = Date.now();
  const [evId] = await db.add(EVENTS_TABLE, [{
    event_code, event_title, openai_api_key,
    combo_pair_cooldown_minutes: 5, hand_scores: null,
    llm_instructions: DEFAULT_LLM_INSTRUCTIONS,
    round_state: "NOT_STARTED", created_at: now, updated_at: now,
  }]);
  if (!evId) return jsonResponse(500, { error: "Failed to create event" });
  return jsonResponse(201, { event_id: evId, event_code });
}

export async function postAdminEventUpdate(event: LambdaEvent): Promise<LambdaResponse> {
  const gate = requireGate(event);
  if (gate) return gate;
  const body = getBody(event);
  const eventId = body.event_id as string | undefined;
  if (!eventId) return jsonResponse(400, { error: "event_id required" });
  const [ev] = await db.get(EVENTS_TABLE, [eventId]);
  if (!ev) return jsonResponse(404, { error: "Event not found" });
  const evRec = ev as Record<string, unknown>;
  const updates: Record<string, unknown> = { ...evRec };
  if (body.event_code !== undefined) {
    const code = String(body.event_code).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 5 || code.length > 10) return jsonResponse(400, { error: "Invalid event_code (5-10 alphanumeric)" });
    updates.event_code = code;
  }
  if (body.event_title !== undefined) {
    const title = typeof body.event_title === "string" ? body.event_title.trim() : "";
    if (!title) return jsonResponse(400, { error: "event_title is required and cannot be empty" });
    updates.event_title = title;
  }
  if (body.openai_api_key !== undefined) updates.openai_api_key = typeof body.openai_api_key === "string" ? body.openai_api_key.trim() || null : null;
  if (body.combo_pair_cooldown_minutes !== undefined) updates.combo_pair_cooldown_minutes = Math.max(1, Math.min(60, Number(body.combo_pair_cooldown_minutes) || 5));
  if (body.llm_instructions !== undefined) updates.llm_instructions = typeof body.llm_instructions === "string" ? body.llm_instructions : "";
  if (body.event_description !== undefined) updates.event_description = typeof body.event_description === "string" ? body.event_description : "";
  if (body.hand_scores !== undefined) {
    if (body.hand_scores === null || (typeof body.hand_scores === "object" && body.hand_scores !== null)) {
      updates.hand_scores = body.hand_scores === null ? null : JSON.stringify(body.hand_scores);
    } else if (typeof body.hand_scores === "string") {
      try { JSON.parse(body.hand_scores); updates.hand_scores = body.hand_scores; }
      catch { return jsonResponse(400, { error: "hand_scores must be valid JSON" }); }
    }
  }
  const [ok] = await db.update(EVENTS_TABLE, [{ id: eventId, record: updates }]);
  if (!ok) return jsonResponse(500, { error: "Failed to update event" });
  return jsonResponse(200, { ok: true });
}
