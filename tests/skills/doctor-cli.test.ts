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

const high = { severity: "HIGH", kind: "mcp-shadow", unit: "chrome-devtools", scope: "global", fingerprint: "aa", sides: [], remedy: { applicable: true, kind: "permissions-deny", value: "mcp__chrome-devtools" } };
      const manual = { severity: "MEDIUM", kind: "double-gate", unit: "vbc", scope: "global", fingerprint: "bb", sides: [], remedy: { applicable: false, manual: "/plugin 에서 끄세요" } };

      const deps = (over: any = {}) => ({
        conflicts: [high, manual], ledger: [], settings: {},
        appendLedger: () => {}, writeSettings: () => {}, run: () => ({ ok: true }),
        ...over,
      });

      describe("runDoctor --apply", () => {
        it("writes settings once and appends one apply line", () => {
          const wrote: any[] = []; const lines: any[] = [];
          runDoctor(["--apply"], deps({ writeSettings: (s: any) => { wrote.push(s); }, appendLedger: (e: any) => { lines.push(e); } }));
          expect(wrote).toHaveLength(1);
          expect(wrote[0].permissions.deny).toEqual(["mcp__chrome-devtools"]);
          expect(lines).toHaveLength(1);
          expect(lines[0]).toMatchObject({ type: "apply", fingerprint: "aa" });
        });
        it("reports the manual one as skipped instead of failing the whole run", () => {
          const r = runDoctor(["--apply"], deps());
          expect(r.output).toContain("수동");
          expect(r.output).toContain("vbc");
        });
      });

      describe("runDoctor --ack 와 --unack", () => {
        it("appends an ack line for the given fingerprint", () => {
          const lines: any[] = [];
          runDoctor(["--ack", "aa"], deps({ appendLedger: (e: any) => { lines.push(e); } }));
          expect(lines[0]).toMatchObject({ type: "ack", fingerprint: "aa" });
        });
        it("hides an acked conflict from the report", () => {
          const out = runDoctor([], deps({ ledger: [{ type: "ack", fingerprint: "aa" }] })).output;
          expect(out).not.toContain("chrome-devtools");
        });
        it("appends an unack line so the conflict comes back", () => {
          const lines: any[] = [];
          runDoctor(["--unack", "aa"], deps({ appendLedger: (e: any) => { lines.push(e); } }));
          expect(lines[0]).toMatchObject({ type: "unack", fingerprint: "aa" });
        });
      });

      describe("runDoctor --undo", () => {
        it("stops without writing when the recorded path drifted", () => {
          const wrote: any[] = [];
          const r = runDoctor(["--undo"], deps({
            ledger: [{ type: "apply", fingerprint: "aa", path: ["permissions", "deny"], before: undefined, after: ["mcp__chrome-devtools"], fileHash: "old" }],
            settings: { permissions: { deny: ["mcp__other"] } },
            writeSettings: (s: any) => { wrote.push(s); },
          }));
          expect(wrote).toEqual([]);
          expect(r.output).toContain("멈췄");
        });
      });
