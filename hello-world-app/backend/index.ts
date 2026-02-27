import { randomBytes, createHash, pbkdf2Sync } from "crypto";

type DbRecord = Record<string, unknown> & { id: string };
type DbClient = {
  add(table: string, records: Array<Record<string, unknown>>): Promise<Array<string | null>>;
  get(table: string, ids: string[]): Promise<Array<DbRecord | null>>;
  list(table: string, options?: { filter?: Record<string, unknown>; limit?: number }): Promise<{ items: DbRecord[] }>;
  update(table: string, items: Array<{ id: string; record: Record<string, unknown> }>): Promise<boolean[]>;
  delete(table: string, ids: string[]): Promise<boolean[]>;
};

let db: DbClient;
try {
  const sdk = require("@appdeploy/sdk");
  db = sdk.db as DbClient;
} catch {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  db = {
    async add(table, records) {
      if (table === "events") {
        const ids = await Promise.all(
          records.map(async (r) => {
            const ev = await prisma.event.create({
              data: {
                event_code: r.event_code as string,
                admin_pin_hash: r.admin_pin_hash as string,
                admin_pin_salt: r.admin_pin_salt as string,
                round_duration_seconds: (r.round_duration_seconds as number) ?? 1800,
                llm_instructions: (r.llm_instructions as string) ?? "",
                round_state: (r.round_state as string) ?? "NOT_STARTED",
                round_started_at: r.round_started_at != null ? new Date(r.round_started_at as number) : null,
                round_ends_at: r.round_ends_at != null ? new Date(r.round_ends_at as number) : null,
                round_ended_at: r.round_ended_at != null ? new Date(r.round_ended_at as number) : null,
              },
            });
            return ev.id;
          })
        );
        return ids;
      }
      if (table === "admin_sessions") {
        const ids = await Promise.all(
          records.map(async (r) => {
            const s = await prisma.adminSession.create({
              data: {
                event_id: r.event_id as string,
                token_hash: r.token_hash as string,
                expires_at: new Date(r.expires_at as number),
              },
            });
            return s.id;
          })
        );
        return ids;
      }
      return records.map(() => null);
    },
    async get(table, ids) {
      if (table === "events") {
        const rows = await prisma.event.findMany({ where: { id: { in: ids } } });
        type EventRow = { id: string; event_code: string; admin_pin_hash: string; admin_pin_salt: string; round_duration_seconds: number; llm_instructions: string | null; round_state: string; round_started_at: Date | null; round_ends_at: Date | null; round_ended_at: Date | null };
        const map = new Map<string, EventRow>(rows.map((r: EventRow) => [r.id, r]));
        return ids.map((id) => {
          const r = map.get(id);
          if (!r) return null;
          return {
            id: r.id,
            event_code: r.event_code,
            admin_pin_hash: r.admin_pin_hash,
            admin_pin_salt: r.admin_pin_salt,
            round_duration_seconds: r.round_duration_seconds,
            llm_instructions: r.llm_instructions ?? "",
            round_state: r.round_state,
            round_started_at: r.round_started_at?.getTime() ?? null,
            round_ends_at: r.round_ends_at?.getTime() ?? null,
            round_ended_at: r.round_ended_at?.getTime() ?? null,
          } as DbRecord;
        });
      }
      if (table === "admin_sessions") {
        const rows = await prisma.adminSession.findMany({ where: { id: { in: ids } } });
        type SessionRow = { id: string; event_id: string; token_hash: string; expires_at: Date };
        const map = new Map<string, SessionRow>(rows.map((r: SessionRow) => [r.id, r]));
        return ids.map((id) => {
          const r = map.get(id);
          if (!r) return null;
          return {
            id: r.id,
            event_id: r.event_id,
            token_hash: r.token_hash,
            expires_at: r.expires_at.getTime(),
          } as DbRecord;
        });
      }
      return ids.map(() => null);
    },
    async list(table, options) {
      if (table === "events") {
        const where = options?.filter ? { event_code: options.filter.event_code as string } : {};
        const rows = await prisma.event.findMany({ where, take: options?.limit ?? 1000 } as { where: object; take: number });
        return {
          items: rows.map((r: { id: string; event_code: string; admin_pin_hash: string; admin_pin_salt: string; round_duration_seconds: number; llm_instructions: string | null; round_state: string; round_started_at: Date | null; round_ends_at: Date | null; round_ended_at: Date | null }) => ({
            id: r.id,
            event_code: r.event_code,
            admin_pin_hash: r.admin_pin_hash,
            admin_pin_salt: r.admin_pin_salt,
            round_duration_seconds: r.round_duration_seconds,
            llm_instructions: r.llm_instructions ?? "",
            round_state: r.round_state,
            round_started_at: r.round_started_at?.getTime() ?? null,
            round_ends_at: r.round_ends_at?.getTime() ?? null,
            round_ended_at: r.round_ended_at?.getTime() ?? null,
          })),
        };
      }
      if (table === "admin_sessions") {
        const where = options?.filter ? { token_hash: options.filter.token_hash as string } : {};
        const rows = await prisma.adminSession.findMany({ where, take: options?.limit ?? 1000 } as { where: object; take: number });
        return {
          items: rows.map((r: { id: string; event_id: string; token_hash: string; expires_at: Date }) => ({
            id: r.id,
            event_id: r.event_id,
            token_hash: r.token_hash,
            expires_at: r.expires_at.getTime(),
          })),
        };
      }
      return { items: [] };
    },
    async update(table, items) {
      if (table === "events") {
        return Promise.all(
          items.map(async ({ id, record }) => {
            await prisma.event.update({
              where: { id },
              data: {
                round_state: record.round_state as string,
                round_started_at: record.round_started_at != null ? new Date(record.round_started_at as number) : null,
                round_ends_at: record.round_ends_at != null ? new Date(record.round_ends_at as number) : null,
                round_ended_at: record.round_ended_at != null ? new Date(record.round_ended_at as number) : null,
              },
            });
            return true;
          })
        );
      }
      return items.map(() => false);
    },
    async delete() {
      return [];
    },
  };
}

