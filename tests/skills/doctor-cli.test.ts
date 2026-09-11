import { describe, it, expect } from "vitest";
import { renderReport, runDoctor } from "../../plugins/nereus/skills/doctor/scripts/doctor.mjs";

const conflicts = [
  { severity: "HIGH", kind: "mcp-shadow", unit: "chrome-devtools", scope: "global", fingerprint: "aa", sides: [], remedy: { applicable: true, kind: "permissions-deny", value: "mcp__chrome-devtools" } },
  { severity: "MEDIUM", kind: "double-gate", unit: "verification-before-completion", scope: "global", fingerprint: "bb", sides: [], evidence: "완료 게이트가 두 번 돈다", remedy: { applicable: false, manual: "/plugin 에서 끄세요" } },
  { severity: "LOW", kind: "hook-shared", unit: "PostToolUse|Edit", scope: "global", fingerprint: "cc", sides: [], remedy: { applicable: false } },
];

describe("renderReport", () => {
  it("hides LOW by default and summarises its count", () => {
    const out = renderReport(conflicts, { all: false });
    expect(out).toContain("chrome-devtools");
    expect(out).toContain("verification-before-completion");
    expect(out).not.toContain("PostToolUse|Edit");
    expect(out).toMatch(/LOW 1건/);
  });
  it("shows LOW with --all", () => {
    expect(renderReport(conflicts, { all: true })).toContain("PostToolUse|Edit");
  });
  it("marks an inapplicable remedy as manual rather than pretending", () => {
    const out = renderReport(conflicts, { all: false });
    expect(out).toContain("수동");
    expect(out).toContain("/plugin");
  });
});

describe("runDoctor", () => {
  it("never executes plugin uninstall, only prints it", () => {
    const ran: string[] = [];
    const r = runDoctor(["--remove", "ecc@ecc"], { conflicts, run: (c: string) => { ran.push(c); return { ok: true }; }, write: () => {} });
    expect(ran).toEqual([]);
    expect(r.output).toContain("/plugin uninstall ecc@ecc");
  });
  it("writes nothing without an explicit apply", () => {
    const writes: string[] = [];
    runDoctor([], { conflicts, run: () => ({ ok: true }), write: (p: string) => { writes.push(p); } });
    expect(writes).toEqual([]);
  });
});
