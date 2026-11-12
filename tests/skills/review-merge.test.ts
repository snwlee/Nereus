import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mergeFindings, gate, parseOcrJson, planRunners, normalizeReviewers, REVIEWERS, fixLoopStep, MAX_FIX_ROUNDS, severityAction, ocrDelegateArgs, probeArgs, readProbe, makeProbe, EGM_PERSONAS } from "../../plugins/nereus/skills/review/scripts/review.mjs";

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
      { source: "egm", file: "z.ts", line: 1, severity: "MEDIUM", message: "m" },
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

// 2026-11-12 사용자 방침: 제3자 검증은 EGM(대화 맥락 없는 Goldfish 서브에이전트) 1순위, 그것만으로 충분하다.
// Gemini 는 이 플러그인에서 무료 이미지 생성에만 쓴다. Codex 는 명시할 때만.
describe("2차 의견 기본은 EGM", () => {
  it("기본·모르는 값은 OCR + EGM 이다", () => {
    expect(normalizeReviewers(undefined)).toEqual(["ocr", "egm"]);
    expect(normalizeReviewers("egm")).toEqual(["ocr", "egm"]);
    expect(normalizeReviewers("weird")).toEqual(["ocr", "egm"]);
  });
  it("이전 설정값 gemini 는 기본으로 읽는다 — 사용자 설정 파일을 깨지 않는다", () => {
    expect(normalizeReviewers("gemini")).toEqual(["ocr", "egm"]);
  });
  // EGM 리뷰 [MEDIUM]: "both" 를 직접 적은 사용자는 Codex 를 고른 것이다. 말없이 빼지 않고 EGM 뒤에 둔다(후순위).
  it("이전 설정값 both 는 EGM 을 앞에 두고 Codex 를 유지한다", () => {
    expect(normalizeReviewers("both")).toEqual(["ocr", "egm", "codex"]);
  });
  // EGM 리뷰 [MEDIUM]: 오타 난 배열이 리뷰를 조용히 끄면 안 된다. 빈 배열만 의도적 끄기다.
  it("모르는 이름뿐인 배열은 기본으로 읽는다 — 빈 배열만 리뷰를 끈다", () => {
    expect(normalizeReviewers(["foo"])).toEqual(["ocr", "egm"]);
    expect(normalizeReviewers([])).toEqual([]);
  });
  it("codex 는 명시할 때만 EGM 에 더해진다", () => {
    expect(normalizeReviewers("codex")).toEqual(["ocr", "egm", "codex"]);
  });
  it("none 이면 OCR 만", () => {
    expect(normalizeReviewers("none")).toEqual(["ocr"]);
  });
  it("배열의 gemini·agy 는 EGM 으로 읽는다 — 실측: 전역 설정이 [\"ocr\",\"gemini\"] 라 걸러내면 2차 의견이 조용히 사라졌다", () => {
    expect(normalizeReviewers(["ocr", "gemini"])).toEqual(["ocr", "egm"]);
    expect(normalizeReviewers(["ocr", "agy"])).toEqual(["ocr", "egm"]);
    expect(normalizeReviewers(["ocr", "gemini", "agy", "egm"])).toEqual(["ocr", "egm"]);
    expect(normalizeReviewers(["ocr", "nope", "codex"])).toEqual(["ocr", "codex"]);
    expect(normalizeReviewers([])).toEqual([]);
  });
  it("Gemini·agy 리뷰어 정의가 없다", () => {
    expect(Object.keys(REVIEWERS).sort()).toEqual(["codex", "egm", "ocr"]);
  });
  it("EGM 은 바이너리가 없다 — PATH·프로브 없이 항상 계획된다", () => {
    let probed = 0;
    const plan = planRunners("egm", () => false, () => { probed += 1; return { ok: false }; });
    expect(plan.egm).toBe(true);
    expect(plan.skipped).toEqual(["ocr"]);
    expect(probed).toBe(0);
  });
  it("설치 여부로 계획을 만든다", () => {
    expect(planRunners("codex", (b: string) => b === "ocr")).toEqual({ ocr: true, egm: true, codex: false, skipped: ["codex"] });
    expect(planRunners("none", () => true)).toEqual({ ocr: true, egm: false, codex: false, skipped: [] });
  });
  it("EGM 페르소나는 goldfish 의 것이고 실재한다", () => {
    expect(EGM_PERSONAS.length).toBeGreaterThan(0);
    for (const p of EGM_PERSONAS) expect(readFileSync(p, "utf8").length, p).toBeGreaterThan(0);
  });
  it("리뷰 스크립트는 Gemini 웹세션을 참조하지 않는다", () => {
    expect(readFileSync("plugins/nereus/skills/review/scripts/review.mjs", "utf8")).not.toMatch(/gemini_cli/);
  });
});

