import { describe, it, expect } from "vitest";
import { simulate } from "../../plugins/nereus-game/lib/balance-sim.mjs";
import { loadProfile } from "../../plugins/nereus-game/lib/profiles.mjs";

const economy = {
  income: { base: 10, growth: 1.1 },
  stages: [
    { name: "1단계", cost: 50 },
    { name: "2단계", cost: 300 },
    { name: "3단계", cost: 5000 },
  ],
};

describe("simulate", () => {
  it("같은 입력은 같은 출력", () => {
    const a = simulate({ profile: loadProfile("sim-tycoon"), economy, turns: 30, seed: 7 });
    const b = simulate({ profile: loadProfile("sim-tycoon"), economy, turns: 30, seed: 7 });
    expect(a).toEqual(b);
  });

  it("턴 수만큼 기록이 남는다", () => {
    const r = simulate({ profile: loadProfile("sim-tycoon"), economy, turns: 12, seed: 1 });
    expect(r.turns).toHaveLength(12);
    expect(r.turns[0]).toHaveProperty("resource");
  });

  it("자원은 음수가 되지 않는다", () => {
    const r = simulate({ profile: loadProfile("sim-tycoon"), economy, turns: 40, seed: 3 });
    for (const t of r.turns) expect(t.resource).toBeGreaterThanOrEqual(0);
  });
});
