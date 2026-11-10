import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  findSplit, resolveTarget, collectLinks, stagesFor, parseReport, judgeRound, toSeverity, planReview, emptyLedger,
} from "../../plugins/nereus/skills/goldfish/scripts/goldfish.mjs";

const SCRIPT = path.resolve("plugins/nereus/skills/goldfish/scripts/goldfish.mjs");
const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "goldfish-")));
const write = (dir: string, rel: string, body: string) => {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
};

describe("findSplit — 기능 범위와 구현 범위", () => {
  it("구현 계획 헤더 앞은 Feature, 그 줄부터는 Detailed", () => {
    const text = "# T\n\n## Goals\nx\n## Implementation Plan\n- a\n- b";
    expect(findSplit(text)).toEqual({ feature: [1, 4], detailed: [5, 7], boundary: 5, ambiguous: false });
  });
  it("한국어 헤더도 경계다", () => {
    expect(findSplit("# T\n## 구현 계획\nx").boundary).toBe(2);
    expect(findSplit("# T\n## 태스크\nx").boundary).toBe(2);
  });
  it("헤더가 없으면 Detailed 를 비운다", () => {
    expect(findSplit("# T\n## Goals\nx")).toEqual({ feature: [1, 3], detailed: null, boundary: null, ambiguous: false });
  });
  it("헤더가 여럿이면 첫 헤더로 나누고 ambiguous", () => {
    const r = findSplit("# T\n## Tasks\na\n## Implementation Steps\nb");
    expect(r.boundary).toBe(2);
    expect(r.ambiguous).toBe(true);
  });
  it("코드 블록 안의 헤더는 경계가 아니다", () => {
    expect(findSplit("# T\n```md\n## Tasks\n```\nx").boundary).toBeNull();
  });
  it("### 하위 헤더는 경계가 아니다", () => {
    expect(findSplit("# T\n### Tasks\nx").boundary).toBeNull();
  });
});

describe("resolveTarget", () => {
  it("OpenSpec change: proposal·design·specs 는 Feature, tasks 는 Detailed", () => {
    const d = tmp();
    write(d, "proposal.md", "p");
    write(d, "design.md", "d");
    write(d, "specs/cap/spec.md", "s");
    write(d, "tasks.md", "t");
    const r = resolveTarget(d, d);
    expect(r.kind).toBe("openspec");
    expect(r.feature.map((f: { file: string }) => path.relative(d, f.file))).toEqual(["proposal.md", "design.md", path.join("specs", "cap", "spec.md")]);
    expect(r.detailed.map((f: { file: string }) => path.basename(f.file))).toEqual(["tasks.md"]);
  });
  it("spec-kit 기능 디렉터리: spec·plan 은 Feature, tasks 는 Detailed", () => {
    const d = tmp();
    write(d, "spec.md", "s");
    write(d, "plan.md", "p");
    write(d, "tasks.md", "t");
    const r = resolveTarget(d, d);
    expect(r.kind).toBe("spec-kit");
    expect(r.feature.map((f: { file: string }) => path.basename(f.file))).toEqual(["spec.md", "plan.md"]);
  });
  it("단일 파일은 헤더로 나눈다", () => {
    const d = tmp();
    const f = write(d, "doc.md", "# T\n## Goals\n## Implementation Plan\nx");
    const r = resolveTarget(f, d);
    expect(r.kind).toBe("file");
    expect(r.feature).toEqual([{ file: f, lines: [1, 2] }]);
    expect(r.detailed).toEqual([{ file: f, lines: [3, 4] }]);
  });
  it("tasks 없는 OpenSpec change 는 Detailed 가 비어 있다", () => {
    const d = tmp();
    write(d, "proposal.md", "p");
    expect(resolveTarget(d, d).detailed).toEqual([]);
  });
  it("없는 대상은 던진다", () => {
    expect(() => resolveTarget("/no/such/doc.md", "/")).toThrow(/없/);
  });
  it("문서가 없는 디렉터리는 던진다", () => {
    const d = tmp();
    expect(() => resolveTarget(d, d)).toThrow();
  });
});

