// 텍스처 슬롯 목록은 **three.js 가 정하고 three.js 가 바꾸는 값**이다.
// 코드에 박으면 상류가 슬롯을 늘릴 때 검사기가 조용히 불완전해진다.
import { describe, it, expect } from "vitest";
import { loadBudgetData } from "../../plugins/nereus-3d/lib/budget-data.mjs";

describe("텍스처 슬롯 데이터", () => {
  it("슬롯 목록이 데이터다", () => {
    const d = loadBudgetData();
    expect(d.textureSlots).toContain("map");
    expect(d.textureSlots).toContain("normalMap");
    expect(d.textureSlots.length).toBeGreaterThanOrEqual(8);
  });

  it("출처와 확인일이 있다", () => {
    const d = loadBudgetData();
    expect(d.source).toMatch(/^https:\/\//);
    expect(d.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("왜 데이터인지 적혀 있다", () => {
    expect(loadBudgetData().textureSlotsWhy.length).toBeGreaterThan(0);
  });

  it("중복 슬롯이 없다", () => {
    const s = loadBudgetData().textureSlots;
    expect(s.length).toBe(new Set(s).size);
  });

  // 예산은 **운영값**이다. 기기 등급·해상도·씬 복잡도가 정한다.
  // 정책 데이터 파일에 넣으면 정책인 척하면서 낡는다.
  it("예산 기본 수치를 데이터에 넣지 않는다 — 운영값이라 낡는다", () => {
    const d = loadBudgetData();
    expect(d).not.toHaveProperty("budgets");
    expect(d).not.toHaveProperty("defaultBudgets");
  });

  it("깨진 데이터는 사유 있는 오류로 던진다", () => {
    expect(() => loadBudgetData("/nope/missing.json")).toThrow();
  });
});
