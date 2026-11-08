import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { checkPacing } from "../../plugins/nereus-game/lib/economy-curve.mjs";
import { loadProfile } from "../../plugins/nereus-game/lib/profiles.mjs";

const profile = loadProfile("sim-tycoon");
const base = {
  upgrades: [{ id: "Income", baseCost: 10, costGrowth: 1.15, maxLevel: 40 }],
  rebirth: { baseRequirement: 1e6, requirementGrowth: 1.8, multiplierPerRebirth: 0.5 },
  offline: { maxHours: 8, efficiency: 0.5 },
  peakBalance: 1e12,
};
const codes = (r: any) => r.violations.map((v: any) => v.code);

describe("페이싱 판정", () => {
  it("r=1.8 · p=0.5 · 8시간 · 0.5 는 통과한다", () => {
    const r = checkPacing({ profile, config: base });
    expect(r.violations).toEqual([]);
    expect(r.unmeasured).toEqual([]);
  });
  it("r=3 이면 환생이 갈수록 2배 넘게 느려진다", () => {
    const r = checkPacing({ profile, config: { ...base, rebirth: { ...base.rebirth, requirementGrowth: 3 } } });
    expect(codes(r)).toContain("rebirth-ratio");
  });
  it("50번 사는 업그레이드에 1.5 성장은 가파르다", () => {
    const r = checkPacing({ profile, config: { ...base, upgrades: [{ id: "X", baseCost: 10, costGrowth: 1.5, maxLevel: 50 }] } });
    expect(codes(r)).toContain("steep-growth");
  });
  it("가격 0 업그레이드는 buy max 를 멈추지 못한다", () => {
    const r = checkPacing({ profile, config: { ...base, upgrades: [{ id: "X", baseCost: 0, costGrowth: 1.1, maxLevel: 10 }] } });
    expect(codes(r)).toContain("free-upgrade");
  });
  it("오프라인 효율·상한이 범위를 벗어나면 위반", () => {
    const r = checkPacing({ profile, config: { ...base, offline: { maxHours: 48, efficiency: 0.9 } } });
    expect(codes(r)).toEqual(expect.arrayContaining(["offline-cap", "offline-efficiency"]));
  });
  it("잔액이 1e15 를 넘으면 정밀도 위반", () => {
    expect(codes(checkPacing({ profile, config: { ...base, peakBalance: 1e16 } }))).toContain("precision");
  });
  it("pacing 기준이 없는 장르는 no-baseline", () => {
    expect(codes(checkPacing({ profile: loadProfile("obby-platformer"), config: base }))).toEqual(["no-baseline"]);
  });
  it("환생·오프라인이 없으면 통과가 아니라 미측정", () => {
    const r = checkPacing({ profile, config: { upgrades: base.upgrades } });
    expect(r.unmeasured).toEqual(expect.arrayContaining(["rebirth", "offline", "peakBalance"]));
  });
  it("프로세스로 돌면 stdout JSON 을 낸다", () => {
    const out = execFileSync("node", ["plugins/nereus-game/lib/economy-curve.mjs"], {
      input: JSON.stringify({ genre: "sim-tycoon", config: { ...base, rebirth: { ...base.rebirth, requirementGrowth: 3 } } }),
      encoding: "utf8",
    });
    expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("rebirth-ratio");
  });
  // 리뷰 R1: NaN 비교는 전부 false 라 빠진 필드가 위반 0 으로 통과했다.
  it("환생·오프라인 필드가 숫자가 아니면 통과가 아니라 던진다", () => {
    expect(() => checkPacing({ profile, config: { ...base, rebirth: { baseRequirement: 1e6 } } })).toThrow(/rebirth/);
    expect(() => checkPacing({ profile, config: { ...base, offline: { maxHours: 8 } } })).toThrow(/offline/);
    expect(() => checkPacing({ profile, config: { ...base, upgrades: [{ id: "X", baseCost: 10, costGrowth: "1.1", maxLevel: 10 }] } })).toThrow(/X/);
  });
});
