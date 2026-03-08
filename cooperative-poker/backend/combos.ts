import { db } from "./db";
import type { DbRecord } from "./db";
import type { LambdaEvent, LambdaResponse } from "./types";
import { EVENTS_TABLE, PLAYERS_TABLE, COMBO_SESSIONS_TABLE, INTERACTION_EDGES_TABLE } from "./types";
import { jsonResponse, getBody } from "./http-utils";
import { resolvePlayer } from "./players";
import { evaluateHand, getScoreForHand } from "./poker";

export function generateInviteCode(): string {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += digits[Math.floor(Math.random() * digits.length)];
  return code;
}

export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function findComboByInviteCode(inviteCode: string): Promise<DbRecord | null> {
  const code = inviteCode.trim();
  const list1 = await db.list(COMBO_SESSIONS_TABLE, { filter: { invite_code: code }, limit: 1 });
  if (list1.items.length > 0) {
    const c = list1.items[0] as Record<string, unknown>;
    if (String(c.invite_code ?? "").trim() === code) return list1.items[0];
  }
  const list2 = await db.list(COMBO_SESSIONS_TABLE, { limit: 200 });
  return list2.items.find((c) => String((c as Record<string, unknown>).invite_code ?? "").trim() === code) ?? null;
}

export async function playerInActiveCombo(eventId: string, playerId: string): Promise<boolean> {
  const { items: combos } = await db.list(COMBO_SESSIONS_TABLE, { filter: { event_id: eventId }, limit: 100 });
  for (const c of combos) {
    const cr = c as Record<string, unknown>;
    const state = cr.state as string;
    if (state !== "PENDING" && state !== "SELECTING") continue;
    if (cr.leader_player_id === playerId || cr.invitee_player_id === playerId) return true;
  }
  return false;
}

export async function postComboCreateInvite(event: LambdaEvent): Promise<LambdaResponse> {
  const resolved = await resolvePlayer(event);
  if ("statusCode" in resolved) return resolved;
  const { player, eventRecord } = resolved;
  const roundState = eventRecord.round_state;
  if (roundState === "ENDED") return jsonResponse(400, { error: "Round has ended" });
  if (roundState !== "ACTIVE") return jsonResponse(400, { error: "Round is not active" });
  const eventId = eventRecord.id;
  const playerId = player.id;
  if (!eventId || !playerId) return jsonResponse(500, { error: "Invalid context" });
  if (await playerInActiveCombo(eventId, playerId)) return jsonResponse(400, { error: "Already in a combo" });
  const handCards = (player.hand_cards != null ? JSON.parse(String(player.hand_cards)) : []) as string[];
  if (handCards.length < 4) return jsonResponse(400, { error: "Need 4 cards to create combo" });
  let inviteCode: string;
  let attempts = 0;
  do {
    inviteCode = generateInviteCode();
    const existing = await findComboByInviteCode(inviteCode);
    if (!existing || (existing.state as string) !== "PENDING") break;
    attempts++;
  } while (attempts < 20);
  if (attempts >= 20) return jsonResponse(500, { error: "Could not generate unique invite code" });
  const now = Date.now();
  const [comboId] = await db.add(COMBO_SESSIONS_TABLE, [{
    event_id: eventId, leader_player_id: playerId, invite_code: inviteCode,
    state: "PENDING", leader_hand: JSON.stringify(handCards), invitee_hand: "[]",
    created_at: now, updated_at: now,
  }]);
  if (!comboId) return jsonResponse(500, { error: "Failed to create combo" });
  return jsonResponse(201, { invite_code: inviteCode, combo_id: comboId });
}