describe("collectLinks", () => {
  it("앵커는 버리고 안쪽의 존재하는 파일만 inside", () => {
    const d = tmp();
    write(d, "src/a.ts", "x");
    const doc = write(d, "docs/x.md", "");
    const text = [
      "[a](../src/a.ts#L3)", "[self](#goals)", "[gone](../src/none.ts)",
      "[out](../../outside.md)", "[web](https://example.com/p)", "[a again](../src/a.ts)",
    ].join("\n");
    const r = collectLinks(doc, text, d);
    expect(r.inside).toEqual([path.join(d, "src/a.ts")]);
    expect(r.outside).toEqual(["../../outside.md"]);
    expect(r.urls).toEqual(["https://example.com/p"]);
    expect(r.missing).toEqual(["../src/none.ts"]);
  });
  it("심볼릭 링크로 밖을 가리키면 outside", () => {
    const d = tmp();
    const outside = tmp();
    write(outside, "secret.md", "s");
    fs.symlinkSync(path.join(outside, "secret.md"), path.join(d, "link.md"));
    const doc = write(d, "x.md", "");
    expect(collectLinks(doc, "[l](link.md)", d).outside).toEqual(["link.md"]);
  });
});

describe("stagesFor", () => {
  it("full 은 5→9 다섯 단계", () => {
    expect(stagesFor("full").map((s: { n: number }) => s.n)).toEqual([5, 6, 7, 8, 9]);
  });
  it("feature 는 9 를 빼고 implementation 은 9 만", () => {
    expect(stagesFor("feature").map((s: { n: number }) => s.n)).toEqual([5, 6, 7, 8]);
    expect(stagesFor("implementation").map((s: { n: number }) => s.n)).toEqual([9]);
  });
  it("6단계(Comprehension)만 GoldfishContext 를 받지 않는다", () => {
    const noCtx = stagesFor("full").filter((s: { context: boolean }) => !s.context).map((s: { n: number }) => s.n);
    expect(noCtx).toEqual([6]);
  });
  it("모르는 모드는 던진다", () => {
    expect(() => stagesFor("everything")).toThrow();
  });
});

const REPORT = `# Goldfish Review Report

**Target:** \`docs/x.md\` (\`1-40\`)

## Reviewer Status

| Reviewer | Status |
| --- | --- |
| \`egm-design\` | completed |
| \`egm-style\` | not run |

## Prioritized Findings (Blockers -> Major -> Nits)

### No retry policy - Severity: Blocker
* **Reviewer Lens:** \`egm-design\`
* **Affected Scope:** \`Lines 10-14\`
* **Discrepancy Description**: x

### Vague term - Severity: Nit
* **Reviewer Lens:** \`egm-style\`
* **Affected Scope:** Goals
`;

describe("parseReport", () => {
  it("발견과 리뷰어 상태를 뽑는다", () => {
    const r = parseReport(REPORT);
    expect(r.reviewers).toEqual([{ name: "egm-design", status: "completed" }, { name: "egm-style", status: "not run" }]);
    expect(r.findings).toEqual([
      { title: "No retry policy", severity: "blocker", reviewer: "egm-design", scope: "Lines 10-14", key: "lines 10-14|no retry policy" },
      { title: "Vague term", severity: "nit", reviewer: "egm-style", scope: "Goals", key: "goals|vague term" },
    ]);
  });
  it("빈 보고서는 빈 결과", () => {
    expect(parseReport("")).toEqual({ reviewers: [], findings: [], unparsed: [] });
  });
});

