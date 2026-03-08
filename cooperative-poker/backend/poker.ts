/**
 * Poker hand evaluation for 5 cards. Exponential scoring: 2^rankIndex.
 * Hands: high card (0), pair (1), two pair (2), three (3), straight (4), flush (5), full house (6), four (7), straight flush (8).
 */

const RANK_ORDER = "23456789TJQKA";
const RANK_VAL: Record<string, number> = {};
for (let i = 0; i < RANK_ORDER.length; i++) RANK_VAL[RANK_ORDER[i]] = i;

export type HandResult = { rankIndex: number; name: string; score: number };

function parseCard(card: string): { rank: string; rankVal: number; suit: string } {
  const rank = card.length === 3 ? card.slice(0, 2) : card[0]; // "10" or single char
  const suit = card.length === 3 ? card[2] : card[1];
  const rankVal =
    rank === "A"
      ? 12
      : rank === "K"
        ? 11
        : rank === "Q"
          ? 10
          : rank === "J"
            ? 9
            : rank === "T" || rank === "10"
              ? 8
              : parseInt(rank, 10) - 2;
  return { rank: rank === "T" ? "10" : rank, rankVal, suit };
}

function rankCounts(cards: { rankVal: number }[]): number[] {
  const counts: Record<number, number> = {};
  for (const c of cards) {
    counts[c.rankVal] = (counts[c.rankVal] ?? 0) + 1;
  }
  return Object.values(counts).sort((a, b) => b - a);
}

function isFlush(cards: { suit: string }[]): boolean {
  const s = cards[0].suit;
  return cards.every((c) => c.suit === s);
}

function isStraight(vals: number[]): boolean {
  const sorted = [...vals].sort((a, b) => a - b);
  const low = sorted[0];
  let ok = true;
  for (let i = 1; i < 5; i++) {
    if (sorted[i] !== low + i) {
      ok = false;
      break;
    }
  }
  if (ok) return true;
  // A2345 (wheel): A=12, 2=0, 3=1, 4=2, 5=3
  if (sorted[0] === 0 && sorted[1] === 1 && sorted[2] === 2 && sorted[3] === 3 && sorted[4] === 12) return true;
  return false;
}

export const HAND_NAMES = [
  "High card",
  "One pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
];

/** Default score per hand (same as evaluateHand). Used when event has no hand_scores override. */
export const DEFAULT_HAND_SCORES: Record<string, number> = {
  "High card": 1,
  "One pair": 2,
  "Two pair": 4,
  "Three of a kind": 8,
  "Straight": 16,
  "Flush": 32,
  "Full house": 64,
  "Four of a kind": 128,
  "Straight flush": 256,
  Invalid: 1,
};

export function getScoreForHand(handName: string, overrides?: Record<string, number> | null): number {
  const map = overrides && Object.keys(overrides).length > 0 ? { ...DEFAULT_HAND_SCORES, ...overrides } : DEFAULT_HAND_SCORES;
  return map[handName] ?? DEFAULT_HAND_SCORES[handName] ?? 1;
}

export function evaluateHand(cards: string[]): HandResult {
  if (cards.length !== 5) {
    return { rankIndex: 0, name: "Invalid", score: 1 };
  }
  const parsed = cards.map((c) => parseCard(cardNorm(c)));
  const vals = parsed.map((p) => p.rankVal);
  const counts = rankCounts(parsed);
  const flush = isFlush(parsed);
  const straight = isStraight(vals);

  if (flush && straight) {
    const isWheel = vals.includes(12) && vals.includes(0) && vals.includes(1) && vals.includes(2) && vals.includes(3);
    return { rankIndex: 8, name: "Straight flush", score: 256 };
  }
  if (counts[0] === 4) return { rankIndex: 7, name: "Four of a kind", score: 128 };
  if (counts[0] === 3 && counts[1] === 2) return { rankIndex: 6, name: "Full house", score: 64 };
  if (flush) return { rankIndex: 5, name: "Flush", score: 32 };
  if (straight) return { rankIndex: 4, name: "Straight", score: 16 };
  if (counts[0] === 3) return { rankIndex: 3, name: "Three of a kind", score: 8 };
  if (counts[0] === 2 && counts[1] === 2) return { rankIndex: 2, name: "Two pair", score: 4 };
  if (counts[0] === 2) return { rankIndex: 1, name: "One pair", score: 2 };
  return { rankIndex: 0, name: "High card", score: 1 };
}

function cardNorm(c: string): string {
  const u = c.trim().toUpperCase();
  if (u.startsWith("10")) return "10" + u.slice(2);
  return u;
}
