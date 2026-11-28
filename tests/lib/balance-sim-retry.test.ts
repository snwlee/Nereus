import { describe, it, expect } from "vitest";
import { simulate } from "../../plugins/nereus-game/lib/balance-sim.mjs";
import { measureRetry } from "../../plugins/nereus-game/lib/retry-economy.mjs";
import { loadProfile } from "../../plugins/nereus-game/lib/profiles.mjs";

const profile = loadProfile("casual-puzzle");
const base = { income: { base: 10, growth: 1 }, stages: [{ name: "a", cost: 5 }] };
const levels = [{ name: "L1", moves: 20, goal: 15, progress: [0, 2] }];

describe("simulate 의 재시도 배선", () => {
  it("재시도 측정 배선", () => {
    const r = simulate({ profile, economy: { ...base, levels }, turns: 5, seed: 3 });
    expect(r.summary.retry).toEqual(measureRetry({ profile, levels, seed: 3 }));
    const { retry, ...rest } = r.summary;
    expect(rest).toEqual(simulate({ profile, economy: base, turns: 5, seed: 3 }).summary);
    expect(simulate({ profile, economy: { ...base, levels: [] }, turns: 5 }).summary.retry.unmeasured).toContain("levels");
  });

  it("목숨·이어하기 입력을 그대로 넘긴다", () => {
    const economy = { ...base, levels, lives: { cap: 5, regenTurns: 3 }, continueOffer: { moves: 5, price: 900 } };
    const r = simulate({ profile, economy, turns: 5, seed: 3 });
    expect(r.summary.retry).toEqual(measureRetry({ profile, levels, lives: economy.lives, continueOffer: economy.continueOffer, seed: 3 }));
  });

  it("레벨 없는 경제", () => {
    expect(simulate({ profile, economy: base, turns: 5 }).summary).not.toHaveProperty("retry");
    expect(simulate({ profile, economy: { ...base, levels: undefined }, turns: 5 }).summary).not.toHaveProperty("retry");
  });

  it("잘못된 레벨은 시뮬레이터에서도 오류", () => {
    expect(() => simulate({ profile, economy: { ...base, levels: [{ ...levels[0], moves: 0 }] }, turns: 5 })).toThrow(/moves/);
    expect(() => simulate({ profile, economy: { ...base, levels: null }, turns: 5 })).toThrow();
  });
});
