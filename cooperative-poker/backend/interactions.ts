import { db } from "./db";
import type { DbRecord } from "./db";
import type { LambdaEvent, LambdaResponse } from "./types";
import { EVENTS_TABLE, PLAYERS_TABLE, COMBO_SESSIONS_TABLE } from "./types";
import { jsonResponse } from "./http-utils";
import { resolvePlayer } from "./players";

export async function getLeaderboard(event: LambdaEvent): Promise<LambdaResponse> {
  const q = event.queryStringParameters ?? {};
  const eventId = q.event_id as string | undefined;
  if (!eventId) return jsonResponse(400, { error: "event_id required" });
  const [ev] = await db.get(EVENTS_TABLE, [eventId]);
  const round_state = ev ? (ev.round_state as string) : undefined;
  const { items: players } = await db.list(PLAYERS_TABLE, { filter: { event_id: eventId }, limit: 500 });
  const { items: combos } = await db.list(COMBO_SESSIONS_TABLE, { filter: { event_id: eventId, state: "SUBMITTED" }, limit: 1000 });
  const firstSubmitted: Record<string, number> = {};
  for (const c of combos) {
    const subAt = (c as Record<string, unknown>).submitted_at as number | undefined;
    if (subAt == null) continue;
    const lid = (c as Record<string, unknown>).leader_player_id as string;
    const iid = (c as Record<string, unknown>).invitee_player_id as string;
    if (lid && (firstSubmitted[lid] == null || subAt < firstSubmitted[lid])) firstSubmitted[lid] = subAt;
    if (iid && (firstSubmitted[iid] == null || subAt < firstSubmitted[iid])) firstSubmitted[iid] = subAt;
  }
  const withRank = players.map((p: DbRecord) => ({
    player_id: p.id,
    display_name: ((p as Record<string, unknown>).display_name ?? "").toString(),
    total_score: ((p as Record<string, unknown>).total_score ?? 0) as number,
    first_submitted_at: firstSubmitted[p.id] ?? null,
  }));
  withRank.sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    const aFirst = a.first_submitted_at ?? Infinity;
    const bFirst = b.first_submitted_at ?? Infinity;
    return aFirst - bFirst;
  });
  let rank = 1;
  const list = withRank.map((row) => ({ ...row, rank: rank++ }));
  return jsonResponse(200, { leaderboard: list, round_state: round_state ?? null });
}

async function getInteractionsList(event: LambdaEvent): Promise<LambdaResponse> {
  const q = event.queryStringParameters ?? {};
  const resolved = await resolvePlayer({
    ...event,
    body: { player_id: q.player_id, event_code: q.event_code, device_session_token: q.device_session_token },
  });
  if ("statusCode" in resolved) return resolved;
  const { player, eventRecord } = resolved;
  const playerId = player.id;
  const eventId = eventRecord.id;
  const roundState = eventRecord.round_state;
  const { items: combos } = await db.list(COMBO_SESSIONS_TABLE, { filter: { event_id: eventId }, limit: 200 });
  const mine = combos.filter((c: DbRecord) => {
    const lid = (c as Record<string, unknown>).leader_player_id as string;
    const iid = (c as Record<string, unknown>).invitee_player_id as string | undefined;
    const state = (c as Record<string, unknown>).state as string;
    return (lid === playerId || iid === playerId) && state === "SUBMITTED";
  });
  const otherIds = [...new Set(mine.map((c: DbRecord) => {
    const lid = (c as Record<string, unknown>).leader_player_id as string;
    const iid = (c as Record<string, unknown>).invitee_player_id as string | undefined;
    return lid === playerId ? iid : lid;
  }).filter(Boolean))] as string[];
  const partnerNames: Record<string, string> = {};
  if (otherIds.length > 0) {
    const rows = await db.get(PLAYERS_TABLE, otherIds);
    rows.forEach((row, idx) => {
      if (row && otherIds[idx]) {
        const r = row as Record<string, unknown>;
        const name = (r.display_name ?? "").toString().trim();
        partnerNames[otherIds[idx]] = name || "Partner";
      }
    });
  }
  const list = mine.map((c: DbRecord) => {
    const state = (c as Record<string, unknown>).state as string;
    const lid = (c as Record<string, unknown>).leader_player_id as string;
    const iid = (c as Record<string, unknown>).invitee_player_id as string | undefined;
    const otherId = lid === playerId ? iid : lid;
    const id = (c as Record<string, unknown>).id as string;
    const submittedAt = (c as Record<string, unknown>).submitted_at;
    const handRankName = (c as Record<string, unknown>).hand_rank_name as string | null | undefined;
    return {
      id,
      state,
      submitted_at: submittedAt != null ? new Date(submittedAt as number).toISOString() : null,
      is_leader: lid === playerId,
      partner_display_name: otherId ? partnerNames[otherId] ?? "Partner" : "Partner",
      hand_rank_name: (state === "SUBMITTED" && handRankName) ? handRankName : null,
    };
  });
  return jsonResponse(200, { interactions: list, round_state: roundState });
}

