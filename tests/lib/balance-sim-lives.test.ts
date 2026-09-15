import { describe, it, expect } from "vitest";
import { simulate } from "../../plugins/nereus-game/lib/balance-sim.mjs";
import { loadProfile } from "../../plugins/nereus-game/lib/profiles.mjs";

const profile = loadProfile("casual-puzzle");

describe("수명 소비와 회복", () => {
  it("시도마다 수명이 하나 줄고 회복 간격마다 하나 돈다", () => {
    const economy = {
      income: { base: 100, growth: 1 },
      lives: { cap: 2, regenTurns: 3 },
      stages: [{ name: "L1", cost: 1, attempts: 2 }],
    };
    const r = simulate({ profile, economy, turns: 6, seed: 1 });
    expect(r.turns[0].lives).toBe(1);
    expect(r.turns.some((t) => t.clearedStage === "L1")).toBe(true);
    expect(r.turns.every((t) => t.lives >= 0)).toBe(true);
    expect(r.turns.every((t) => t.lives <= 2)).toBe(true);
  });

  it("수명이 0이면 그 턴은 막힌 것으로 기록된다", () => {
    const economy = {
      income: { base: 100, growth: 1 },
      lives: { cap: 1, regenTurns: 99 },
      stages: [{ name: "L1", cost: 1, attempts: 5 }],
    };
    const r = simulate({ profile, economy, turns: 6, seed: 1 });
    expect(r.turns.filter((t) => t.blocked).length).toBeGreaterThan(0);
    expect(r.turns[0].blocked).toBe(false);
  });

  it("턴 기록 길이는 수명과 무관하게 turns 그대로다", () => {
    const economy = {
      income: { base: 100, growth: 1 },
      lives: { cap: 1, regenTurns: 99 },
      stages: [{ name: "L1", cost: 1, attempts: 9 }],
    };
    expect(simulate({ profile, economy, turns: 7, seed: 1 }).turns).toHaveLength(7);
  });
});
