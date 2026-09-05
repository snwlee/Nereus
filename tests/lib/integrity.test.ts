import { describe, it, expect } from "vitest";
import { checkIntegrity } from "../../plugins/nereus/hooks/scripts/lib/integrity.mjs";

const diff = (file: string, added: string[], removed: string[] = []) =>
  [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, "@@ -1,3 +1,3 @@", ...removed.map((l) => "-" + l), ...added.map((l) => "+" + l)].join("\n");

describe("completion integrity", () => {
  it("passes a clean diff", () => {
    expect(checkIntegrity(diff("src/a.ts", ["export const a = 1;"]))).toEqual({ pass: true, findings: [] });
  });
  it("flags TODO/FIXME/TBD markers in added lines", () => {
    const r = checkIntegrity(diff("src/a.ts", ["// TODO: handle null", "const x = 'TBD';"]));
    expect(r.pass).toBe(false);
    expect(r.findings.map((f: any) => f.category)).toEqual(expect.arrayContaining(["todo_marker", "placeholder"]));
    expect(r.findings[0]).toMatchObject({ file: "src/a.ts" });
  });
  it("flags skipped or disabled tests", () => {
    const r = checkIntegrity(diff("src/a.test.ts", ["it.skip('x', () => {})", "xit('y')", "@Disabled", "test('z', () => {}) // skip"]));
    expect(r.findings.filter((f: any) => f.category === "skipped_test").length).toBeGreaterThanOrEqual(3);
  });
  it("flags stubs", () => {
    const r = checkIntegrity(diff("src/a.ts", ["throw new Error('not implemented')", "raise NotImplementedError", "throw UnsupportedOperationException()"]));
    expect(r.findings.filter((f: any) => f.category === "stub").length).toBe(3);
  });
  it("flags removed guard without any test change", () => {
    const r = checkIntegrity(diff("src/a.ts", [], ["if (!user) throw new Error('unauthorized');"]));
    expect(r.findings.some((f: any) => f.category === "guard_removed")).toBe(true);
  });
  it("does not flag removed guard when a test file changed in the same diff", () => {
    const d = diff("src/a.ts", [], ["if (!user) return;"]) + "\n" + diff("src/a.test.ts", ["it('allows null user', () => {})"]);
    expect(checkIntegrity(d).findings.some((f: any) => f.category === "guard_removed")).toBe(false);
  });
  it("ignores markers inside markdown docs", () => {
    expect(checkIntegrity(diff("README.md", ["- TODO list feature"])).pass).toBe(true);
  });
});
