import { randomBytes } from "crypto";
import { db } from "./db";
import type { DbRecord } from "./db";
import type { LambdaEvent, LambdaResponse } from "./types";
import { EVENTS_TABLE, PLAYERS_TABLE } from "./types";
import { jsonResponse, getBody, normEventCode } from "./http-utils";
import { findEventByCode } from "./events";

export async function postPlayerCreateOrLoad(event: LambdaEvent): Promise<LambdaResponse> {
  const body = getBody(event);
  const playerIdParam = body.player_id as string | undefined;
  if (playerIdParam) {
    const [player] = await db.get(PLAYERS_TABLE, [playerIdParam]);
    if (!player) return jsonResponse(404, { error: "Player not found" });
    const p = player as Record<string, unknown>;
    const handCardsRaw = p.hand_cards ?? p.handCards;
    const joinedAt = p.joined_round_at ?? p.joinedRoundAt;
    return jsonResponse(200, {
      player_id: p.id ?? playerIdParam,
      event_id: p.event_id,
      device_session_token: p.device_session_token ?? p.deviceSessionToken,
      display_name: (p.display_name ?? p.displayName ?? "").toString(),
      workplace: (p.workplace ?? null) ?? null,
      title: (p.title ?? null) ?? null,
      interests: (p.interests ?? null) ?? null,
      email: (p.email ?? null) ?? null,
      phone: (p.phone ?? null) ?? null,
      linkedin_url: (p.linkedin_url ?? p.linkedinUrl) ?? null,
      website_url: (p.website_url ?? p.websiteUrl) ?? null,
      hand_cards: handCardsRaw != null ? JSON.parse(String(handCardsRaw)) : [],
      joined_round_at: joinedAt != null ? new Date(joinedAt as number).toISOString() : null,
      total_score: (p.total_score ?? 0) as number,
      last_combo_score_awarded: p.last_combo_score_awarded ?? null,
      last_combo_hand_rank_name: p.last_combo_hand_rank_name ?? null,
    });
  }
  const event_code = normEventCode(body.event_code);
  if (!event_code) return jsonResponse(400, { error: "event_code required" });
  const ev = await findEventByCode(event_code);
  if (!ev) return jsonResponse(404, { error: "Event not found" });
  const eventId = ev.id;
  let deviceToken = (body.device_session_token ?? body.deviceSessionToken) as string | undefined;
  if (deviceToken && typeof deviceToken !== "string") deviceToken = undefined;
  const { items: existing } = await db.list(PLAYERS_TABLE, {
    filter: { event_id: eventId, device_session_token: deviceToken ?? null },
    limit: 1,
  });
  if (existing.length > 0) {
    const p = existing[0] as Record<string, unknown>;
    const handCardsRaw = p.hand_cards ?? p.handCards;
    const joinedAt = p.joined_round_at ?? p.joinedRoundAt;
    return jsonResponse(200, {
      player_id: p.id,
      event_id: p.event_id,
      device_session_token: p.device_session_token ?? p.deviceSessionToken,
      display_name: (p.display_name ?? p.displayName ?? "").toString(),
      workplace: (p.workplace ?? null) ?? null,
      title: (p.title ?? null) ?? null,
      interests: (p.interests ?? null) ?? null,
      email: (p.email ?? null) ?? null,
      phone: (p.phone ?? null) ?? null,
      linkedin_url: (p.linkedin_url ?? p.linkedinUrl) ?? null,
      website_url: (p.website_url ?? p.websiteUrl) ?? null,
      hand_cards: handCardsRaw != null ? JSON.parse(String(handCardsRaw)) : [],
      joined_round_at: joinedAt != null ? new Date(joinedAt as number).toISOString() : null,
      total_score: (p.total_score ?? 0) as number,
      last_combo_score_awarded: p.last_combo_score_awarded ?? null,
      last_combo_hand_rank_name: p.last_combo_hand_rank_name ?? null,
    });
  }
  const token = deviceToken ?? randomBytes(16).toString("hex");
  const now = Date.now();
  const [playerId] = await db.add(PLAYERS_TABLE, [{
    event_id: eventId, device_session_token: token, display_name: "",
    hand_cards: "[]", created_at: now, updated_at: now,
  }]);
  if (!playerId) return jsonResponse(500, { error: "Failed to create player" });
  return jsonResponse(201, { player_id: playerId, event_id: eventId, device_session_token: token, display_name: "", hand_cards: [], joined_round_at: null, total_score: 0 });
}

