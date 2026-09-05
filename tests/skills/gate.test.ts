import { describe, it, expect } from "vitest";
import { gateReport, untrackedAsDiff, excludeFiles } from "../../plugins/nereus/skills/finish/scripts/gate.mjs";

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
  it("excludes files by glob", () => {
    const d = diff("lib/integrity.mjs", ["TODO regex"]) + "\n" + diff("src/a.ts", ["ok"]);
    const out = excludeFiles(d, ["**/integrity.mjs"]);
    expect(out).not.toContain("integrity.mjs");
    expect(out).toContain("src/a.ts");
    expect(excludeFiles(d, [])).toBe(d);
  });
});