export async function postComboJoin(event: LambdaEvent): Promise<LambdaResponse> {
  const resolved = await resolvePlayer(event);
  if ("statusCode" in resolved) return resolved;
  const body = getBody(event);
  const inviteCode = String(body.invite_code ?? "").trim();
  if (!inviteCode) return jsonResponse(400, { error: "invite_code required" });
  const { player, eventRecord } = resolved;
  const eventId = eventRecord.id;
  const playerId = player.id;
  if (!eventId || !playerId) return jsonResponse(500, { error: "Invalid context" });
  if (eventRecord.round_state === "ENDED") return jsonResponse(400, { error: "Round has ended" });
  const combo = await findComboByInviteCode(inviteCode);
  if (!combo) return jsonResponse(404, { error: "Invite not found" });
  if ((combo as Record<string, unknown>).state !== "PENDING") return jsonResponse(400, { error: "Invite code already used" });
  const leaderId = (combo as Record<string, unknown>).leader_player_id as string;
  if (leaderId === playerId) return jsonResponse(400, { error: "Cannot join own invite" });
  if (await playerInActiveCombo(eventId, playerId)) return jsonResponse(400, { error: "Already in a combo" });
  const [pa, pb] = canonicalPair(leaderId, playerId);
  const [currentEvent] = await db.get(EVENTS_TABLE, [eventId]);
  const cooldownMinutes = (currentEvent && (currentEvent as Record<string, unknown>).combo_pair_cooldown_minutes != null)
    ? Number((currentEvent as Record<string, unknown>).combo_pair_cooldown_minutes) : 5;
  const cooldownMs = Math.max(0, cooldownMinutes) * 60 * 1000;
  const { items: allEdges } = await db.list(INTERACTION_EDGES_TABLE, { filter: { event_id: eventId }, limit: 500 });
  const edges = allEdges.filter((e) => {
    const er = e as Record<string, unknown>;
    return er.player_a_id === pa && er.player_b_id === pb;
  });
  if (edges.length > 0) {
    const edge = edges[0] as Record<string, unknown>;
    const lastAt = (edge.last_combo_at ?? edge.lastComboAt) as number | undefined;
    if (lastAt != null && Date.now() - lastAt < cooldownMs) return jsonResponse(400, { error: `Cooldown: wait ${cooldownMinutes} minutes before re-matching with this player` });
  }
  const handCards = (player.hand_cards != null ? JSON.parse(String(player.hand_cards)) : []) as string[];
  if (handCards.length < 4) return jsonResponse(400, { error: "Need 4 cards to join" });
  const comboId = combo.id;
  if (!comboId) return jsonResponse(500, { error: "Invalid combo" });
  const cr = combo as Record<string, unknown>;
  const [ok] = await db.update(COMBO_SESSIONS_TABLE, [{
    id: comboId,
    record: {
      event_id: cr.event_id, leader_player_id: cr.leader_player_id, invite_code: cr.invite_code,
      invitee_player_id: playerId, state: "SELECTING", leader_hand: cr.leader_hand,
      invitee_hand: JSON.stringify(handCards), selected_cards: null,
      score_awarded: null, hand_rank_name: null, icebreak_question: cr.icebreak_question ?? null, submitted_at: null,
    },
  }]);
  if (!ok) return jsonResponse(500, { error: "Failed to join" });
  // Write interaction edge on join so cooldown is enforced even if the combo is abandoned
  const now = Date.now();
  if (edges.length > 0) {
    const edge = edges[0] as Record<string, unknown>;
    const edgeId = edge.id as string;
    if (edgeId) {
      await db.update(INTERACTION_EDGES_TABLE, [{
        id: edgeId,
        record: { event_id: edge.event_id, player_a_id: edge.player_a_id, player_b_id: edge.player_b_id, last_combo_at: now },
      }]);
    }
  } else {
    await db.add(INTERACTION_EDGES_TABLE, [{ event_id: eventId, player_a_id: pa, player_b_id: pb, last_combo_at: now }]);
  }
  return jsonResponse(200, { ok: true, state: "SELECTING" });
}

export async function postComboSelect(event: LambdaEvent): Promise<LambdaResponse> {
  const resolved = await resolvePlayer(event);
  if ("statusCode" in resolved) return resolved;
  const body = getBody(event);
  const inviteCode = String(body.invite_code ?? "").trim();
  if (!inviteCode) return jsonResponse(400, { error: "invite_code required" });
  const { player, eventRecord } = resolved;
  const playerId = player.id;
  if (eventRecord.round_state === "ENDED") return jsonResponse(400, { error: "Round has ended" });
  const combo = await findComboByInviteCode(inviteCode);
  if (!combo) return jsonResponse(404, { error: "Invite not found" });
  const cr = combo as Record<string, unknown>;
  if (cr.leader_player_id !== playerId) return jsonResponse(403, { error: "Only leader can select cards" });
  if (cr.state !== "SELECTING") return jsonResponse(400, { error: "Combo not in selecting state" });
  const combined = [
    ...JSON.parse(String(cr.leader_hand ?? "[]")) as string[],
    ...JSON.parse(String(cr.invitee_hand ?? "[]")) as string[],
  ];
  const selectedRaw = body.selected_cards ?? body.selectedCards;
  const pool = [...combined];
  const selected: string[] = [];
  for (const card of (Array.isArray(selectedRaw) ? selectedRaw.map(String) : [])) {
    if (selected.length >= 5) break;
    const idx = pool.indexOf(card);
    if (idx !== -1) { selected.push(card); pool.splice(idx, 1); }
  }
  const comboId = combo.id;
  if (!comboId) return jsonResponse(500, { error: "Invalid combo" });
  const [ok] = await db.update(COMBO_SESSIONS_TABLE, [{
    id: comboId,
    record: {
      event_id: cr.event_id, leader_player_id: cr.leader_player_id, invite_code: cr.invite_code,
      invitee_player_id: cr.invitee_player_id ?? null, state: "SELECTING",
      leader_hand: cr.leader_hand, invitee_hand: cr.invitee_hand ?? "[]",
      selected_cards: JSON.stringify(selected), score_awarded: null, hand_rank_name: null, submitted_at: null,
    },
  }]);
  if (!ok) return jsonResponse(500, { error: "Failed to update selection" });
  return jsonResponse(200, { selected_cards: selected });
}

