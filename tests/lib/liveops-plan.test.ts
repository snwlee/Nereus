import { describe, it, expect } from "vitest";
import { checkLiveops } from "../../plugins/nereus-game/lib/liveops-plan.mjs";

const profile = { liveops: { retentionDriftPct: 20 } };
const ev = (name: string, start: number, end: number, rollback = "flag off") => ({ name, start, end, rollback });
const okPlan = {
  events: [ev("halloween", 1, 5), ev("winter", 6, 9)],
  economy: { sources: [{ name: "quest", amount: 100 }], sinks: [{ name: "shop", amount: 90 }] },
  retention: { d1: 0.4, d7: 0.2, d30: 0.1 },
};
const codes = (r: any) => r.violations.map((v: any) => v.code);

describe("liveops plan", () => {
  it("정합한 계획에는 위반이 없다", () => {
    expect(checkLiveops({ profile, plan: okPlan }).violations).toEqual([]);
  });
  it("이벤트 구간이 겹치면 overlap", () => {
    const plan = { ...okPlan, events: [ev("a", 1, 5), ev("b", 4, 8)] };
    const r = checkLiveops({ profile, plan });
    expect(codes(r)).toContain("overlap");
    expect(r.violations.find((v: any) => v.code === "overlap").events).toEqual(["a", "b"]);
  });
  it("구간이 닿기만 하면 겹침이 아니다", () => {
    const plan = { ...okPlan, events: [ev("a", 1, 5), ev("b", 5, 8)] };
    expect(codes(checkLiveops({ profile, plan }))).not.toContain("overlap");
  });
  it("소스만 있고 싱크가 없으면 no-sink", () => {
    const plan = { ...okPlan, economy: { sources: [{ name: "quest", amount: 100 }], sinks: [] } };
    expect(codes(checkLiveops({ profile, plan }))).toContain("no-sink");
  });
  it("리텐션이 뒤로 갈수록 올라가면 retention-shape", () => {
    const plan = { ...okPlan, retention: { d1: 0.2, d7: 0.4, d30: 0.1 } };
    expect(codes(checkLiveops({ profile, plan }))).toContain("retention-shape");
  });
  it("롤백 선언이 없는 이벤트는 no-rollback", () => {
    const plan = { ...okPlan, events: [{ name: "halloween", start: 1, end: 5 }] };
    const r = checkLiveops({ profile, plan });
    expect(codes(r)).toContain("no-rollback");
    expect(r.violations.find((v: any) => v.code === "no-rollback").event).toBe("halloween");
  });
  it("지표가 없으면 그 항목만 unmeasured 로 남고 나머지는 판정한다", () => {
    const r = checkLiveops({ profile, plan: okPlan });
    expect(r.unmeasured).toContain("retention-actual");
    expect(r.violations).toEqual([]);
  });
  it("지표를 주입하면 편차를 판정하고 unmeasured 가 비워진다", () => {
    const r = checkLiveops({ profile, plan: okPlan, metrics: { retention: { d1: 0.2, d7: 0.1, d30: 0.05 } } });
    expect(codes(r)).toContain("retention-drift");
    expect(r.unmeasured).toEqual([]);
  });
  it("가정과 가까운 실측이면 편차 위반이 없다", () => {
    const r = checkLiveops({ profile, plan: okPlan, metrics: { retention: { d1: 0.38, d7: 0.19, d30: 0.1 } } });
    expect(codes(r)).not.toContain("retention-drift");
  });
});

describe("liveops plan — 재방문 훅 주기표", () => {
  const hook = (over: any = {}) => ({ name: "energy-refill", intervalHours: 4, actor: "system", ...over });
  it("훅 축을 주지 않으면 훅 검사를 하지 않는다", () => {
    expect(checkLiveops({ profile, plan: okPlan }).violations).toEqual([]);
  });
  it("주기와 발신자가 적힌 훅은 위반이 없다", () => {
    const plan = { ...okPlan, hooks: [hook(), hook({ name: "friend-gift", actor: "player" })] };
    expect(checkLiveops({ profile, plan }).violations).toEqual([]);
  });
  it("주기가 없거나 0 이하인 훅은 hook-no-interval", () => {
    const plan = { ...okPlan, hooks: [hook({ intervalHours: undefined }), hook({ name: "b", intervalHours: 0 })] };
    const r = checkLiveops({ profile, plan });
    expect(r.violations.filter((v: any) => v.code === "hook-no-interval").map((v: any) => v.hook)).toEqual(["energy-refill", "b"]);
  });
  it("발신자를 적지 않은 훅은 hook-actor-undeclared — 위장 여부를 판정할 수 없다", () => {
    const plan = { ...okPlan, hooks: [hook({ actor: undefined })] };
    expect(codes(checkLiveops({ profile, plan }))).toContain("hook-actor-undeclared");
  });
  it("NPC 발신 훅이 NPC 로 표기되지 않으면 bot-disguised", () => {
    const plan = { ...okPlan, hooks: [hook({ name: "raid", actor: "npc" })] };
    const r = checkLiveops({ profile, plan });
    expect(codes(r)).toContain("bot-disguised");
    expect(r.violations.find((v: any) => v.code === "bot-disguised").hook).toBe("raid");
  });
  it("NPC 발신 훅이 npcLabeled: true 면 통과", () => {
    const plan = { ...okPlan, hooks: [hook({ name: "raid", actor: "npc", npcLabeled: true })] };
    expect(codes(checkLiveops({ profile, plan }))).not.toContain("bot-disguised");
  });
});
