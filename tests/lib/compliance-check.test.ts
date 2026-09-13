import { describe, it, expect } from "vitest";
import { checkPaidRandom } from "../../plugins/nereus-game/lib/compliance-check.mjs";
import { loadPolicy } from "../../plugins/nereus-game/lib/policy.mjs";

const policy = loadPolicy();
const codes = (r: any) => r.violations.map((v: any) => v.code);
const box = (over: any = {}) => ({
  name: "egg", paid: true, disclosedBeforePurchase: true, disclosureSurfaces: ["game"],
  outcomes: [{ item: "common", odds: 90 }, { item: "rare", odds: 9.5 }, { item: "legendary", odds: 0.5 }],
  ...over,
});
const plan = (over: any = {}) => ({ markets: [], restrictedFallback: "확정 구매 상자 제공", boxes: [box()], luckItems: [], ...over });

describe("paid random items", () => {
  it("정합한 계획에는 위반이 없다", () => {
    expect(checkPaidRandom({ policy, plan: plan() }).violations).toEqual([]);
  });

  it("확률 합이 100 이 아니면 odds-sum", () => {
    const p = plan({ boxes: [box({ outcomes: [{ item: "a", odds: 50 }, { item: "b", odds: 30 }] })] });
    const r = checkPaidRandom({ policy, plan: p });
    expect(codes(r)).toContain("odds-sum");
    expect(r.violations.find((v: any) => v.code === "odds-sum").box).toBe("egg");
    expect(r.violations.find((v: any) => v.code === "odds-sum").sum).toBe(80);
  });

  it("부동소수점 오차는 위반이 아니다 — 정상인 계획을 잡으면 게이트를 못 쓴다", () => {
    const p = plan({ boxes: [box({ outcomes: [{ item: "a", odds: 33.33 }, { item: "b", odds: 33.33 }, { item: "c", odds: 33.34 }] })] });
    expect(codes(checkPaidRandom({ policy, plan: p }))).not.toContain("odds-sum");
  });

  it("소수 4자리 이상 + 면책 문구면 합이 100 이 아니어도 통과한다", () => {
    const p = plan({ boxes: [box({ outcomes: [{ item: "a", odds: 99.99995 }, { item: "b", odds: 0.00001 }], roundingDisclaimer: true })] });
    expect(codes(checkPaidRandom({ policy, plan: p }))).not.toContain("odds-sum");
  });

  it("소수 4자리 이상인데 면책 문구가 없으면 여전히 odds-sum", () => {
    const p = plan({ boxes: [box({ outcomes: [{ item: "a", odds: 99.99995 }, { item: "b", odds: 0.00001 }] })] });
    expect(codes(checkPaidRandom({ policy, plan: p }))).toContain("odds-sum");
  });

  it("결과가 비어 있으면 no-outcomes", () => {
    const p = plan({ boxes: [box({ outcomes: [] })] });
    expect(codes(checkPaidRandom({ policy, plan: p }))).toContain("no-outcomes");
  });

  it("구매 전 공개 선언이 없으면 odds-undisclosed", () => {
    const p = plan({ boxes: [box({ disclosedBeforePurchase: false })] });
    expect(codes(checkPaidRandom({ policy, plan: p }))).toContain("odds-undisclosed");
  });

  it("한국 시장인데 광고 표면이 빠지면 disclosure-surface", () => {
    const p = plan({ markets: ["KR"], boxes: [box({ disclosureSurfaces: ["game", "website"] })] });
    const r = checkPaidRandom({ policy, plan: p });
    expect(codes(r)).toContain("disclosure-surface");
    expect(r.violations.find((v: any) => v.code === "disclosure-surface").missing).toEqual(["ad"]);
  });

  it("한국 시장에 세 표면을 다 갖추면 통과한다", () => {
    const p = plan({ markets: ["KR"], boxes: [box({ disclosureSurfaces: ["game", "website", "ad"] })] });
    expect(codes(checkPaidRandom({ policy, plan: p }))).not.toContain("disclosure-surface");
  });

  it("무료 랜덤은 확률 검사를 건너뛴다 — 정책의 명시적 예외다", () => {
    const p = plan({ boxes: [{ name: "free-chest", paid: false }] });
    const r = checkPaidRandom({ policy, plan: p });
    expect(codes(r)).not.toContain("odds-sum");
    expect(codes(r)).not.toContain("no-outcomes");
    expect(codes(r)).not.toContain("odds-undisclosed");
  });

  it("럭 아이템에 수치 설명이 없으면 luck-effect-unexplained", () => {
    const p = plan({ luckItems: [{ name: "lucky-potion", affects: ["egg"], numericEffect: "", dynamicUpdate: true }] });
    const r = checkPaidRandom({ policy, plan: p });
    expect(codes(r)).toContain("luck-effect-unexplained");
    expect(r.violations.find((v: any) => v.code === "luck-effect-unexplained").item).toBe("lucky-potion");
  });

  it("럭 아이템에 동적 갱신 선언이 없으면 luck-no-dynamic-update", () => {
    const p = plan({ luckItems: [{ name: "lucky-potion", affects: ["egg"], numericEffect: "legendary 0.5% → 1.5%", dynamicUpdate: false }] });
    expect(codes(checkPaidRandom({ policy, plan: p }))).toContain("luck-no-dynamic-update");
  });

  it("럭 아이템이 없는 상자를 가리키면 luck-target-missing", () => {
    const p = plan({ luckItems: [{ name: "lucky-potion", affects: ["nope"], numericEffect: "x2", dynamicUpdate: true }] });
    const r = checkPaidRandom({ policy, plan: p });
    expect(codes(r)).toContain("luck-target-missing");
    expect(r.violations.find((v: any) => v.code === "luck-target-missing").target).toBe("nope");
  });

  it("1회성 결과가 있는데 남은 확률 갱신 선언이 없으면 unique-no-remaining-odds", () => {
    const p = plan({ boxes: [box({ hasUniqueOutcomes: true, dynamicRemainingOdds: false })] });
    expect(codes(checkPaidRandom({ policy, plan: p }))).toContain("unique-no-remaining-odds");
  });

  it("금지 지역 대체 경로가 없으면 no-restricted-fallback", () => {
    expect(codes(checkPaidRandom({ policy, plan: plan({ restrictedFallback: "" }) }))).toContain("no-restricted-fallback");
  });

  it("유료 확률 아이템이 없으면 대체 경로도 필요 없다", () => {
    const p = plan({ restrictedFallback: "", boxes: [{ name: "free-chest", paid: false }] });
    expect(codes(checkPaidRandom({ policy, plan: p }))).not.toContain("no-restricted-fallback");
  });
});
