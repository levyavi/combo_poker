import { describe, it, expect } from "vitest";
import { evaluateHand } from "../backend/poker";

describe("Poker hand evaluation", () => {
  it("scores one pair correctly", () => {
    const result = evaluateHand(["AS", "AH", "2C", "3D", "4S"]);
    expect(result.name).toBe("One pair");
    expect(result.score).toBe(2);
    expect(result.rankIndex).toBe(1);
  });

  it("scores straight A2345 (wheel) correctly", () => {
    const result = evaluateHand(["AS", "2H", "3C", "4D", "5S"]);
    expect(result.name).toBe("Straight");
    expect(result.score).toBe(16);
    expect(result.rankIndex).toBe(4);
  });

  it("scores flush correctly", () => {
    const result = evaluateHand(["AS", "2S", "3S", "4S", "6S"]);
    expect(result.name).toBe("Flush");
    expect(result.score).toBe(32);
    expect(result.rankIndex).toBe(5);
  });

  it("scores high card as 1", () => {
    const result = evaluateHand(["AS", "3H", "5C", "7D", "9S"]);
    expect(result.name).toBe("High card");
    expect(result.score).toBe(1);
  });

  it("scores two pair correctly", () => {
    const result = evaluateHand(["AS", "AH", "2C", "2D", "3S"]);
    expect(result.name).toBe("Two pair");
    expect(result.score).toBe(4);
  });

  it("scores straight flush correctly", () => {
    const result = evaluateHand(["AS", "2S", "3S", "4S", "5S"]);
    expect(result.name).toBe("Straight flush");
    expect(result.score).toBe(256);
  });

  it("handles 10 as 10X format", () => {
    const result = evaluateHand(["10S", "10H", "10C", "2D", "3S"]);
    expect(result.name).toBe("Three of a kind");
    expect(result.score).toBe(8);
  });
});
