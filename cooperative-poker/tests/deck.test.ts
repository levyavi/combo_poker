import { describe, it, expect, beforeEach } from "vitest";
import { handler } from "../backend/index";

const baseEvent = {
  httpMethod: "GET",
  path: "/",
  body: null,
  headers: {},
};

async function invoke(method: string, path: string, body?: unknown, cookie?: string) {
  const event = {
    ...baseEvent,
    httpMethod: method,
    path,
    body: body !== undefined ? JSON.stringify(body) : null,
    headers: cookie ? { cookie } : {},
  };
  return handler(event);
}

function invokeGet(path: string, query?: Record<string, string>) {
  const qs = query
    ? "?" + Object.entries(query).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")
    : "";
  return invoke("GET", path + qs);
}

describe("Attendee entry, profile, round join, deck and hand", () => {
  let eventCode: string;
  let deviceToken1: string;
  let deviceToken2: string;

  beforeEach(async () => {
    eventCode = "EVT" + String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    const createRes = await invoke("POST", "/api/admin/event/create", {
      event_code: eventCode,
      admin_pin: "1234",
      duration: 1800,
    });
    expect(createRes.statusCode).toBe(201);

    const enterRes = await invoke("POST", "/api/event/enter", { event_code: eventCode });
    expect(enterRes.statusCode).toBe(200);

    const create1 = await invoke("POST", "/api/player/create_or_load", { event_code: eventCode });
    expect(create1.statusCode).toBe(201);
    const data1 = JSON.parse(create1.body);
    deviceToken1 = data1.device_session_token;
    expect(deviceToken1).toBeDefined();

    const create2 = await invoke("POST", "/api/player/create_or_load", { event_code: eventCode });
    expect(create2.statusCode).toBe(201);
    const data2 = JSON.parse(create2.body);
    deviceToken2 = data2.device_session_token;
    expect(deviceToken2).toBeDefined();
  });

  it("join round before ACTIVE fails", async () => {
    const res = await invoke("POST", "/api/round/join", {
      event_code: eventCode,
      device_session_token: deviceToken1,
    });
    expect(res.statusCode).toBe(400);
    const data = JSON.parse(res.body);
    expect(data.error).toContain("not active");
    expect(data.round_state).toBe("NOT_STARTED");
  });

  it("join round during ACTIVE deals exactly 4 cards", async () => {
    const sessionCookie = (JSON.parse((await invoke("POST", "/api/admin/login", { event_code: eventCode, admin_pin: "1234" })).body) as { session_token?: string }).session_token;
    const cookie = sessionCookie ? `admin_session=${sessionCookie}` : "";
    await invoke("POST", "/api/admin/round/start", undefined, cookie);

    const res = await invoke("POST", "/api/round/join", {
      event_code: eventCode,
      device_session_token: deviceToken1,
    });
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(Array.isArray(data.hand)).toBe(true);
    expect(data.hand).toHaveLength(4);
    data.hand.forEach((card: string) => {
      expect(typeof card).toBe("string");
      expect(card.length).toBeGreaterThanOrEqual(2);
      expect(["S", "H", "D", "C"]).toContain(card.slice(-1));
    });
  });

  it("two players do not receive duplicate cards within same deck", async () => {
    const sessionCookie = (JSON.parse((await invoke("POST", "/api/admin/login", { event_code: eventCode, admin_pin: "1234" })).body) as { session_token?: string }).session_token;
    const cookie = sessionCookie ? `admin_session=${sessionCookie}` : "";
    await invoke("POST", "/api/admin/round/start", undefined, cookie);

    const join1 = await invoke("POST", "/api/round/join", {
      event_code: eventCode,
      device_session_token: deviceToken1,
    });
    expect(join1.statusCode).toBe(200);
    const hand1 = (JSON.parse(join1.body) as { hand: string[] }).hand;

    const join2 = await invoke("POST", "/api/round/join", {
      event_code: eventCode,
      device_session_token: deviceToken2,
    });
    expect(join2.statusCode).toBe(200);
    const hand2 = (JSON.parse(join2.body) as { hand: string[] }).hand;

    const combined = [...hand1, ...hand2];
    const set = new Set(combined);
    expect(set.size).toBe(combined.length);
  });

  it("hand persists across refresh (GET /player/hand)", async () => {
    const sessionCookie = (JSON.parse((await invoke("POST", "/api/admin/login", { event_code: eventCode, admin_pin: "1234" })).body) as { session_token?: string }).session_token;
    const cookie = sessionCookie ? `admin_session=${sessionCookie}` : "";
    await invoke("POST", "/api/admin/round/start", undefined, cookie);

    const joinRes = await invoke("POST", "/api/round/join", {
      event_code: eventCode,
      device_session_token: deviceToken1,
    });
    expect(joinRes.statusCode).toBe(200);
    const expectedHand = (JSON.parse(joinRes.body) as { hand: string[] }).hand;

    const handRes = await invokeGet("/api/player/hand", {
      event_code: eventCode,
      device_session_token: deviceToken1,
    });
    expect(handRes.statusCode).toBe(200);
    const data = JSON.parse(handRes.body);
    expect(data.hand).toEqual(expectedHand);
  });

  it("create_or_load with same device_session_token returns existing player", async () => {
    const res1 = await invoke("POST", "/api/player/create_or_load", {
      event_code: eventCode,
      device_session_token: deviceToken1,
    });
    expect(res1.statusCode).toBe(200);
    const data1 = JSON.parse(res1.body);
    expect(data1.player_id).toBeDefined();
    expect(data1.device_session_token).toBe(deviceToken1);

    const res2 = await invoke("POST", "/api/player/create_or_load", {
      event_code: eventCode,
      device_session_token: deviceToken1,
    });
    expect(res2.statusCode).toBe(200);
    const data2 = JSON.parse(res2.body);
    expect(data2.player_id).toBe(data1.player_id);
  });

  it("PUT /player/profile updates profile", async () => {
    const res = await invoke("PUT", "/api/player/profile", {
      event_code: eventCode,
      device_session_token: deviceToken1,
      display_name: "Alice",
      workplace: "Acme",
    });
    expect(res.statusCode).toBe(200);
  });
});
