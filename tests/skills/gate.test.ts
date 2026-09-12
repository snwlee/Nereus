import { describe, it, expect } from "vitest";
import { gateReport, untrackedAsDiff, excludeFindings, listRepoRefs, readHandoffText } from "../../plugins/nereus/skills/finish/scripts/gate.mjs";

const diff = (file: string, added: string[]) => [`diff --git a/${file} b/${file}`, `+++ b/${file}`, ...added.map((l) => "+" + l)].join("\n");

describe("finish gate", () => {
  it("passes with fresh passing evidence and clean diff", () => {
    const r = gateReport({ diff: diff("src/a.ts", ["const a = 1;"]), evidence: { status: "FRESH", passing: true, command: "npm test" } });
    expect(r.pass).toBe(true);
    expect(r.markdown).toContain("판정: 통과");
  });
  it("blocks on stale or missing evidence", () => {
    expect(gateReport({ diff: "", evidence: { status: "STALE" } }).pass).toBe(false);
    const r = gateReport({ diff: "", evidence: { status: "MISSING" } });
    expect(r.pass).toBe(false);
    expect(r.markdown).toContain("run-tests.mjs");
  });
  it("blocks on integrity findings and lists them", () => {
    const r = gateReport({ diff: diff("src/a.ts", ["// TODO later"]), evidence: { status: "FRESH", passing: true, command: "npm test" } });
    expect(r.pass).toBe(false);
    expect(r.markdown).toContain("[todo_marker] src/a.ts");
  });
  it("blocks on failing tests even if fresh", () => {
    const r = gateReport({ diff: "", evidence: { status: "FRESH", passing: false, command: "npm test" } });
    expect(r.pass).toBe(false);
    expect(r.markdown).toContain("실패");
  });
});

describe("gate helpers", () => {
  it("turns untracked files into added-line diffs", () => {
    const d = untrackedAsDiff("/r", ["src/new.ts", "missing.ts"], (p: string) => { if (p.endsWith("new.ts")) return "// TODO x\nconst a = 1;"; throw new Error("ENOENT"); });
    expect(d).toContain("diff --git a/src/new.ts b/src/new.ts");
    expect(d).toContain("+// TODO x");
    expect(d).not.toContain("missing.ts");
  });
  it("제외 glob 은 findings 만 거른다", () => {
    const f = [{ file: "lib/integrity.mjs", category: "todo_marker" }, { file: "src/a.ts", category: "todo_marker" }];
    expect(excludeFindings(f, ["**/integrity.mjs"]).map((x: any) => x.file)).toEqual(["src/a.ts"]);
    expect(excludeFindings(f, [])).toEqual(f);
  });
  it("제외해도 diff 문맥(테스트 변경 여부)은 유지된다", () => {
    const d = diff("src/a.ts", []).replace("+++ b/src/a.ts", "+++ b/src/a.ts\n-  if (!x) return null;") + "\n" + diff("tests/a.test.ts", ["it('x', () => {})"]);
    const r = gateReport({ diff: d, evidence: { status: "FRESH", passing: true, command: "npm test" }, exclude: ["tests/**"] });
    expect(r.integrity.findings.some((x: any) => x.category === "guard_removed")).toBe(false);
  });
});

describe("finish gate — wiring", () => {
  const ok = { status: "FRESH", passing: true, command: "npm test" };
  const newScript = diff("plugins/nereus/skills/handoff/scripts/lonely.mjs", ["export const x = 1;"]);

  it("blocks a new skill script that nothing calls", () => {
    const r = gateReport({ diff: newScript, evidence: ok, listRefs: () => [{ file: "plugins/nereus/skills/handoff/SKILL.md", text: "무관" }] });
    expect(r.pass).toBe(false);
    expect(r.markdown).toContain("unwired");
    expect(r.markdown).not.toContain("undefined");
  });

  it("passes once something calls it", () => {
    const r = gateReport({ diff: newScript, evidence: ok, listRefs: () => [{ file: "plugins/nereus/skills/handoff/SKILL.md", text: "node scripts/lonely.mjs" }] });
    expect(r.pass).toBe(true);
  });

  it("skips wiring checks entirely when no reader is supplied", () => {
    expect(gateReport({ diff: newScript, evidence: ok }).pass).toBe(true);
  });

  it("honours gate.exclude for wiring findings too", () => {
    const r = gateReport({ diff: newScript, evidence: ok, exclude: ["**/handoff/scripts/*"], listRefs: () => [] });
    expect(r.pass).toBe(true);
  });

  it("listRepoRefs reads reference-bearing files and drops tests", () => {
    const refs = listRepoRefs("/r", ["a/SKILL.md", "tests/x.test.ts", "b/hooks.json", "README.md"], () => "본문");
    expect(refs.map((r: any) => r.file)).toEqual(["a/SKILL.md", "b/hooks.json"]);
  });
});