export async function postComboSubmit(event: LambdaEvent): Promise<LambdaResponse> {
  const resolved = await resolvePlayer(event);
  if ("statusCode" in resolved) return resolved;
  const body = getBody(event);
  const inviteCode = String(body.invite_code ?? "").trim();
  if (!inviteCode) return jsonResponse(400, { error: "invite_code required" });
  const { player, eventRecord } = resolved;
  const playerId = player.id;
  if (eventRecord.round_state === "ENDED") return jsonResponse(400, { error: "Round has ended" });
  const combo = await findComboByInviteCode(inviteCode);
  if (!combo) return jsonResponse(404, { error: "Invite not found" });
  const cr = combo as Record<string, unknown>;
  const leaderId = cr.leader_player_id as string;
  if (leaderId !== playerId) return jsonResponse(403, { error: "Only leader can submit" });
  if (cr.state !== "SELECTING") return jsonResponse(400, { error: "Combo not in selecting state" });
  let selected: string[] = cr.selected_cards ? JSON.parse(String(cr.selected_cards)) as string[] : [];
  if (selected.length < 5) {
    const combined = [...JSON.parse(String(combo.leader_hand ?? "[]")) as string[], ...JSON.parse(String(combo.invitee_hand ?? "[]")) as string[]];
    const remaining = [...combined];
    for (const card of selected) { const idx = remaining.indexOf(card); if (idx !== -1) remaining.splice(idx, 1); }
    while (selected.length < 5 && remaining.length > 0) selected.push(remaining.shift()!);
    selected = selected.slice(0, 5);
  }
  if (selected.length !== 5) return jsonResponse(400, { error: "Need 5 cards to submit" });
  const result = evaluateHand(selected);
  const eventId = cr.event_id as string;
  const [currentEvent] = await db.get(EVENTS_TABLE, [eventId]);
  let handScores: Record<string, number> | null = null;
  if (currentEvent) {
    const raw = (currentEvent as Record<string, unknown>).hand_scores;
    if (raw != null && typeof raw === "string") { try { handScores = JSON.parse(raw) as Record<string, number>; } catch { /* use defaults */ } }
    else if (raw != null && typeof raw === "object") handScores = raw as Record<string, number>;
  }
  const score = getScoreForHand(result.name, handScores);
  const inviteeId = cr.invitee_player_id as string | undefined;
  if (!inviteeId) return jsonResponse(500, { error: "No invitee" });
  const [pairA, pairB] = canonicalPair(leaderId, inviteeId);
  const selectedKey = JSON.stringify([...selected].sort());
  const { items: submittedCombos } = await db.list(COMBO_SESSIONS_TABLE, { filter: { event_id: eventId, state: "SUBMITTED" }, limit: 500 });
  for (const c of submittedCombos) {
    const sc = c as Record<string, unknown>;
    if (sc.state !== "SUBMITTED" || !sc.invitee_player_id) continue;
    const [cPa, cPb] = canonicalPair(sc.leader_player_id as string, sc.invitee_player_id as string);
    if (cPa !== pairA || cPb !== pairB || sc.selected_cards == null) continue;
    try {
      if (JSON.stringify([...JSON.parse(String(sc.selected_cards)) as string[]].sort()) === selectedKey) {
        return jsonResponse(400, { error: "This combo was already played with this partner. Choose different cards." });
      }
    } catch { continue; }
  }
  const now = Date.now();
  const comboId = combo.id;
  if (!comboId) return jsonResponse(500, { error: "Invalid combo" });
  const [leaderRow] = await db.get(PLAYERS_TABLE, [leaderId]);
  const [inviteeRow] = await db.get(PLAYERS_TABLE, [inviteeId]);
  if (!leaderRow || !inviteeRow) return jsonResponse(404, { error: "Player not found" });
  const lr = leaderRow as Record<string, unknown>;
  const ir = inviteeRow as Record<string, unknown>;
  const newLeaderScore = ((lr.total_score as number) ?? 0) + score;
  const newInviteeScore = ((ir.total_score as number) ?? 0) + score;
  await db.update(PLAYERS_TABLE, [
    {
      id: leaderRow.id ?? leaderId,
      record: {
        event_id: lr.event_id, device_session_token: lr.device_session_token,
        display_name: (lr.display_name ?? "") as string, hand_cards: (lr.hand_cards ?? "[]") as string,
        joined_round_at: lr.joined_round_at ?? null, total_score: newLeaderScore,
        last_combo_score_awarded: score, last_combo_hand_rank_name: result.name,
        workplace: lr.workplace ?? null, title: lr.title ?? null, interests: lr.interests ?? null,
        email: lr.email ?? null, phone: lr.phone ?? null, linkedin_url: lr.linkedin_url ?? null, website_url: lr.website_url ?? null,
      },
    },
    {
      id: inviteeRow.id ?? inviteeId,
      record: {
        event_id: ir.event_id, device_session_token: ir.device_session_token,
        display_name: (ir.display_name ?? "") as string, hand_cards: (ir.hand_cards ?? "[]") as string,
        joined_round_at: ir.joined_round_at ?? null, total_score: newInviteeScore,
        last_combo_score_awarded: score, last_combo_hand_rank_name: result.name,
        workplace: ir.workplace ?? null, title: ir.title ?? null, interests: ir.interests ?? null,
        email: ir.email ?? null, phone: ir.phone ?? null, linkedin_url: ir.linkedin_url ?? null, website_url: ir.website_url ?? null,
      },
    },
  ]);
  await db.update(COMBO_SESSIONS_TABLE, [{
    id: comboId,
    record: {
      event_id: cr.event_id, leader_player_id: cr.leader_player_id, invite_code: cr.invite_code,
      invitee_player_id: inviteeId, state: "SUBMITTED", leader_hand: cr.leader_hand,
      invitee_hand: cr.invitee_hand ?? "[]", selected_cards: JSON.stringify(selected),
      score_awarded: score, hand_rank_name: result.name, submitted_at: now,
    },
  }]);
  const [pa, pb] = canonicalPair(leaderId, inviteeId);
  const evId = eventRecord.id;
  const { items: allExistingEdges } = await db.list(INTERACTION_EDGES_TABLE, { filter: { event_id: evId }, limit: 500 });
  const existingEdges = allExistingEdges.filter((e) => {
    const er = e as Record<string, unknown>;
    return er.player_a_id === pa && er.player_b_id === pb;
  });
  if (existingEdges.length > 0) {
    const edge = existingEdges[0] as Record<string, unknown>;
    const edgeId = edge.id as string;
    if (edgeId) await db.update(INTERACTION_EDGES_TABLE, [{ id: edgeId, record: { event_id: edge.event_id, player_a_id: edge.player_a_id, player_b_id: edge.player_b_id, last_combo_at: now } }]);
  } else {
    await db.add(INTERACTION_EDGES_TABLE, [{ event_id: evId, player_a_id: pa, player_b_id: pb, last_combo_at: now }]);
  }
  return jsonResponse(200, { score, hand_rank: result.name, score_awarded: score });
}