describe("toSeverity — Nereus 심각도", () => {
  it("Blocker→CRITICAL, Major→HIGH, Nit→LOW, 모름→MEDIUM", () => {
    expect(["blocker", "Major", "nit", "?"].map(toSeverity)).toEqual(["CRITICAL", "HIGH", "LOW", "MEDIUM"]);
  });
});

const f = (key: string, severity = "major") => ({ key, severity, title: key, reviewer: "r", scope: "s" });

describe("judgeRound — 수렴 판정", () => {
  it("연속 2회 clean 이면 수렴", () => {
    const r1 = judgeRound(emptyLedger(), { findings: [f("a", "nit")], notRun: [] });
    expect(r1.clean).toBe(true);
    expect(r1.converged).toBe(false);
    const r2 = judgeRound(r1.ledger, { findings: [], notRun: [] });
    expect(r2.converged).toBe(true);
    expect(r2.ledger.round).toBe(2);
  });
  it("미실행 리뷰어가 있으면 clean 이 아니다", () => {
    const r = judgeRound(emptyLedger(), { findings: [], notRun: ["egm-style"] });
    expect(r.clean).toBe(false);
  });
  it("정착된 발견은 clean 을 막지 않는다", () => {
    const ledger = { ...emptyLedger(), settled: ["a"] };
    expect(judgeRound(ledger, { findings: [f("a", "blocker")], notRun: [] }).clean).toBe(true);
  });
  it("정착되지 않은 Major 는 clean 을 막고 연속 횟수를 0 으로", () => {
    const ledger = { ...emptyLedger(), round: 1, cleanStreak: 1 };
    const r = judgeRound(ledger, { findings: [f("b")], notRun: [] });
    expect(r.clean).toBe(false);
    expect(r.ledger.cleanStreak).toBe(0);
    expect(r.blocking.map((x: { key: string }) => x.key)).toEqual(["b"]);
  });
  it("고친 발견이 다시 나오면 reopened", () => {
    const ledger = { ...emptyLedger(), fixed: ["c"] };
    const r = judgeRound(ledger, { findings: [f("c")], notRun: [] });
    expect(r.reopened.map((x: { key: string }) => x.key)).toEqual(["c"]);
    expect(r.clean).toBe(false);
  });
  it("5라운드에서 수렴하지 않으면 capped", () => {
    const ledger = { ...emptyLedger(), round: 4 };
    const r = judgeRound(ledger, { findings: [f("d")], notRun: [] });
    expect(r.capped).toBe(true);
    expect(r.next).toBe("cap");
  });
  it("next 는 converged/continue/cap 중 하나", () => {
    expect(judgeRound(emptyLedger(), { findings: [f("e")], notRun: [] }).next).toBe("continue");
  });
  it("원래 원장을 바꾸지 않는다", () => {
    const ledger = emptyLedger();
    judgeRound(ledger, { findings: [], notRun: [] });
    expect(ledger.round).toBe(0);
  });
});

describe("planReview", () => {
  it("단계마다 페르소나·표준 절대 경로를 내고 그 파일이 모두 존재한다", () => {
    const d = tmp();
    write(d, "proposal.md", "[x](src/a.ts)");
    write(d, "src/a.ts", "x");
    write(d, "tasks.md", "- [ ] T1");
    const plan = planReview(d, { cwd: d, mode: "full" });
    expect(plan.stages).toHaveLength(5);
    for (const s of plan.stages) {
      for (const r of s.reviewers) expect(fs.existsSync(r.persona)).toBe(true);
      for (const r of s.reviewers) if (r.standard) expect(fs.existsSync(r.standard)).toBe(true);
    }
    expect(plan.context.inside).toEqual([path.join(d, "src/a.ts")]);
    expect(plan.synthesizer && fs.existsSync(plan.synthesizer)).toBe(true);
  });
  it("Detailed 가 없으면 full 을 feature 로 낮추고 이유를 남긴다", () => {
    const d = tmp();
    const doc = write(d, "doc.md", "# T\n## Goals");
    const plan = planReview(doc, { cwd: d, mode: "full" });
    expect(plan.mode).toBe("feature");
    expect(plan.notes.join(" ")).toMatch(/구현 범위/);
  });
});