describe("리뷰어 헬스체크 (codex)", () => {
  it("PATH 에 있어도 무응답이면 계획에서 빠진다", () => {
    const plan = planRunners("codex", () => true, (bin: string) => (bin === "codex" ? { ok: false, why: "무응답" } : { ok: true }));
    expect(plan.codex).toBe(false);
    expect(plan.skipped).toContain("codex");
    expect(JSON.stringify(plan.reasons)).toContain("무응답");
  });
  it("응답하는 리뷰어는 포함된다", () => {
    expect(planRunners("codex", () => true, () => ({ ok: true })).codex).toBe(true);
  });
  it("PATH 에 없으면 프로브를 돌리지 않는다", () => {
    let probed = 0;
    planRunners("codex", () => false, () => { probed += 1; return { ok: true }; });
    expect(probed).toBe(0);
  });
  it("probe 를 주지 않으면 reasons 키가 생기지 않는다", () => {
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

// codex: 신뢰되지 않은 cwd 에서 부르면 즉시 거부한다. 저장소 안에서는 정상 응답한다(2026-09-12 조사).
describe("codex 프로브", () => {
  it("git 체크를 건너뛰고 read-only 로 부른다", () => {
    const a = probeArgs("codex");
    expect(a).toContain("exec");
    expect(a).toContain("--skip-git-repo-check");
    expect(a.join(" ")).toContain("--sandbox read-only");
  });
  it("프로브 대상이 아닌 바이너리는 인자가 없다", () => {
    expect(probeArgs("ocr")).toEqual([]);
    expect(probeArgs("agy")).toEqual([]);
    expect(probeArgs("python3")).toEqual([]);
  });
  it("신뢰되지 않은 디렉터리 거부를 사유로 낸다", () => {
    const r = readProbe("codex", { ok: false, status: 1, stdout: "", stderr: "Not inside a trusted directory and --skip-git-repo-check was not specified." });
    expect(r.ok).toBe(false);
    expect(r.why).toContain("신뢰되지 않은 디렉터리");
  });
  it("응답하면 통과한다", () => {
    expect(readProbe("codex", { ok: true, status: 0, stdout: "codex\nPONG\n", stderr: "" }).ok).toBe(true);
  });
  it("exit 0 이면서 빈 출력이면 통과가 아니다", () => {
    const r = readProbe("codex", { ok: true, status: 0, stdout: "   \n", stderr: "" });
    expect(r.ok).toBe(false);
    expect(r.why).toContain("빈 응답");
  });
  it("makeProbe 는 주입된 러너로 프로브를 조립한다", () => {
    const calls: Array<{ bin: string; args: string[] }> = [];
    const probe = makeProbe((bin, args) => { calls.push({ bin, args }); return { ok: true, status: 0, stdout: "PONG", stderr: "" }; });
    expect(probe("codex").ok).toBe(true);
    expect(calls[0].bin).toBe("codex");
  });
  it("프로브 대상이 아닌 바이너리는 통과로 둔다", () => {
    const probe = makeProbe(() => { throw new Error("불려서는 안 된다"); });
    expect(probe("ocr").ok).toBe(true);
  });
});