type LambdaEvent = {
  httpMethod: string;
  path?: string;
  rawPath?: string;
  body?: string | Record<string, unknown> | null;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
};

type LambdaResponse = {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
};

const COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE_SEC = 604800; // 7 days
const PIN_ITERATIONS = 100000;
const PIN_KEY_LEN = 64;

const EVENTS_TABLE = "events";
const SESSIONS_TABLE = "admin_sessions";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function saltAndHashPin(pin: string, salt: string): string {
  return pbkdf2Sync(pin, salt, PIN_ITERATIONS, PIN_KEY_LEN, "sha256").toString("hex");
}

function verifyPin(pin: string, salt: string, storedHash: string): boolean {
  const computed = saltAndHashPin(pin, salt);
  return computed === storedHash;
}

function getCookie(event: LambdaEvent): string | null {
  const raw = event.headers?.cookie ?? event.headers?.Cookie ?? "";
  const match = raw.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

function getSessionToken(event: LambdaEvent): string | null {
  const cookie = getCookie(event);
  if (cookie) return cookie;
  const auth = event.headers?.authorization ?? event.headers?.Authorization ?? "";
  const bearer = auth.match(/^\s*Bearer\s+(\S+)\s*$/i);
  if (bearer) return bearer[1];
  const xSession = event.headers?.["x-admin-session"] ?? event.headers?.["X-Admin-Session"];
  if (xSession && typeof xSession === "string") return xSession.trim();
  const q = event.queryStringParameters;
  const qToken = q?.session_token ?? q?.session;
  if (qToken && typeof qToken === "string") return qToken.trim();
  return null;
}

async function requireAdminSession(event: LambdaEvent): Promise<{ eventId: string } | LambdaResponse> {
  const token = getSessionToken(event);
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: "Session required" }) };
  }
  const tokenHash = hashToken(token);
  const { items } = await db.list(SESSIONS_TABLE, { filter: { token_hash: tokenHash } });
  const session = items.find((s) => {
    const exp = s.expires_at as number | undefined;
    return exp != null && exp > Date.now();
  });
  if (!session) {
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired session" }) };
  }
  return { eventId: session.event_id as string };
}

function getCorsHeaders(event: LambdaEvent): Record<string, string> {
  const origin = event.headers?.origin ?? event.headers?.Origin ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": origin === "*" ? "false" : "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Session",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(statusCode: number, data: unknown, extraHeaders?: Record<string, string>): LambdaResponse {
  return {
    statusCode,
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json", ...extraHeaders },
  };
}

function setSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}`;
}

function parseBody(event: LambdaEvent & { isBase64Encoded?: boolean }): Record<string, unknown> {
  if (event.body == null) return {};
  if (typeof event.body === "object") return event.body as Record<string, unknown>;
  let str = event.body as string;
  if (event.isBase64Encoded && typeof Buffer !== "undefined") {
    try {
      str = Buffer.from(str, "base64").toString("utf8");
    } catch {
      return {};
    }
  }
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function postAdminEventCreate(event: LambdaEvent): Promise<LambdaResponse> {
  const raw = parseBody(event) as Record<string, unknown>;
  let body: Record<string, unknown> = raw;
  if (raw.body !== undefined) {
    if (typeof raw.body === "object" && raw.body !== null) body = raw.body as Record<string, unknown>;
    else if (typeof raw.body === "string") {
      try {
        body = JSON.parse(raw.body) as Record<string, unknown>;
      } catch {
        /* use raw */
      }
    }
  }
  if (body.data && typeof body.data === "object" && body.data !== null) {
    body = body.data as Record<string, unknown>;
  }
  const b = body as {
    event_code?: string;
    eventCode?: string;
    admin_pin?: string;
    adminPin?: string;
    duration?: number;
    llm_instructions?: string;
    llmInstructions?: string;
  };
  const event_code = ((b.event_code ?? b.eventCode) ?? "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (event_code.length < 5 || event_code.length > 10) {
    return jsonResponse(400, { error: "Invalid event_code (5-10 alphanumeric)" });
  }
  const admin_pin = (b.admin_pin ?? b.adminPin ?? "").toString();
  if (!admin_pin) return jsonResponse(400, { error: "admin_pin required" });

  const { items: existing } = await db.list(EVENTS_TABLE, { filter: { event_code } });
  if (existing.length > 0) return jsonResponse(409, { error: "Event code already exists" });

  const salt = randomBytes(16).toString("hex");
  const admin_pin_hash = saltAndHashPin(admin_pin, salt);
  const duration = typeof b.duration === "number" ? b.duration : 1800;
  const llm_instructions = (b.llm_instructions ?? b.llmInstructions ?? "") as string;
  const now = Date.now();

  const [evId] = await db.add(EVENTS_TABLE, [
    {
      event_code,
      admin_pin_hash,
      admin_pin_salt: salt,
      round_duration_seconds: duration,
      llm_instructions,
      round_state: "NOT_STARTED",
      created_at: now,
      updated_at: now,
    },
  ]);
  if (!evId) return jsonResponse(500, { error: "Failed to create event" });

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expires_at = now + SESSION_MAX_AGE_SEC * 1000;
  await db.add(SESSIONS_TABLE, [{ event_id: evId, token_hash: tokenHash, expires_at, created_at: now }]);

  return {
    ...jsonResponse(201, { event_id: evId, event_code, session_token: token }),
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(event),
      "Set-Cookie": setSessionCookie(token),
    },
  };
}

async function postAdminLogin(event: LambdaEvent): Promise<LambdaResponse> {
  const raw = parseBody(event) as Record<string, unknown>;
  let body: Record<string, unknown> = raw;
  if (raw.body !== undefined) {
    if (typeof raw.body === "object" && raw.body !== null) body = raw.body as Record<string, unknown>;
    else if (typeof raw.body === "string") {
      try {
        body = JSON.parse(raw.body) as Record<string, unknown>;
      } catch {
        /* use raw */
      }
    }
  }
  if (body.data && typeof body.data === "object" && body.data !== null) {
    body = body.data as Record<string, unknown>;
  }
  const b = body as { event_code?: string; eventCode?: string; admin_pin?: string; adminPin?: string };
  const event_code = ((b.event_code ?? b.eventCode) ?? "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const admin_pin = (b.admin_pin ?? b.adminPin ?? "").toString();
  if (!event_code || !admin_pin) return jsonResponse(400, { error: "event_code and admin_pin required" });

  const { items: evList } = await db.list(EVENTS_TABLE, { filter: { event_code } });
  const ev = evList[0];
  if (!ev) return jsonResponse(401, { error: "Invalid event code or PIN" });
  if (!verifyPin(admin_pin, ev.admin_pin_salt as string, ev.admin_pin_hash as string)) {
    return jsonResponse(401, { error: "Invalid event code or PIN" });
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expires_at = now + SESSION_MAX_AGE_SEC * 1000;
  await db.add(SESSIONS_TABLE, [{ event_id: ev.id as string, token_hash: tokenHash, expires_at, created_at: now }]);

  return {
    ...jsonResponse(200, { event_id: ev.id, event_code: ev.event_code, session_token: token }),
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(event),
      "Set-Cookie": setSessionCookie(token),
    },
  };
}

async function getAdminEvent(event: LambdaEvent): Promise<LambdaResponse> {
  const auth = await requireAdminSession(event);
  if ("statusCode" in auth) return auth;
  const [ev] = await db.get(EVENTS_TABLE, [auth.eventId]);
  if (!ev) return jsonResponse(404, { error: "Event not found" });
  return jsonResponse(200, {
    event_id: ev.id,
    event_code: ev.event_code,
    round_state: ev.round_state,
    round_duration_seconds: ev.round_duration_seconds,
    round_started_at: ev.round_started_at != null ? new Date(ev.round_started_at as number).toISOString() : null,
    round_ends_at: ev.round_ends_at != null ? new Date(ev.round_ends_at as number).toISOString() : null,
    round_ended_at: ev.round_ended_at != null ? new Date(ev.round_ended_at as number).toISOString() : null,
  });
}

async function postAdminRoundStart(event: LambdaEvent): Promise<LambdaResponse> {
  const auth = await requireAdminSession(event);
  if ("statusCode" in auth) return auth;
  const [ev] = await db.get(EVENTS_TABLE, [auth.eventId]);
  if (!ev) return jsonResponse(404, { error: "Event not found" });
  if (ev.round_state !== "NOT_STARTED") {
    return jsonResponse(400, { error: "Round already started or ended" });
  }
  const now = Date.now();
  const ends_at = now + ((ev.round_duration_seconds as number) ?? 1800) * 1000;
  const [ok] = await db.update(EVENTS_TABLE, [
    {
      id: auth.eventId,
      record: {
        ...ev,
        round_state: "ACTIVE",
        round_started_at: now,
        round_ends_at: ends_at,
      },
    },
  ]);
  if (!ok) return jsonResponse(500, { error: "Failed to update" });
  return jsonResponse(200, { round_state: "ACTIVE", round_ends_at: new Date(ends_at).toISOString() });
}

async function postAdminRoundEnd(event: LambdaEvent): Promise<LambdaResponse> {
  const auth = await requireAdminSession(event);
  if ("statusCode" in auth) return auth;
  const [ev] = await db.get(EVENTS_TABLE, [auth.eventId]);
  if (!ev) return jsonResponse(404, { error: "Event not found" });
  const now = Date.now();
  const [ok] = await db.update(EVENTS_TABLE, [
    { id: auth.eventId, record: { ...ev, round_state: "ENDED", round_ended_at: now } },
  ]);
  if (!ok) return jsonResponse(500, { error: "Failed to update" });
  return jsonResponse(200, { round_state: "ENDED", round_ended_at: new Date(now).toISOString() });
}

function router(handlers: Record<string, (e: LambdaEvent) => Promise<LambdaResponse>>) {
  return async (event: LambdaEvent): Promise<LambdaResponse> => {
    const method = (event.httpMethod || "GET").toUpperCase();
    const path = (event.rawPath ?? event.path ?? "/").replace(/\/$/, "") || "/";

    if (method === "OPTIONS") {
      return { statusCode: 204, body: "", headers: getCorsHeaders(event) };
    }

    const key = `${method} ${path}`;
    const handler = handlers[key];
    if (!handler) {
      const res = jsonResponse(404, { error: "Not found" });
      res.headers = { ...getCorsHeaders(event), ...(res.headers || {}) };
      return res;
    }
    const res = await handler(event);
    res.headers = { ...getCorsHeaders(event), ...(res.headers || {}) };
    return res;
  };
}

export const handler = router({
  "POST /api/admin/event/create": postAdminEventCreate,
  "POST /api/admin/login": postAdminLogin,
  "GET /api/admin/event": getAdminEvent,
  "POST /api/admin/round/start": postAdminRoundStart,
  "POST /api/admin/round/end": postAdminRoundEnd,
});