describe("CLI", () => {
  it("plan 은 JSON 을 낸다", () => {
    const d = tmp();
    const doc = write(d, "doc.md", "# T\n## Tasks\n- a");
    const out = JSON.parse(execFileSync("node", [SCRIPT, "plan", doc, "--mode", "full"], { cwd: d, encoding: "utf8" }));
    expect(out.stages).toHaveLength(5);
  });
  it("judge 는 원장 파일을 갱신하고 다음 행동을 낸다", () => {
    const d = tmp();
    const report = write(d, "r.md", REPORT);
    const ledger = path.join(d, "ledger.json");
    const out = JSON.parse(execFileSync("node", [SCRIPT, "judge", ledger, report], { encoding: "utf8" }));
    expect(out.clean).toBe(false);
    expect(out.notRun).toEqual(["egm-style"]);
    expect(JSON.parse(fs.readFileSync(ledger, "utf8")).round).toBe(1);
  });
  it("judge --settle·--fixed 는 키를 원장에 기록한다", () => {
    const d = tmp();
    const ledger = path.join(d, "ledger.json");
    execFileSync("node", [SCRIPT, "settle", ledger, "--settle", "a|x", "--fixed", "b|y"], { encoding: "utf8" });
    const l = JSON.parse(fs.readFileSync(ledger, "utf8"));
    expect(l.settled).toEqual(["a|x"]);
    expect(l.fixed).toEqual(["b|y"]);
  });
  it("parse 는 보고서를 JSON 으로 낸다", () => {
    const d = tmp();
    const report = write(d, "r.md", REPORT);
    const out = JSON.parse(execFileSync("node", [SCRIPT, "parse", report], { encoding: "utf8" }));
    expect(out.findings).toHaveLength(2);
  });
  it("구현 범위 없는 문서에 implementation 모드는 종료코드 1", () => {
    const d = tmp();
    const doc = write(d, "doc.md", "# T");
    expect(() => planReview(doc, { cwd: d, mode: "implementation" })).toThrow(/구현 범위/);
    expect(() => execFileSync("node", [SCRIPT, "plan", doc, "--mode", "implementation"], { cwd: d, stdio: "pipe" })).toThrow();
  });
  it("밖 링크가 있으면 notes 에 알린다", () => {
    const d = tmp();
    const doc = write(d, "doc.md", "# T\n[w](https://e.com)");
    expect(planReview(doc, { cwd: d }).notes.join(" ")).toMatch(/URL/);
  });
  it("모르는 명령은 종료코드 2", () => {
    expect(() => execFileSync("node", [SCRIPT, "nope"], { stdio: "pipe" })).toThrow();
  });
});

describe("리뷰 회귀 — 조용한 통과 막기", () => {
  it("모르는 심각도(Critical·High)는 차단으로 센다, Nit·Minor·Low 만 통과", () => {
    const r = judgeRound(emptyLedger(), { findings: [f("a", "critical"), f("b", "minor"), f("c", "low")], notRun: [] });
    expect(r.blocking.map((x: { key: string }) => x.key)).toEqual(["a"]);
    expect(r.clean).toBe(false);
  });
  it("형식이 어긋난 ### 발견 제목은 unparsed 로 세고 clean 을 막는다", () => {
    const md = "## Reviewer Status\n| `egm-design` | completed |\n## Prioritized Findings\n### Missing retry (Blocker)\n* **Affected Scope:** L3";
    const p = parseReport(md);
    expect(p.findings).toEqual([]);
    expect(p.unparsed).toEqual(["Missing retry (Blocker)"]);
    expect(judgeRound(emptyLedger(), { findings: p.findings, notRun: [], unparsed: p.unparsed.length }).clean).toBe(false);
  });
});