describe("finish gate — 디자인 피드백", () => {
  const ok = { status: "FRESH", passing: true, command: "npm test" };
  it("blocks when the injected design gate failed, and names the finding", () => {
    const r = gateReport({
      diff: diff("src/hero.css", [".hero{}"]),
      evidence: ok,
      design: { pass: false, findings: [{ category: "design_feedback_missing", file: "src/hero.css", message: "Gemini 미감 피드백이 없습니다" }] },
    });
    expect(r.pass).toBe(false);
    expect(r.markdown).toContain("[design_feedback_missing] src/hero.css");
    expect(r.markdown).toContain("디자인 피드백");
  });
  it("passes when the design gate passed", () => {
    const r = gateReport({ diff: diff("src/hero.css", [".hero{}"]), evidence: ok, design: { pass: true, findings: [] } });
    expect(r.pass).toBe(true);
  });
  it("reports warn-mode design findings without blocking", () => {
    const r = gateReport({
      diff: "", evidence: ok,
      design: { pass: true, enforce: "warn", findings: [{ category: "design_feedback_missing", file: "a.css", message: "없음" }] },
    });
    expect(r.pass).toBe(true);
    expect(r.markdown).toContain("a.css");
  });
  it("omits the design line entirely when no design surface was involved", () => {
    expect(gateReport({ diff: "", evidence: ok }).markdown).not.toContain("디자인 피드백");
  });
});

describe("finish gate VBC iron law", () => {
  const ok = { status: "FRESH", passing: true, command: "npm test" };
  it("gate report markdown cites VBC iron law", () => {
    const r = gateReport({ diff: "", evidence: ok });
    expect(r.markdown).toContain("NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION");
    expect(r.markdown).toContain("FRESH VERIFICATION");
  });
});

describe("listRepoRefs — 미추적 파일", () => {
  it("미추적 SKILL.md 도 참조 후보로 받아들인다 (새 스킬은 스크립트와 SKILL.md 가 함께 새로 생긴다)", () => {
    // Windows 에서 listRepoRefs 가 path.join 으로 "\\a\\" 를 만들기 때문에 구분자에 의존하지 않고 본다
    const refs = listRepoRefs("/r", ["plugins/x/skills/a/SKILL.md", "plugins/x/skills/b/SKILL.md"], (p: string) =>
      /[\\/]a[\\/]/.test(p) ? "node scripts/tool.mjs" : "무관");
    expect(refs.map((r) => r.file)).toEqual(["plugins/x/skills/a/SKILL.md", "plugins/x/skills/b/SKILL.md"]);
    expect(refs[0].text).toContain("tool.mjs");
  });
});

// 회귀: 세션별 handoff 로 옮긴 뒤에도 게이트가 레거시 `.nereus/handoff.md` 만 읽어
// 항상 handoff_stale 로 차단했다.
describe("handoff 읽기 (세션별 파일)", () => {
  it("가장 최근 세션 handoff 를 읽는다", () => {
    const deps = {
      readDir: () => [
        { name: "20260912-1000-aaaaaaaa.md", mtimeMs: 100 },
        { name: "20260912-1528-bbbbbbbb.md", mtimeMs: 900 },
      ],
      readFile: (p: string) => (p.endsWith("20260912-1528-bbbbbbbb.md") ? "v0.1.0 최초 등록" : "옛날 것"),
    };
    expect(readHandoffText("/proj", deps)).toContain("v0.1.0");
  });

  it("세션 파일이 없으면 레거시로 떨어진다", () => {
    const deps = {
      readDir: () => [],
      readFile: (p: string) => (p.endsWith(".nereus/handoff.md") ? "레거시 본문" : null),
    };
    expect(readHandoffText("/proj", deps)).toBe("레거시 본문");
  });

  it("둘 다 없으면 null 이라 검사가 조용하다", () => {
    expect(readHandoffText("/proj", { readDir: () => [], readFile: () => null })).toBeNull();
  });
});
