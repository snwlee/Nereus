import { describe, it, expect } from "vitest";
import { mergeFindings, gate, parseOcrJson, planRunners, normalizeReviewers, REVIEWERS, fixLoopStep, MAX_FIX_ROUNDS, severityAction, ocrDelegateArgs } from "../../plugins/nereus/skills/review/scripts/review.mjs";

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
  it("수정 루프 상한은 5라운드다", () => {
    expect(MAX_FIX_ROUNDS).toBe(5);
  });
  it("잔여 blocking이 없으면 done", () => {
    expect(fixLoopStep(0, 0)).toEqual({ action: "done" });
    expect(fixLoopStep(3, 0)).toEqual({ action: "done" });
  });
  it("1~3라운드는 resume (같은 맥락 이어서)", () => {
    expect(fixLoopStep(0, 2)).toEqual({ action: "resume", round: 1 });
    expect(fixLoopStep(2, 1)).toEqual({ action: "resume", round: 3 });
  });
  it("4~5라운드는 escalate (fresh + 상위 모델)", () => {
    expect(fixLoopStep(3, 1)).toEqual({ action: "escalate", round: 4 });
    expect(fixLoopStep(4, 2)).toEqual({ action: "escalate", round: 5 });
  });
  it("5라운드를 넘기면 breaker (사용자 판정)", () => {
    expect(fixLoopStep(5, 1)).toEqual({ action: "breaker" });
  });
});

describe("severityAction", () => {
  it("CRITICAL enters loop as fix-now", () => {
    expect(severityAction("CRITICAL")).toBe("fix-now");
  });
  it("HIGH enters loop as must-resolve", () => {
    expect(severityAction("HIGH")).toBe("must-resolve");
  });
  it("MEDIUM and below defer to ledger", () => {
    expect(severityAction("MEDIUM")).toBe("defer-ledger");
    expect(severityAction("LOW")).toBe("defer-ledger");
    expect(severityAction("INFO")).toBe("defer-ledger");
  });
  it("unknown defaults to defer-ledger", () => {
    expect(severityAction("UNKNOWN")).toBe("defer-ledger");
    expect(severityAction(undefined)).toBe("defer-ledger");
  });
});

describe("리뷰어 헬스체크", () => {
  it("PATH 에 있어도 무응답이면 계획에서 빠진다", () => {
    const probe = (bin: string) => (bin === "agy" ? { ok: false, why: "무응답" } : { ok: true });
    const plan = planRunners("both", () => true, probe);
    expect(plan.gemini).toBe(false);
    expect(plan.skipped).toContain("gemini");
    expect(JSON.stringify(plan.reasons)).toContain("agy");
    expect(JSON.stringify(plan.reasons)).toContain("무응답");
  });

  it("응답하는 리뷰어는 포함된다", () => {
    const plan = planRunners("codex", () => true, () => ({ ok: true }));
    expect(plan.codex).toBe(true);
  });

  it("PATH 에 없으면 프로브를 돌리지 않는다", () => {
    let probed = 0;
    planRunners("both", () => false, () => { probed += 1; return { ok: true }; });
    expect(probed).toBe(0);
  });

  it("probe 를 주지 않으면 기존 계약 그대로다 — reasons 키가 생기지 않는다", () => {
    const plan = planRunners("codex", () => true);
    expect(plan.codex).toBe(true);
    expect(plan).not.toHaveProperty("reasons");
  });
});

describe("ocrDelegateArgs", () => {
  it("base 가 있으면 범위 인자를 만든다", () => {
    expect(ocrDelegateArgs("main")).toEqual(["--from", "main", "--to", "HEAD"]);
  });

  it("base 가 없으면 범위 인자 없이 워크스페이스 모드", () => {
    expect(ocrDelegateArgs()).toEqual([]);
    expect(ocrDelegateArgs("")).toEqual([]);
  });

  it("공백만 있는 base 도 워크스페이스 모드", () => {
    expect(ocrDelegateArgs("   ")).toEqual([]);
  });
});
