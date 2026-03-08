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
  const queryStringParameters = parseQuery(path);
  const event = {
    ...baseEvent,
    httpMethod: method,
    path,
    body: body !== undefined ? JSON.stringify(body) : null,
    headers: cookie ? { cookie } : {},
    queryStringParameters: Object.keys(queryStringParameters).length > 0 ? queryStringParameters : undefined,
  };
  return handler(event);
}

describe("Combo lifecycle and cooldown", () => {
  let eventCode: string;
  let player1Id: string;
  let player2Id: string;
  let player3Id: string;
  let inviteCode: string;

  beforeEach(async () => {
    eventCode = "EVT" + String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    const createRes = await invoke("POST", "/api/admin/event/create", {
      event_code: eventCode,
      admin_pin: "1234",
      duration: 1800,
    });
    expect(createRes.statusCode).toBe(201);

    const loginBody = JSON.parse((await invoke("POST", "/api/admin/login", { event_code: eventCode, admin_pin: "1234" })).body) as { session_token?: string };
    const cookie = loginBody.session_token ? `admin_session=${loginBody.session_token}` : "";
    const startRes = await invoke("POST", "/api/admin/round/start", undefined, cookie);
    expect(startRes.statusCode).toBe(200);

    const enterRes = await invoke("POST", "/api/event/enter", { event_code: eventCode });
    expect(enterRes.statusCode).toBe(200);

    const create1 = await invoke("POST", "/api/player/create_or_load", { event_code: eventCode });
    expect([200, 201]).toContain(create1.statusCode);
    const data1 = JSON.parse(create1.body) as { player_id: string };
    player1Id = data1.player_id;

    const create2 = await invoke("POST", "/api/player/create_or_load", { event_code: eventCode });
    expect([200, 201]).toContain(create2.statusCode);
    const data2 = JSON.parse(create2.body) as { player_id: string };
    player2Id = data2.player_id;

    const create3 = await invoke("POST", "/api/player/create_or_load", { event_code: eventCode });
    expect([200, 201]).toContain(create3.statusCode);
    const data3 = JSON.parse(create3.body) as { player_id: string };
    player3Id = data3.player_id;

    await invoke("POST", "/api/round/join", { player_id: player1Id });
    await invoke("POST", "/api/round/join", { player_id: player2Id });
    await invoke("POST", "/api/round/join", { player_id: player3Id });

    const createInviteRes = await invoke("POST", "/api/combo/create_invite", { player_id: player1Id });
    expect(createInviteRes.statusCode).toBe(201);
    const inviteData = JSON.parse(createInviteRes.body) as { invite_code: string };
    inviteCode = inviteData.invite_code;
    expect(inviteCode).toHaveLength(5);
  });

  it("invite code is single-use", async () => {
    const join1 = await invoke("POST", "/api/combo/join", { player_id: player2Id, invite_code: inviteCode });
    expect(join1.statusCode).toBe(200);
    const join2 = await invoke("POST", "/api/combo/join", { player_id: player2Id, invite_code: inviteCode });
    expect(join2.statusCode).toBe(400);
    const body2 = JSON.parse(join2.body) as { error?: string };
    expect(body2.error).toMatch(/already used|already in/i);
  });

  it("cannot join if already in combo", async () => {
    await invoke("POST", "/api/combo/join", { player_id: player2Id, invite_code: inviteCode });
    const createInvite2Res = await invoke("POST", "/api/combo/create_invite", { player_id: player3Id });
    expect(createInvite2Res.statusCode).toBe(201);
    const invite2 = (JSON.parse(createInvite2Res.body) as { invite_code: string }).invite_code;
    const joinAsPlayer1 = await invoke("POST", "/api/combo/join", { player_id: player1Id, invite_code: invite2 });
    expect(joinAsPlayer1.statusCode).toBe(400);
    const err = JSON.parse(joinAsPlayer1.body) as { error?: string };
    expect(err.error).toMatch(/already in/i);
  });

  it("auto-fill works if fewer than 5 selected", async () => {
    await invoke("POST", "/api/combo/join", { player_id: player2Id, invite_code: inviteCode });
    const stateRes = await invoke("GET", `/api/combo/state?player_id=${player1Id}&invite_code=${inviteCode}`);
    expect(stateRes.statusCode).toBe(200);
    const state = JSON.parse(stateRes.body) as { leader_hand: string[]; invitee_hand: string[] };
    const combined = [...state.leader_hand, ...state.invitee_hand];
    const selectRes = await invoke("POST", "/api/combo/select", {
      player_id: player1Id,
      invite_code: inviteCode,
      selected_cards: combined.slice(0, 3),
    });
    expect(selectRes.statusCode).toBe(200);
    const selectData = JSON.parse(selectRes.body) as { selected_cards: string[] };
    expect(selectData.selected_cards).toHaveLength(5);
  });

  it("cooldown prevents immediate re-match", async () => {
    await invoke("POST", "/api/combo/join", { player_id: player2Id, invite_code: inviteCode });
    const stateRes = await invoke("GET", `/api/combo/state?player_id=${player1Id}&invite_code=${inviteCode}`);
    const state = JSON.parse(stateRes.body) as { leader_hand: string[]; invitee_hand: string[] };
    const combined = [...state.leader_hand, ...state.invitee_hand];
    await invoke("POST", "/api/combo/select", {
      player_id: player1Id,
      invite_code: inviteCode,
      selected_cards: combined.slice(0, 5),
    });
    await invoke("POST", "/api/combo/submit", { player_id: player1Id, invite_code: inviteCode });

    const createInvite2Res = await invoke("POST", "/api/combo/create_invite", { player_id: player1Id });
    expect(createInvite2Res.statusCode).toBe(201);
    const invite2 = (JSON.parse(createInvite2Res.body) as { invite_code: string }).invite_code;
    const joinAgain = await invoke("POST", "/api/combo/join", { player_id: player2Id, invite_code: invite2 });
    expect(joinAgain.statusCode).toBe(400);
    const err = JSON.parse(joinAgain.body) as { error?: string };
    expect(err.error).toMatch(/cooldown|5 min/i);
  });

  it("leaderboard sorts correctly", async () => {
    const enterRes = await invoke("POST", "/api/event/enter", { event_code: eventCode });
    const enterData = JSON.parse(enterRes.body) as { event_id: string };
    const eventId = enterData.event_id;

    await invoke("POST", "/api/combo/join", { player_id: player2Id, invite_code: inviteCode });
    const stateRes = await invoke("GET", `/api/combo/state?player_id=${player1Id}&invite_code=${inviteCode}`);
    const state = JSON.parse(stateRes.body) as { leader_hand: string[]; invitee_hand: string[] };
    const combined = [...state.leader_hand, ...state.invitee_hand];
    await invoke("POST", "/api/combo/select", {
      player_id: player1Id,
      invite_code: inviteCode,
      selected_cards: combined.slice(0, 5),
    });
    await invoke("POST", "/api/combo/submit", { player_id: player1Id, invite_code: inviteCode });

    const lbRes = await invoke("GET", `/api/leaderboard?event_id=${eventId}`);
    expect(lbRes.statusCode).toBe(200);
    const lb = JSON.parse(lbRes.body) as { leaderboard: { rank: number; total_score: number; display_name: string }[] };
    expect(lb.leaderboard.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < lb.leaderboard.length; i++) {
      expect(lb.leaderboard[i].total_score).toBeLessThanOrEqual(lb.leaderboard[i - 1].total_score);
    }
  });
});
