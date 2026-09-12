import { describe, it, expect } from "vitest";
import { mergeFindings, gate, parseOcrJson, planRunners, normalizeReviewers, REVIEWERS, fixLoopStep, MAX_FIX_ROUNDS, severityAction, ocrDelegateArgs, probeArgs, readProbe, makeProbe } from "../../plugins/nereus/skills/review/scripts/review.mjs";

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

// 프로브 실체. 2026-09-12 조사로 두 CLI 의 실패 양상이 서로 다르다는 것이 확인됐다.
//  - codex: 신뢰되지 않은 cwd 에서 부르면 즉시 거부한다. 저장소 안에서는 정상 응답한다.
//  - agy : text 출력에서는 429 재시도가 전부 삼켜져 "빈 출력 + exit 0" 으로 보인다. json 으로 받아야 사유가 나온다.
describe("리뷰어 프로브 실체", () => {
  it("codex 프로브는 git 체크를 건너뛰고 read-only 로 부른다", () => {
    const a = probeArgs("codex");
    expect(a).toContain("exec");
    expect(a).toContain("--skip-git-repo-check");
    expect(a.join(" ")).toContain("--sandbox read-only");
  });

  it("agy 프로브는 json 으로 받는다 — text 는 오류를 삼킨다", () => {
    const a = probeArgs("agy");
    expect(a.join(" ")).toContain("--output-format json");
    expect(a).toContain("-p");
  });

  it("모르는 바이너리는 프로브 인자가 없다", () => {
    expect(probeArgs("ocr")).toEqual([]);
  });

  it("codex 가 신뢰되지 않은 디렉터리를 거부하면 사유를 그대로 낸다", () => {
    const r = readProbe("codex", { ok: false, status: 1, stdout: "", stderr: "Not inside a trusted directory and --skip-git-repo-check was not specified." });
    expect(r.ok).toBe(false);
    expect(r.why).toContain("신뢰되지 않은 디렉터리");
  });

  it("codex 가 응답하면 통과한다", () => {
    expect(readProbe("codex", { ok: true, status: 0, stdout: "codex\nPONG\n", stderr: "" }).ok).toBe(true);
  });

  it("codex 가 exit 0 이면서 빈 출력이면 통과가 아니다", () => {
    const r = readProbe("codex", { ok: true, status: 0, stdout: "   \n", stderr: "" });
    expect(r.ok).toBe(false);
    expect(r.why).toContain("빈 응답");
  });

  it("agy 의 429 는 결함이 아니라 할당량 소진으로 보고한다", () => {
    const stdout = JSON.stringify({ status: "ERROR", response: "", error: "API error (attempt 7): RESOURCE_EXHAUSTED (code 429): Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 94h15m29s." });
    const r = readProbe("agy", { ok: true, status: 0, stdout, stderr: "" });
    expect(r.ok).toBe(false);
    expect(r.why).toContain("할당량 소진");
    expect(r.why).toContain("94h15m29s");
  });

  it("agy 가 응답을 담아 오면 통과한다", () => {
    const stdout = JSON.stringify({ status: "OK", response: "PONG" });
    expect(readProbe("agy", { ok: true, status: 0, stdout, stderr: "" }).ok).toBe(true);
  });

  it("agy 가 빈 출력 + exit 0 이면 통과가 아니다 — 이것이 세 사이클을 속인 양상이다", () => {
    const r = readProbe("agy", { ok: true, status: 0, stdout: "", stderr: "" });
    expect(r.ok).toBe(false);
    expect(r.why).toContain("빈 응답");
  });

  it("makeProbe 는 주입된 러너로 프로브를 조립한다", () => {
    const calls: Array<{ bin: string; args: string[] }> = [];
    const probe = makeProbe((bin, args) => {
      calls.push({ bin, args });
      return { ok: true, status: 0, stdout: JSON.stringify({ status: "OK", response: "PONG" }), stderr: "" };
    });
    expect(probe("agy").ok).toBe(true);
    expect(calls[0].bin).toBe("agy");
    expect(calls[0].args.join(" ")).toContain("--output-format json");
  });

  it("프로브 대상이 아닌 바이너리는 통과로 둔다 — 프로브 없음이 실패는 아니다", () => {
    const probe = makeProbe(() => { throw new Error("불려서는 안 된다"); });
    expect(probe("ocr").ok).toBe(true);
  });

  // codex 2차 의견(2026-09-12, HIGH): agy 경로가 exit code 를 보지 않고, JSON 이 아닌
  // 아무 stdout 이나 응답으로 인정해 실패한 리뷰어를 계획에 넣을 수 있었다.
  it("agy 가 비정상 종료하면 stdout 이 비어 있지 않아도 통과가 아니다", () => {
    const r = readProbe("agy", { ok: false, status: 1, stdout: "usage: agy [flags]\n", stderr: "" });
    expect(r.ok).toBe(false);
  });

  it("agy 의 비-JSON stdout 은 응답으로 인정하지 않는다 — json 을 요구해 놓고 받았기 때문이다", () => {
    const r = readProbe("agy", { ok: true, status: 0, stdout: "some plain chatter\n", stderr: "" });
    expect(r.ok).toBe(false);
    expect(r.why).toContain("json");
  });
});
