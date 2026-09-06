import { describe, it, expect } from "vitest";
import { bisect, report } from "../../plugins/nereus/skills/debug/scripts/find-polluter.mjs";

describe("find-polluter bisect", () => {
  const files = ["a.test.ts", "b.test.ts", "c.test.ts"];

  it("names the first test whose run makes the pollution appear", () => {
    let polluted = false;
    const r = bisect({
      files,
      exists: () => polluted,
      runTest: (f: string) => { if (f === "b.test.ts") polluted = true; },
    });
    expect(r).toMatchObject({ found: true, file: "b.test.ts", index: 2, total: 3 });
  });
  it("reports clean when nothing pollutes", () => {
    const r = bisect({ files, exists: () => false, runTest: () => {} });
    expect(r).toMatchObject({ found: false, ran: 3 });
  });
  it("stops immediately when the pollution is already there before any test", () => {
    const ran: string[] = [];
    const r = bisect({ files, exists: () => true, runTest: (f: string) => ran.push(f) });
    expect(r).toMatchObject({ found: false, preexisting: true });
    expect(ran).toEqual([]);
  });
  it("keeps going when a test run throws — a failing test can still pollute", () => {
    let polluted = false;
    const r = bisect({
      files,
      exists: () => polluted,
      runTest: (f: string) => { if (f === "a.test.ts") throw new Error("test failed"); if (f === "c.test.ts") polluted = true; },
    });
    expect(r).toMatchObject({ found: true, file: "c.test.ts" });
  });
  it("handles an empty file list without pretending success", () => {
    expect(bisect({ files: [], exists: () => false, runTest: () => {} })).toMatchObject({ found: false, ran: 0 });
  });
});

describe("report", () => {
  it("tells the user which test and how to investigate", () => {
    const md = report({ found: true, file: "b.test.ts", index: 2, total: 3 }, ".git", "npm test");
    expect(md).toContain("b.test.ts");
    expect(md).toContain(".git");
    expect(md).toContain("npm test b.test.ts");
  });
  it("says the pollution predates the run when preexisting", () => {
    expect(report({ found: false, preexisting: true, ran: 0 }, ".git", "npm test")).toMatch(/이미 존재/);
  });
  it("says clean when nothing was found", () => {
    expect(report({ found: false, ran: 5 }, ".git", "npm test")).toMatch(/찾지 못했습니다|없습니다/);
  });
});
