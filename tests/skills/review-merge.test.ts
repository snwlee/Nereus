import { describe, it, expect } from "vitest";
import { mergeFindings, gate, parseOcrJson, planRunners, normalizeReviewers, REVIEWERS } from "../../plugins/nereus/skills/review/scripts/review.mjs";

describe("review merge", () => {
  it("parses OCR json output into normalized findings", () => {
    const raw = JSON.stringify({ comments: [{ file: "a.ts", line: 3, severity: "high", content: "null deref" }, { file: "b.ts", line: 9, severity: "LOW", content: "style" }] });
    const f = parseOcrJson(raw);
    expect(f).toEqual([
      { source: "ocr", file: "a.ts", line: 3, severity: "HIGH", message: "null deref" },
      { source: "ocr", file: "b.ts", line: 9, severity: "LOW", message: "style" },
    ]);
    expect(parseOcrJson("garbage")).toEqual([]);
  });
  it("merges and sorts by severity then file", () => {
    const md = mergeFindings([
      { source: "gemini", file: "z.ts", line: 1, severity: "MEDIUM", message: "m" },
      { source: "ocr", file: "a.ts", line: 3, severity: "CRITICAL", message: "c" },
      { source: "codex", file: "a.ts", line: 5, severity: "HIGH", message: "h" },
    ]);
    expect(md.indexOf("CRITICAL")).toBeLessThan(md.indexOf("HIGH"));
    expect(md.indexOf("HIGH")).toBeLessThan(md.indexOf("MEDIUM"));
    expect(md).toContain("a.ts:3");
  });
  it("gate fails on CRITICAL or HIGH", () => {
    expect(gate([{ severity: "MEDIUM" }, { severity: "LOW" }])).toEqual({ pass: true, blocking: 0 });
    expect(gate([{ severity: "HIGH" }, { severity: "CRITICAL" }])).toEqual({ pass: false, blocking: 2 });
  });
  it("설정 문자열 단축형을 리뷰어 목록으로 편다", () => {
    expect(normalizeReviewers("both")).toEqual(["ocr", "codex", "gemini"]);
    expect(normalizeReviewers("codex")).toEqual(["ocr", "codex"]);
    expect(normalizeReviewers("gemini")).toEqual(["ocr", "gemini"]);
    expect(normalizeReviewers("none")).toEqual(["ocr"]);
  });
  it("배열 형식으로 리뷰어를 직접 고를 수 있다", () => {
    expect(normalizeReviewers(["codex"])).toEqual(["codex"]);
    expect(normalizeReviewers(["ocr", "gemini"])).toEqual(["ocr", "gemini"]);
    expect(normalizeReviewers([])).toEqual([]);
    expect(normalizeReviewers(["ocr", "nope", "codex"])).toEqual(["ocr", "codex"]); // 모르는 이름은 무시
  });
  it("알 수 없는 값은 기본값(both)으로 되돌린다", () => {
    expect(normalizeReviewers(undefined)).toEqual(["ocr", "codex", "gemini"]);
    expect(normalizeReviewers("weird")).toEqual(["ocr", "codex", "gemini"]);
  });
  it("설치 여부로 실행 계획을 만든다", () => {
    const avail = (b: string) => ["ocr", "agy"].includes(b);
    expect(planRunners("both", avail)).toEqual({ ocr: true, codex: false, gemini: true, skipped: ["codex"] });
    expect(planRunners("codex", avail)).toEqual({ ocr: true, codex: false, gemini: false, skipped: ["codex"] });
    expect(planRunners("gemini", (b: string) => b === "agy")).toEqual({ ocr: false, codex: false, gemini: true, skipped: ["ocr"] });
  });
  it("none 이면 2차 의견 없이 OCR 만 돈다", () => {
    expect(planRunners("none", () => true)).toEqual({ ocr: true, codex: false, gemini: false, skipped: [] });
  });
  it("배열로 codex 만 끌 수 있다", () => {
    expect(planRunners(["ocr", "gemini"], () => true)).toEqual({ ocr: true, codex: false, gemini: true, skipped: [] });
  });
  it("리뷰어 정의에 실행 바이너리가 붙어 있다", () => {
    expect(REVIEWERS.gemini.bin).toBe("agy");
    expect(REVIEWERS.codex.bin).toBe("codex");
  });
});
