import { describe, it, expect } from "vitest";
import { levelCost, maxAffordable, rebirthWaitRatios, offlineEarnings, formatNumber } from "../../plugins/nereus-game/lib/economy-curve.mjs";

describe("증분 경제 수식", () => {
  it("다음 레벨 가격은 floor(base * growth^level)", () => {
    expect(levelCost(10, 1.15, 0)).toBe(10);
    expect(levelCost(10, 1.15, 1)).toBe(11);
  });
  it("buy max 는 실제 가격을 걷고 maxLevel 에서 멈춘다", () => {
    expect(maxAffordable({ base: 10, growth: 1.15, owned: 0, balance: 21, maxLevel: 100 })).toEqual({ levels: 2, cost: 21 });
    expect(maxAffordable({ base: 1, growth: 1, owned: 0, balance: 1e9, maxLevel: 50 }).levels).toBe(50);
  });
  it("가격 0 은 무한 루프 대신 던진다", () => {
    expect(() => maxAffordable({ base: 0, growth: 1, owned: 0, balance: 10, maxLevel: 5 })).toThrow();
  });
  it("가산 배율의 환생 대기 비율은 r(1+kp)/(1+(k+1)p)", () => {
    const r = rebirthWaitRatios({ baseRequirement: 1e6, requirementGrowth: 3, multiplierPerRebirth: 0.5 }, 3);
    expect(r[0]).toBeCloseTo(2.0, 9);
    expect(r[1]).toBeCloseTo(2.25, 9);
  });
  it("곱셈 배율의 환생 대기 비율은 r/q 로 일정하다", () => {
    const r = rebirthWaitRatios({ baseRequirement: 1e6, requirementGrowth: 3, multiplierGrowth: 2.4 }, 4);
    for (const x of r) expect(x).toBeCloseTo(1.25, 9);
  });
  it("오프라인 수익은 상한으로 자르고 음수·NaN 시간은 0", () => {
    expect(offlineEarnings({ secondsAway: 100 * 3600, perSecond: 10, maxHours: 8, efficiency: 0.5 })).toBe(144000);
    expect(offlineEarnings({ secondsAway: -5, perSecond: 10, maxHours: 8, efficiency: 0.5 })).toBe(0);
    expect(offlineEarnings({ secondsAway: NaN, perSecond: 10, maxHours: 8, efficiency: 0.5 })).toBe(0);
  });
  it("큰 수 표기는 반올림 후 접미사를 고른다 — 1000.0K 가 아니라 1.0M", () => {
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1500)).toBe("1.5K");
    expect(formatNumber(999950)).toBe("1.0M");
    expect(formatNumber(-2500)).toBe("-2.5K");
    expect(formatNumber(1e66)).toBe("1.0e66");
  });
  it("maxLevel 이 유한하지 않으면 끝없는 루프 대신 던진다", () => {
    expect(() => maxAffordable({ base: 1, growth: 1, owned: 0, balance: Infinity, maxLevel: Infinity })).toThrow();
  });
});
