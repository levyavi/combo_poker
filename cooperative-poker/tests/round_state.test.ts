import { describe, it, expect, beforeEach } from "vitest";
import { handler } from "../backend/index";

const baseEvent = {
  httpMethod: "GET",
  path: "/",
  body: null,
  headers: {},
};

function parseQuery(path: string): Record<string, string> {
  const i = path.indexOf("?");
  if (i < 0) return {};
  const params = new URLSearchParams(path.slice(i));
  return Object.fromEntries(params.entries());
}

async function invoke(method: string, path: string, body?: unknown, cookie?: string) {
  const pathOnly = path.replace(/\?.*$/, "");
  const queryStringParameters = parseQuery(path);
  const event = {
    ...baseEvent,
    httpMethod: method,
    path: pathOnly,
    rawPath: path,
    body: body !== undefined ? JSON.stringify(body) : null,
    headers: cookie ? { cookie } : {},
    queryStringParameters: Object.keys(queryStringParameters).length > 0 ? queryStringParameters : undefined,
  };
  return handler(event);
}

describe("Round state and Prompt 4 acceptance", () => {
  let eventCode: string;
  let player1Id: string;
  let player2Id: string;
  let player3Id: string;
  let inviteCode: string;
  let comboId: string;
  let sessionCookie: string;

  beforeEach(async () => {
    eventCode = "EVT" + String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    const createRes = await invoke("POST", "/api/admin/event/create", {
      event_code: eventCode,
      admin_pin: "1234",
      duration: 1800,
      llm_instructions: "Ask about hobbies.",
    });
    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body) as { session_token?: string };
    sessionCookie = createBody.session_token ? `admin_session=${createBody.session_token}` : "";

    const startRes = await invoke("POST", "/api/admin/round/start", undefined, sessionCookie);
    expect(startRes.statusCode).toBe(200);

    const create1 = await invoke("POST", "/api/player/create_or_load", { event_code: eventCode });
    expect([200, 201]).toContain(create1.statusCode);
    player1Id = (JSON.parse(create1.body) as { player_id: string }).player_id;

    const create2 = await invoke("POST", "/api/player/create_or_load", { event_code: eventCode });
    expect([200, 201]).toContain(create2.statusCode);
    player2Id = (JSON.parse(create2.body) as { player_id: string }).player_id;

    const create3 = await invoke("POST", "/api/player/create_or_load", { event_code: eventCode });
    expect([200, 201]).toContain(create3.statusCode);
    player3Id = (JSON.parse(create3.body) as { player_id: string }).player_id;

    await invoke("POST", "/api/round/join", { player_id: player1Id });
    await invoke("POST", "/api/round/join", { player_id: player2Id });
    await invoke("POST", "/api/round/join", { player_id: player3Id });

    await invoke("PUT", "/api/player/profile", { player_id: player1Id, display_name: "Alice", interests: "hiking" });
    await invoke("PUT", "/api/player/profile", { player_id: player2Id, display_name: "Bob", workplace: "Acme" });

    const createInviteRes = await invoke("POST", "/api/combo/create_invite", { player_id: player1Id });
    expect(createInviteRes.statusCode).toBe(201);
    const inviteData = JSON.parse(createInviteRes.body) as { invite_code: string; combo_id: string };
    inviteCode = inviteData.invite_code;
    comboId = inviteData.combo_id;
    expect(inviteCode).toHaveLength(5);

    const joinRes = await invoke("POST", "/api/combo/join", { player_id: player2Id, invite_code: inviteCode });
    expect(joinRes.statusCode).toBe(200);
  });

  it("LLM icebreak route returns single question", async () => {
    const res = await invoke("GET", `/api/icebreak/question?invite_code=${inviteCode}&player_id=${player1Id}`);
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body) as { question?: string };
    expect(data.question).toBeDefined();
    expect(typeof data.question).toBe("string");
    expect(data.question!.length).toBeGreaterThan(0);
  });

  it("question includes at least one profile field", async () => {
    const res = await invoke("GET", `/api/icebreak/question?invite_code=${inviteCode}&player_id=${player1Id}`);
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body) as { question?: string };
    const q = data.question ?? "";
    const hasProfile = ["Alice", "Bob", "hiking", "Acme"].some((s) => q.includes(s));
    expect(hasProfile).toBe(true);
  });

  it("after round end create_invite fails", async () => {
    const endRes = await invoke("POST", "/api/admin/round/end", undefined, sessionCookie);
    expect(endRes.statusCode).toBe(200);

    const createInviteRes = await invoke("POST", "/api/combo/create_invite", { player_id: player1Id });
    expect(createInviteRes.statusCode).toBe(400);
    const data = JSON.parse(createInviteRes.body) as { error?: string };
    expect(data.error).toMatch(/round has ended|Round has ended/i);
  });

  it("interaction list shows both submitted and canceled combos", async () => {
    await invoke("POST", "/api/combo/select", { player_id: player1Id, invite_code: inviteCode, selected_cards: ["AS", "AH", "AD", "AC", "2S"] });
    const submitRes = await invoke("POST", "/api/combo/submit", { player_id: player1Id, invite_code: inviteCode });
    expect(submitRes.statusCode).toBe(200);

    const createInvite2Res = await invoke("POST", "/api/combo/create_invite", { player_id: player1Id });
    expect(createInvite2Res.statusCode).toBe(201);
    const inviteCode2 = (JSON.parse(createInvite2Res.body) as { invite_code: string }).invite_code;
    await invoke("POST", "/api/combo/join", { player_id: player3Id, invite_code: inviteCode2 });
    await invoke("POST", "/api/combo/leave", { player_id: player1Id, invite_code: inviteCode2 });

    const listRes = await invoke("GET", `/api/interactions?player_id=${player1Id}`);
    expect(listRes.statusCode).toBe(200);
    const listData = JSON.parse(listRes.body) as { interactions?: Array<{ id: string; state: string }> };
    expect(Array.isArray(listData.interactions)).toBe(true);
    const submitted = listData.interactions!.find((i) => i.state === "SUBMITTED");
    const cancelled = listData.interactions!.find((i) => i.state === "CANCELLED");
    expect(submitted).toBeDefined();
    expect(cancelled).toBeDefined();
  });

  it("contact screen returns combo history and contact when submitted", async () => {
    await invoke("POST", "/api/combo/select", { player_id: player1Id, invite_code: inviteCode, selected_cards: ["AS", "AH", "AD", "AC", "2S"] });
    await invoke("POST", "/api/combo/submit", { player_id: player1Id, invite_code: inviteCode });

    const contactRes = await invoke("GET", `/api/interactions/${comboId}?player_id=${player1Id}`);
    expect(contactRes.statusCode).toBe(200);
    const data = JSON.parse(contactRes.body) as {
      state?: string;
      submitted_at?: string | null;
      score_awarded?: number | null;
      hand_rank_name?: string | null;
      leader_contact?: Record<string, unknown> | null;
      invitee_contact?: Record<string, unknown> | null;
    };
    expect(data.state).toBe("SUBMITTED");
    expect(data.submitted_at).toBeDefined();
    expect(data.score_awarded).toBeDefined();
    expect(data.leader_contact).toBeDefined();
    expect(data.invitee_contact).toBeDefined();
    expect((data.leader_contact as { display_name?: string })?.display_name).toBeDefined();
    expect((data.invitee_contact as { display_name?: string })?.display_name).toBeDefined();
  });
});
