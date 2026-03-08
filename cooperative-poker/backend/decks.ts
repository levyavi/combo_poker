import { db } from "./db";
import type { DbRecord } from "./db";
import type { LambdaEvent, LambdaResponse } from "./types";
import { DECKS_TABLE, PLAYERS_TABLE } from "./types";
import { jsonResponse } from "./http-utils";
import { resolvePlayer } from "./players";

const SUITS = ["S", "H", "D", "C"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function buildFullDeck(): string[] {
  const cards: string[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) cards.push(rank + suit);
  }
  return cards;
}

function shuffleDeck(cards: string[]): string[] {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function getOrCreateDeck(eventId: string, needCards: number): Promise<{ deck: DbRecord; remaining: string[] }> {
  if (!eventId || typeof eventId !== "string") throw new Error("event_id required");
  const { items: decks } = await db.list(DECKS_TABLE, { filter: { event_id: eventId }, limit: 10 });
  let deck = decks.find((d) => (JSON.parse(String(d.remaining_cards)) as string[]).length >= needCards) as DbRecord | undefined;
  if (!deck) {
    const nextIndex = decks.length === 0 ? 0 : (Math.max(...decks.map((d: DbRecord) => (d.deck_index as number))) + 1);
    const fresh = shuffleDeck(buildFullDeck());
    const [deckId] = await db.add(DECKS_TABLE, [{ event_id: eventId, deck_index: nextIndex, remaining_cards: JSON.stringify(fresh) }]);
    if (!deckId) throw new Error("Failed to create deck");
    const [created] = await db.get(DECKS_TABLE, [deckId]);
    const c = (created ?? {}) as DbRecord;
    deck = { id: c.id ?? deckId, event_id: c.event_id ?? eventId, deck_index: (c.deck_index as number) ?? nextIndex, remaining_cards: (c.remaining_cards as string) ?? JSON.stringify(fresh) };
  }
  return { deck, remaining: JSON.parse(String(deck.remaining_cards ?? "[]")) as string[] };
}

export async function postRoundJoin(event: LambdaEvent): Promise<LambdaResponse> {
  const resolved = await resolvePlayer(event);
  if ("statusCode" in resolved) return resolved;
  const { player, eventRecord } = resolved;
  const roundState = eventRecord.round_state;
  if (roundState !== "ACTIVE") return jsonResponse(400, { error: "Round is not active", round_state: roundState ?? "unknown" });
  const handCards = (player.hand_cards != null ? JSON.parse(String(player.hand_cards)) : []) as string[];
  if (handCards.length >= 4) return jsonResponse(200, { hand: handCards, already_joined: true });
  const eventId =
    (player.event_id as string | undefined) ??
    (eventRecord.id as string | undefined) ??
    ((eventRecord as Record<string, unknown>).event_id as string | undefined);
  if (!eventId) return jsonResponse(500, { error: "Event not found" });
  const { deck, remaining } = await getOrCreateDeck(eventId, 4);
  const dealt = remaining.slice(0, 4);
  const deckId = deck.id;
  if (!deckId) return jsonResponse(500, { error: "Invalid deck" });
  const [okUpdateDeck] = await db.update(DECKS_TABLE, [{
    id: deckId,
    record: { event_id: (deck as Record<string, unknown>).event_id, deck_index: (deck as Record<string, unknown>).deck_index, remaining_cards: JSON.stringify(remaining.slice(4)) },
  }]);
  if (!okUpdateDeck) return jsonResponse(500, { error: "Failed to update deck" });
  const playerId = player.id;
  if (!playerId) return jsonResponse(500, { error: "Invalid player" });
  const p = player as Record<string, unknown>;
  const [okUpdatePlayer] = await db.update(PLAYERS_TABLE, [{
    id: playerId,
    record: {
      event_id: p.event_id, device_session_token: p.device_session_token,
      display_name: (p.display_name ?? "") as string,
      workplace: p.workplace ?? null, title: p.title ?? null, interests: p.interests ?? null,
      email: p.email ?? null, phone: p.phone ?? null,
      linkedin_url: p.linkedin_url ?? null, website_url: p.website_url ?? null,
      hand_cards: JSON.stringify(dealt), joined_round_at: Date.now(),
    },
  }]);
  if (!okUpdatePlayer) return jsonResponse(500, { error: "Failed to update player hand" });
  return jsonResponse(200, { hand: dealt, already_joined: false });
}
