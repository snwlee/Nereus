import { describe, it, expect } from "vitest";
import { gateReport, untrackedAsDiff, excludeFindings, listRepoRefs } from "../../plugins/nereus/skills/finish/scripts/gate.mjs";

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
