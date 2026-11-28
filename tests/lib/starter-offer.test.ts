import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { checkStarterOffer } from "../../plugins/nereus-game/lib/starter-offer.mjs";

type Product = Record<string, unknown>;
const starter = (over: Product = {}) => ({ sku: "starter", price: 0.99, value: 500, oneTime: true, starter: true, ...over });
const pack = (sku: string, price: number, value: number, over: Product = {}) => ({ sku, price, value, ...over });
const codes = (products: Product[]) => checkStarterOffer({ shop: { products } }).violations.map((v: { code: string }) => v.code);

describe("1회 한정 첫 구매 상품", () => {
  it("스타터 없음", () => {
    expect(codes([pack("small", 1.99, 100), pack("big", 9.99, 600)])).toContain("starter-missing");
  });

  it("유료 상품 없음", () => {
    expect(codes([pack("free", 0, 10)])).toEqual([]);
  });

  it("스타터 둘", () => {
    expect(codes([starter(), starter({ sku: "starter-b" }), pack("small", 1.99, 100)])).toContain("starter-duplicate");
  });

  it("1회 한정이 아님", () => {
    expect(codes([starter({ oneTime: false }), pack("small", 1.99, 100)])).toContain("starter-not-one-time");
  });

  it("스타터가 여럿이면 각각 판정", () => {
    const r = checkStarterOffer({ shop: { products: [starter(), starter({ sku: "b", oneTime: undefined }), pack("small", 1.99, 100)] } });
    expect(r.violations.map((v: { code: string }) => v.code)).toContain("starter-duplicate");
    const notOneTime = r.violations.filter((v: { code: string }) => v.code === "starter-not-one-time");
    expect(notOneTime).toHaveLength(1);
    expect(notOneTime[0].sku).toBe("b");
  });

  it("가장 싸지 않음", () => {
    expect(codes([starter({ price: 2.99 }), pack("small", 1.99, 100)])).toContain("starter-not-cheapest");
  });

  it("더 비싼 상품으로 교체", () => {
    const shop = { products: [
      { sku: "starter", price: 0.99, value: 500, oneTime: true, starter: true, replacedBy: "starter2" },
      { sku: "starter2", price: 6.99, value: 500 },
    ] };
    expect(checkStarterOffer({ shop }).violations.map((v: { code: string }) => v.code)).toContain("starter-replaced-pricier");
  });

  it("교체의 교체가 더 비쌈", () => {
    expect(codes([starter({ replacedBy: "same" }), pack("same", 0.99, 500, { replacedBy: "pricier" }), pack("pricier", 4.99, 500)]))
      .toContain("starter-replaced-pricier");
  });

  it("같은 가격 교체", () => {
    expect(codes([starter({ replacedBy: "same" }), pack("same", 0.99, 300), pack("big", 9.99, 600)]))
      .not.toContain("starter-replaced-pricier");
  });

  it("잘못된 상점 데이터", () => {
    const c = (products: unknown) => () => checkStarterOffer({ shop: { products } });
    expect(c([pack("a", 1, 1), pack("a", 2, 2)])).toThrow(/a/);
    expect(c([starter({ replacedBy: "없음" })])).toThrow(/없음/);
    expect(c([starter({ replacedBy: "x" }), pack("x", 1, 1, { replacedBy: "starter" })])).toThrow(/순환/);
    expect(c([pack("neg", -1, 1)])).toThrow(/price/);
    expect(c("nope")).toThrow(/products/);
  });

  it("다른 재화 상품과는 가격을 비교하지 않는다", () => {
    expect(codes([starter(), pack("gems", 0.5, 50, { currency: "gems" }), pack("big", 9.99, 600)])).not.toContain("starter-not-cheapest");
  });

  it("정상 스타터", () => {
    const r = checkStarterOffer({ shop: { products: [starter(), pack("small", 1.99, 100), pack("mid", 4.99, 300), pack("big", 9.99, 700)] } });
    expect(r.violations).toEqual([]);
    expect(r.metrics.starterSku).toBe("starter");
    // 스타터 500/0.99 ≈ 505.05, 비교 상품 50.25·60.12·70.07 의 중앙값 60.12 → 약 8.4배
    expect(r.metrics.valueRatio).toBeCloseTo(8.4, 1);
  });
});

describe("starter-offer CLI", () => {
  it("위반이 있어도 0, 깨진 입력은 1", () => {
    const cli = "plugins/nereus-game/lib/starter-offer.mjs";
    const ok = spawnSync(process.execPath, [cli], { input: JSON.stringify({ shop: { products: [pack("a", 1, 1)] } }), encoding: "utf8" });
    expect(ok.status).toBe(0);
    expect(JSON.parse(ok.stdout).violations[0].code).toBe("starter-missing");
    const bad = spawnSync(process.execPath, [cli], { input: "{", encoding: "utf8" });
    expect(bad.status).toBe(1);
  });
});