export async function getComboMine(event: LambdaEvent): Promise<LambdaResponse> {
  const q = event.queryStringParameters ?? {};
  const resolved = await resolvePlayer({ ...event, body: { player_id: q.player_id, event_code: q.event_code, device_session_token: q.device_session_token } });
  if ("statusCode" in resolved) return resolved;
  const { player, eventRecord } = resolved;
  const playerId = player.id;
  const eventId = eventRecord.id;
  const { items: combos } = await db.list(COMBO_SESSIONS_TABLE, { filter: { event_id: eventId }, limit: 100 });
  for (const c of combos) {
    const cr = c as Record<string, unknown>;
    const state = cr.state as string;
    if (state !== "PENDING" && state !== "SELECTING") continue;
    if (cr.leader_player_id !== playerId && cr.invitee_player_id !== playerId) continue;
    return jsonResponse(200, { found: true, invite_code: cr.invite_code as string, state, is_leader: cr.leader_player_id === playerId });
  }
  return jsonResponse(200, { found: false });
}

export async function getComboState(event: LambdaEvent): Promise<LambdaResponse> {
  const q = event.queryStringParameters ?? {};
  const resolved = await resolvePlayer({ ...event, body: { player_id: q.player_id, event_code: q.event_code, device_session_token: q.device_session_token } });
  if ("statusCode" in resolved) return resolved;
  const inviteCode = q.invite_code as string | undefined;
  if (!inviteCode) return jsonResponse(400, { error: "invite_code required" });
  const { player } = resolved;
  const playerId = player.id;
  const combo = await findComboByInviteCode(inviteCode);
  if (!combo) {
    return jsonResponse(200, { state: "CANCELLED", is_leader: false, leader_hand: [], invitee_hand: [], selected_cards: [], selectedCards: [], hand_scores: null });
  }
  const cr = combo as Record<string, unknown>;
  const leaderId = cr.leader_player_id as string;
  const inviteeId = cr.invitee_player_id as string | undefined;
  if (playerId !== leaderId && playerId !== inviteeId) return jsonResponse(403, { error: "Not in this combo" });
  const state = (combo.state ?? cr.state) as string;
  const leaderHand = JSON.parse(String(combo.leader_hand ?? cr.leaderHand ?? "[]")) as string[];
  const inviteeHand = JSON.parse(String(combo.invitee_hand ?? cr.inviteeHand ?? "[]")) as string[];
  const selectedRaw = combo.selected_cards ?? cr.selectedCards;
  let selectedCards: string[] = [];
  if (Array.isArray(selectedRaw)) selectedCards = selectedRaw.map(String);
  else if (selectedRaw != null && selectedRaw !== "") {
    try { const p = JSON.parse(String(selectedRaw)) as unknown; selectedCards = Array.isArray(p) ? p.map(String) : []; } catch { selectedCards = []; }
  }
  let hand_scores: Record<string, number> | null = null;
  const eventId = cr.event_id as string | undefined;
  if (eventId) {
    const [ev] = await db.get(EVENTS_TABLE, [eventId]);
    if (ev) {
      const raw = (ev as Record<string, unknown>).hand_scores;
      if (raw != null && typeof raw === "string") { try { hand_scores = JSON.parse(raw) as Record<string, number>; } catch { /* ignore */ } }
    }
  }
  const out: Record<string, unknown> = { state, is_leader: playerId === leaderId, leader_hand: leaderHand, invitee_hand: inviteeHand, selected_cards: selectedCards, selectedCards, hand_scores };
  if (state === "SUBMITTED") { out.score_awarded = cr.score_awarded ?? cr.scoreAwarded ?? null; out.hand_rank_name = cr.hand_rank_name ?? null; }
  return jsonResponse(200, out);
}

