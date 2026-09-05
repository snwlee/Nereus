import { describe, it, expect } from "vitest";
import { parseLearnings, addLearning, selectForInjection, isCorrection } from "../../plugins/nereus/hooks/scripts/lib/learnings.mjs";

const entry = (rule: string, over: any = {}) => ({ trigger: "t", rule, source: "correction", confidence: 0.5, hits: 1, at: 1000, ...over });

describe("learnings", () => {
  it("parses jsonl and skips malformed or ruleless lines", () => {
    const jsonl = [JSON.stringify(entry("A")), "not json", "{}", JSON.stringify(entry("B"))].join("\n");
    expect(parseLearnings(jsonl).map((e: any) => e.rule)).toEqual(["A", "B"]);
    expect(parseLearnings("")).toEqual([]);
  });
  it("adds a new rule with default confidence", () => {
    const out = addLearning([], { trigger: "PDF 만들 때", rule: "폰트는 Noto Sans KR", source: "preference" }, { now: 5 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ rule: "폰트는 Noto Sans KR", confidence: 0.5, hits: 1, at: 5 });
  });
  it("re-confirming an existing rule bumps confidence and hits instead of duplicating", () => {
    const before = [entry("같은 규칙", { confidence: 0.5, hits: 1 })];
    const after = addLearning(before, { trigger: "t", rule: "같은 규칙", source: "correction" }, { now: 9 });
    expect(after).toHaveLength(1);
    expect(after[0].hits).toBe(2);
    expect(after[0].confidence).toBeCloseTo(0.7);
    expect(before[0].hits).toBe(1);
  });
  it("caps confidence at 1", () => {
    let list = [entry("x", { confidence: 0.95, hits: 5 })];
    list = addLearning(list, { trigger: "t", rule: "x", source: "correction" });
    expect(list[0].confidence).toBe(1);
  });
  it("injects only high-confidence rules, newest first, within a char budget", () => {
    const list = [
      entry("낮은 신뢰", { confidence: 0.3, at: 100 }),
      entry("오래된 규칙", { confidence: 0.9, at: 100 }),
      entry("최근 규칙", { confidence: 0.9, at: 200 }),
    ];
    const out = selectForInjection(list, { minConfidence: 0.7, limit: 8, maxChars: 400 });
    expect(out).toContain("최근 규칙");
    expect(out).toContain("오래된 규칙");
    expect(out).not.toContain("낮은 신뢰");
    expect(out.indexOf("최근 규칙")).toBeLessThan(out.indexOf("오래된 규칙"));
  });
  it("returns an empty string when nothing qualifies, and honors the char budget", () => {
    expect(selectForInjection([entry("x", { confidence: 0.2 })], { minConfidence: 0.7 })).toBe("");
    const many = Array.from({ length: 30 }, (_, i) => entry("규칙".repeat(20) + i, { confidence: 0.9, at: i }));
    expect(selectForInjection(many, { minConfidence: 0.7, limit: 8, maxChars: 300 }).length).toBeLessThanOrEqual(300);
  });
  it("detects correction-shaped prompts in Korean and English", () => {
    for (const p of ["아니 그게 아니라 이렇게 해", "틀렸어", "그렇게 하지 마", "no, actually use vitest", "don't do that", "다시 해줘 잘못됐어"]) {
      expect(isCorrection(p)).toBe(true);
    }
    for (const p of ["테스트 돌려줘", "이거 구현해줘", "PDF로 만들어", "no problem"]) expect(isCorrection(p)).toBe(false);
  });
});
