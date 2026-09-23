import { describe, it, expect } from "vitest";
import { budgetVerdict, spentUsd, parseBalance, parsePrices, BUDGET_DEFAULTS } from "../../plugins/nereus/hooks/scripts/lib/budget.mjs";

const NOW = Date.parse("2026-09-24T10:00:00Z");
const min = (m: number) => new Date(NOW - m * 60_000).toISOString();
const b = (over: any = {}) => ({ limitUsd: 10, startBalance: 20, readings: [{ usd: 18, at: min(5), source: "auto" }], plan: null, ...over });

describe("spentUsd", () => {
  it("시작 잔액과 최신 잔액의 차이가 실제 사용액이다", () => {
    expect(spentUsd(b())).toBeCloseTo(2);
    expect(spentUsd(b({ readings: [] }))).toBe(0);
  });
});

describe("budgetVerdict", () => {
  it("예산 파일이 없으면 막는다", () => {
    const v = budgetVerdict({ budget: null, now: NOW, batch: false });
    expect(v.allow).toBe(false);
    expect(v.reason).toContain("예산");
  });
  it("잔액 확인이 오래됐으면 막는다", () => {
    const v = budgetVerdict({ budget: b({ readings: [{ usd: 18, at: min(BUDGET_DEFAULTS.freshMinutes + 1) }] }), now: NOW, batch: false });
    expect(v.allow).toBe(false);
    expect(v.reason).toContain("잔액");
  });
  it("사용액이 예산에 닿으면 막는다", () => {
    expect(budgetVerdict({ budget: b({ readings: [{ usd: 10, at: min(1) }] }), now: NOW, batch: false }).allow).toBe(false);
  });
  it("배치는 비용 계획이 있어야 하고, 계획까지 합쳐 예산 안이어야 한다", () => {
    expect(budgetVerdict({ budget: b(), now: NOW, batch: true }).allow).toBe(false);
    expect(budgetVerdict({ budget: b({ plan: { usd: 3, at: min(2), note: "8컷" } }), now: NOW, batch: true }).allow).toBe(true);
    const over = budgetVerdict({ budget: b({ plan: { usd: 9, at: min(2) } }), now: NOW, batch: true });
    expect(over.allow).toBe(false);
    expect(over.reason).toContain("남은");
  });
  it("조건을 다 채우면 남은 예산을 알려주며 통과한다", () => {
    const v = budgetVerdict({ budget: b(), now: NOW, batch: false });
    expect(v.allow).toBe(true);
    expect(v.remainingUsd).toBeCloseTo(8);
  });
});

describe("parseBalance / parsePrices", () => {
  it("청구 페이지 텍스트에서 잔액을 찾는다", () => {
    expect(parseBalance('heading "Billing"\ntext: "Available balance $12.22"')).toBeCloseTo(12.22);
    expect(parseBalance('text: "Balance" text: "$1,204.50 USD"')).toBeCloseTo(1204.5);
    expect(parseBalance('heading "Welcome to Higgsfield API" Log in')).toBeNull();
  });
  it("실제 스냅샷처럼 가격이 다음 줄에 있어도 읽는다", () => {
    const t = '- link "Kling 3.0, 10 modes" [ref=e29]: "Kling 3.0 10 modes"\n            - text: "up to  1080p 1s / 3s / 15s from $0.084/s 50% OFF from $0.042/s"\n            - button "Expand Kling 2.6, 4 modes" [ref=e30]\n            - link "Kling 2.6, 4 modes" [ref=e31]: "Kling 2.6 4 modes"\n            - text: "—1s / 5s / 10s from $0.07/s 50% OFF from $0.035/s"';
    expect(parsePrices(t)).toEqual({ "Kling 3.0": { usd: 0.084, unit: "s" }, "Kling 2.6": { usd: 0.07, unit: "s" } });
  });
  it("가격 표에서 모델별 초당·장당 가격을 뽑는다", () => {
    const t = 'link "Kling 3.0, 10 modes" text: "up to 1080p 1s / 3s / 15s from $0.084/s 50% OFF from $0.042/s"\nlink "Marketing Studio Image, 3 modes" text: "up to 4k—from $0.0126/image 25% OFF from $0.0095/image"';
    const p = parsePrices(t);
    expect(p["Kling 3.0"]).toEqual({ usd: 0.084, unit: "s" });
    expect(p["Marketing Studio Image"]).toEqual({ usd: 0.0126, unit: "image" });
  });
});