function contactVisible(state: string, roundState: string): boolean {
  return state === "SUBMITTED" || roundState === "ENDED";
}

async function getInteractionById(event: LambdaEvent, interactionId: string): Promise<LambdaResponse> {
  const q = event.queryStringParameters ?? {};
  const resolved = await resolvePlayer({
    ...event,
    body: { player_id: q.player_id, event_code: q.event_code, device_session_token: q.device_session_token },
  });
  if ("statusCode" in resolved) return resolved;
  const { player, eventRecord } = resolved;
  const playerId = player.id;
  const eventId = eventRecord.id;
  const roundState = eventRecord.round_state as string;
  const [combo] = await db.get(COMBO_SESSIONS_TABLE, [interactionId]);
  if (!combo) return jsonResponse(404, { error: "Interaction not found" });
  const comboEventId = (combo as Record<string, unknown>).event_id as string;
  if (comboEventId !== eventId) return jsonResponse(404, { error: "Interaction not found" });
  const leaderId = (combo as Record<string, unknown>).leader_player_id as string;
  const inviteeId = (combo as Record<string, unknown>).invitee_player_id as string | undefined;
  if (playerId !== leaderId && playerId !== inviteeId) return jsonResponse(403, { error: "Not in this interaction" });
  const state = (combo as Record<string, unknown>).state as string;
  const showContact = contactVisible(state, roundState);
  let leaderContact: Record<string, unknown> | null = null;
  let inviteeContact: Record<string, unknown> | null = null;
  if (showContact) {
    const [leaderRow] = await db.get(PLAYERS_TABLE, [leaderId]);
    const inviteeRow = inviteeId ? (await db.get(PLAYERS_TABLE, [inviteeId]))[0] : null;
    if (leaderRow) {
      const r = leaderRow as Record<string, unknown>;
      leaderContact = {
        player_id: leaderId,
        display_name: (r.display_name ?? "") as string,
        email: r.email ?? null,
        phone: r.phone ?? null,
        linkedin_url: r.linkedin_url ?? null,
        website_url: r.website_url ?? null,
        workplace: r.workplace ?? null,
        title: r.title ?? null,
        interests: r.interests ?? null,
      };
    }
    if (inviteeRow) {
      const r = inviteeRow as Record<string, unknown>;
      inviteeContact = {
        player_id: inviteeId,
        display_name: (r.display_name ?? "") as string,
        email: r.email ?? null,
        phone: r.phone ?? null,
        linkedin_url: r.linkedin_url ?? null,
        website_url: r.website_url ?? null,
        workplace: r.workplace ?? null,
        title: r.title ?? null,
        interests: r.interests ?? null,
      };
    }
  }
  const cr = combo as Record<string, unknown>;
  return jsonResponse(200, {
    id: interactionId,
    state,
    submitted_at: cr.submitted_at != null ? new Date(cr.submitted_at as number).toISOString() : null,
    score_awarded: cr.score_awarded ?? cr.scoreAwarded ?? null,
    hand_rank_name: cr.hand_rank_name ?? null,
    is_leader: leaderId === playerId,
    leader_contact: leaderContact,
    invitee_contact: inviteeContact,
    round_state: roundState,
  });
}

export async function getInteractions(event: LambdaEvent): Promise<LambdaResponse> {
  const path = (event.rawPath ?? event.path ?? "").replace(/\?.*$/, "").replace(/\/$/, "") || "/";
  if (path === "/api/interactions") return getInteractionsList(event);
  const match = path.match(/^\/api\/interactions\/([^/]+)$/);
  if (match) return getInteractionById(event, match[1]);
  return jsonResponse(404, { error: "Not found" });
}
