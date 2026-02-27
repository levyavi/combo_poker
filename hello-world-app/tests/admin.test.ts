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

describe("Admin event and round lifecycle", () => {
  let sessionCookie: string;
  let eventCode: string;

  beforeEach(async () => {
    eventCode = "EVT" + String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    const createRes = await invoke("POST", "/api/admin/event/create", {
      event_code: eventCode,
      admin_pin: "1234",
      duration: 1800,
    });
    expect(createRes.statusCode).toBe(201);
    const setCookie = createRes.headers?.["Set-Cookie"] ?? "";
    const match = setCookie.match(/admin_session=([^;]+)/);
    sessionCookie = match ? `admin_session=${match[1]}` : "";
    expect(sessionCookie).toContain("admin_session=");
  });

  it("creating event with duplicate code fails", async () => {
    const code = "DUPCODE1";
    await invoke("POST", "/api/admin/event/create", { event_code: code, admin_pin: "1234", duration: 1800 });
    const res = await invoke("POST", "/api/admin/event/create", {
      event_code: code,
      admin_pin: "5678",
      duration: 1800,
    });
    expect(res.statusCode).toBe(409);
    const data = JSON.parse(res.body);
    expect(data.error).toContain("already exists");
  });

  it("login fails with wrong PIN", async () => {
    const res = await invoke("POST", "/api/admin/login", {
      event_code: eventCode,
      admin_pin: "wrong",
    });
    expect(res.statusCode).toBe(401);
    const data = JSON.parse(res.body);
    expect(data.error).toBeDefined();
  });

  it("start round sets state ACTIVE", async () => {
    const res = await invoke("POST", "/api/admin/round/start", undefined, sessionCookie);
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.round_state).toBe("ACTIVE");

    const getRes = await invoke("GET", "/api/admin/event", undefined, sessionCookie);
    expect(getRes.statusCode).toBe(200);
    const eventData = JSON.parse(getRes.body);
    expect(eventData.round_state).toBe("ACTIVE");
  });

  it("end round sets state ENDED", async () => {
    await invoke("POST", "/api/admin/round/start", undefined, sessionCookie);
    const res = await invoke("POST", "/api/admin/round/end", undefined, sessionCookie);
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.round_state).toBe("ENDED");

    const getRes = await invoke("GET", "/api/admin/event", undefined, sessionCookie);
    expect(getRes.statusCode).toBe(200);
    const eventData = JSON.parse(getRes.body);
    expect(eventData.round_state).toBe("ENDED");
  });

  it("session cookie required for protected endpoints", async () => {
    const getNoCookie = await invoke("GET", "/api/admin/event");
    expect(getNoCookie.statusCode).toBe(401);

    const startNoCookie = await invoke("POST", "/api/admin/round/start");
    expect(startNoCookie.statusCode).toBe(401);

    const endNoCookie = await invoke("POST", "/api/admin/round/end");
    expect(endNoCookie.statusCode).toBe(401);
  });

  it("login with correct PIN returns session and GET /admin/event works", async () => {
    const loginRes = await invoke("POST", "/api/admin/login", {
      event_code: eventCode,
      admin_pin: "1234",
    });
    expect(loginRes.statusCode).toBe(200);
    const setCookie = loginRes.headers?.["Set-Cookie"] ?? "";
    const match = setCookie.match(/admin_session=([^;]+)/);
    const cookie = match ? `admin_session=${match[1]}` : "";
    expect(cookie).toContain("admin_session=");

    const getRes = await invoke("GET", "/api/admin/event", undefined, cookie);
    expect(getRes.statusCode).toBe(200);
    const data = JSON.parse(getRes.body);
    expect(data.event_code).toBe(eventCode);
  });
});