export async function resolvePlayer(event: LambdaEvent): Promise<{ player: DbRecord; eventRecord: DbRecord } | LambdaResponse> {
  const body = getBody(event);
  const playerIdParam = body.player_id as string | undefined;
  if (playerIdParam) {
    const [player] = await db.get(PLAYERS_TABLE, [playerIdParam]);
    if (!player) return jsonResponse(404, { error: "Player not found" });
    const eventId = player.event_id as string | undefined;
    if (!eventId) return jsonResponse(404, { error: "Event not found" });
    const [ev] = await db.get(EVENTS_TABLE, [eventId]);
    if (!ev) return jsonResponse(404, { error: "Event not found" });
    return { player: { ...player, id: player.id ?? playerIdParam }, eventRecord: { ...ev, id: ev.id ?? eventId } };
  }
  const event_code = normEventCode(body.event_code);
  const deviceToken = (body.device_session_token ?? body.deviceSessionToken) as string | undefined;
  if (!event_code || !deviceToken) return jsonResponse(400, { error: "event_code and device_session_token required, or player_id" });
  const ev = await findEventByCode(event_code);
  if (!ev) return jsonResponse(404, { error: "Event not found" });
  const eventId = ev.id;
  let { items: players } = await db.list(PLAYERS_TABLE, { filter: { event_id: eventId, device_session_token: deviceToken }, limit: 1 });
  let player: DbRecord | null = players[0] ?? null;
  if (!player) {
    const { items: allPlayers } = await db.list(PLAYERS_TABLE, { filter: { event_id: eventId }, limit: 200 });
    player = allPlayers.find((p: DbRecord) => (p as Record<string, unknown>).device_session_token === deviceToken) ?? null;
  }
  if (!player) return jsonResponse(404, { error: "Player not found" });
  return { player: { ...player, id: player.id }, eventRecord: { ...ev, id: eventId } };
}

export async function putPlayerProfile(event: LambdaEvent): Promise<LambdaResponse> {
  const resolved = await resolvePlayer(event);
  if ("statusCode" in resolved) return resolved;
  const { player } = resolved;
  const body = getBody(event);
  const display_name = (body.display_name ?? body.displayName ?? player.display_name ?? "").toString().trim() || (player.display_name as string);
  const playerId = (body.player_id as string | undefined) ?? (player.id as string | undefined);
  if (!playerId) return jsonResponse(500, { error: "Invalid player" });
  const p = player as Record<string, unknown>;
  const [ok] = await db.update(PLAYERS_TABLE, [{
    id: playerId,
    record: {
      event_id: p.event_id, device_session_token: p.device_session_token, display_name,
      workplace: (body.workplace ?? p.workplace) ?? null,
      title: (body.title ?? p.title) ?? null,
      interests: (body.interests ?? p.interests) ?? null,
      email: (body.email ?? p.email) ?? null,
      phone: (body.phone ?? p.phone) ?? null,
      linkedin_url: (body.linkedin_url ?? p.linkedin_url) ?? null,
      website_url: (body.website_url ?? p.website_url) ?? null,
      hand_cards: (p.hand_cards as string) ?? "[]",
      joined_round_at: (p.joined_round_at as number | null) ?? null,
      total_score: (p.total_score ?? 0) as number,
    },
  }]);
  if (!ok) return jsonResponse(500, { error: "Failed to update profile" });
  return jsonResponse(200, { ok: true });
}

export async function getPlayerHand(event: LambdaEvent): Promise<LambdaResponse> {
  let body: Record<string, string | undefined> = (event.queryStringParameters as Record<string, string | undefined>) ?? {};
  if (Object.keys(body).length === 0) {
    const rawPath = (event.rawPath ?? event.path ?? "");
    const q = rawPath.indexOf("?");
    if (q >= 0) body = Object.fromEntries(new URLSearchParams(rawPath.slice(q)).entries());
  }
  if (body?.player_id) {
    const [player] = await db.get(PLAYERS_TABLE, [body.player_id]);
    if (!player) return jsonResponse(404, { error: "Player not found" });
    return jsonResponse(200, { hand: player.hand_cards != null ? JSON.parse(String(player.hand_cards)) : [] });
  }
  const event_code = normEventCode(body?.event_code ?? "");
  const deviceToken = body?.device_session_token;
  if (!event_code || !deviceToken) return jsonResponse(400, { error: "event_code and device_session_token required, or player_id" });
  const { items: evList } = await db.list(EVENTS_TABLE, { filter: { event_code }, limit: 1 });
  const ev = evList[0];
  if (!ev) return jsonResponse(404, { error: "Event not found" });
  const { items: players } = await db.list(PLAYERS_TABLE, { filter: { event_id: ev.id as string, device_session_token: deviceToken }, limit: 1 });
  const player = players[0];
  if (!player) return jsonResponse(404, { error: "Player not found" });
  return jsonResponse(200, { hand: player.hand_cards != null ? JSON.parse(String(player.hand_cards)) : [] });
}
