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

describe("판정", () => {
  it("도달 불가능한 단계를 병목으로 보고한다", () => {
    const wall = { income: { base: 1, growth: 1.0 }, stages: [{ name: "벽", cost: 1e9 }] };
    const r = simulate({ profile: loadProfile("sim-tycoon"), economy: wall, turns: 20, seed: 1 });
    expect(r.summary.bottlenecks).toContain("벽");
  });

  it("수입 증가가 비용 증가를 앞지르면 인플레가 양수", () => {
    const hot = { income: { base: 10, growth: 1.5 }, stages: [{ name: "a", cost: 20 }, { name: "b", cost: 30 }] };
    const r = simulate({ profile: loadProfile("sim-tycoon"), economy: hot, turns: 20, seed: 1 });
    expect(r.summary.inflation).toBeGreaterThan(0);
  });

  it("오비 프로파일은 난이도 절벽 구간을 낸다", () => {
    const obby = { income: { base: 1, growth: 1.0 }, stages: [{ name: "s1", cost: 1 }, { name: "s2", cost: 99 }] };
    const r = simulate({ profile: loadProfile("obby-platformer"), economy: obby, turns: 20, seed: 1 });
    expect(Array.isArray(r.summary.cliffs)).toBe(true);
    expect(r.summary.cliffs.length).toBeGreaterThan(0);
  });
});

describe("지배 전략", () => {
  const stages = [{ name: "s", cost: 10 }];

  it("한 선택지가 압도하면 보고한다", () => {
    const eco = {
      income: { base: 10, growth: 1 },
      stages,
      options: [
        { name: "강검", cost: 10, effect: 500 },
        { name: "평검", cost: 10, effect: 10 },
        { name: "약검", cost: 10, effect: 8 },
      ],
    };
    const r = simulate({ profile: loadProfile("battle-pvp"), economy: eco, turns: 5, seed: 1 });
    expect(r.summary.dominant).toContain("강검");
  });

  it("균형 잡히면 비어 있다", () => {
    const eco = {
      income: { base: 10, growth: 1 },
      stages,
      options: [
        { name: "a", cost: 10, effect: 10 },
        { name: "b", cost: 10, effect: 11 },
        { name: "c", cost: 10, effect: 9 },
      ],
    };
    const r = simulate({ profile: loadProfile("battle-pvp"), economy: eco, turns: 5, seed: 1 });
    expect(r.summary.dominant).toEqual([]);
  });

  it("선택지가 없으면 빈 배열", () => {
    const r = simulate({ profile: loadProfile("narrative"), economy: { income: { base: 1, growth: 1 }, stages }, turns: 5, seed: 1 });
    expect(r.summary.dominant).toEqual([]);
  });
});