export async function postComboLeave(event: LambdaEvent): Promise<LambdaResponse> {
  const resolved = await resolvePlayer(event);
  if ("statusCode" in resolved) return resolved;
  const body = getBody(event);
  const inviteCode = String(body.invite_code ?? "").trim();
  if (!inviteCode) return jsonResponse(400, { error: "invite_code required" });
  const combo = await findComboByInviteCode(inviteCode);
  if (!combo) return jsonResponse(200, { ok: true, already_cancelled: true });
  const cr = combo as Record<string, unknown>;
  const state = String(cr.state ?? "").toUpperCase();
  if (state !== "PENDING" && state !== "SELECTING" && state !== "CANCELLED") return jsonResponse(400, { error: "Cannot leave", state: cr.state });
  const comboId = combo.id;
  if (!comboId) return jsonResponse(500, { error: "Invalid combo" });
  await db.update(COMBO_SESSIONS_TABLE, [{
    id: comboId,
    record: {
      event_id: cr.event_id, leader_player_id: cr.leader_player_id, invite_code: cr.invite_code,
      invitee_player_id: cr.invitee_player_id ?? null, state: "CANCELLED", leader_hand: cr.leader_hand,
      invitee_hand: cr.invitee_hand ?? "[]", selected_cards: cr.selected_cards ?? null,
      score_awarded: cr.score_awarded ?? null, hand_rank_name: cr.hand_rank_name ?? null, submitted_at: cr.submitted_at ?? null,
    },
  }]);
  return jsonResponse(200, { ok: true });
}
