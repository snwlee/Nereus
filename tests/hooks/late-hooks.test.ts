import { describe, it, expect } from "vitest";
import { handle as preCompact } from "../../plugins/nereus/hooks/scripts/pre-compact.mjs";
import { handle as finishCheck } from "../../plugins/nereus/hooks/scripts/finish-check.mjs";
import { handle as sessionEnd } from "../../plugins/nereus/hooks/scripts/session-end.mjs";

describe("pre-compact", () => {
  it("demands a handoff when file missing or older than 30 minutes", () => {
    const now = 10_000_000;
    expect(preCompact({ cwd: "/r" }, { mtime: () => null, now })!.hookSpecificOutput.additionalContext).toContain("handoff");
    expect(preCompact({ cwd: "/r" }, { mtime: () => now - 60 * 60 * 1000, now })).not.toBeNull();
    expect(preCompact({ cwd: "/r" }, { mtime: () => now - 5 * 60 * 1000, now })).toBeNull();
    const ctx = preCompact({ cwd: "/r" }, { mtime: () => null, now })!.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("MUST NOT");
    expect(ctx).toContain("원문 요청");
  });
});

describe("finish-check (Stop)", () => {
  it("notes uncommitted changes and stale handoff but never blocks", () => {
    const out = finishCheck({ cwd: "/r", session_id: "s" }, { gitStatus: () => " M a.ts\n", handoffUpdatedThisSession: () => false, evidence: () => ({ status: "FRESH", passing: true }) })!;
    expect(out.decision).toBeUndefined();
    expect(out.systemMessage).toContain("미커밋");
    expect(out.systemMessage).toContain("handoff");
  });
  it("is silent when clean", () => {
    expect(finishCheck({ cwd: "/r" }, { gitStatus: () => "", handoffUpdatedThisSession: () => true, evidence: () => ({ status: "MISSING" }) })).toBeNull();
  });
  it("reports missing/stale/failing evidence", () => {
    const base = { handoffUpdatedThisSession: () => true };
    expect(finishCheck({ cwd: "/r" }, { ...base, gitStatus: () => " M a", evidence: () => ({ status: "MISSING" }) })!.systemMessage).toContain("evidence가 없습니다");
    expect(finishCheck({ cwd: "/r" }, { ...base, gitStatus: () => " M a", evidence: () => ({ status: "STALE" }) })!.systemMessage).toContain("STALE");
    expect(finishCheck({ cwd: "/r" }, { ...base, gitStatus: () => "", evidence: () => ({ status: "FRESH", passing: false, command: "npm test" }) })!.systemMessage).toContain("실패 상태");
    expect(finishCheck({ cwd: "/r" }, { ...base, gitStatus: () => " M a", evidence: () => ({ status: "FRESH", passing: true }) })!.systemMessage).not.toContain("evidence");
  });
  it("is silent when stop_hook_active to avoid loops", () => {
    expect(finishCheck({ cwd: "/r", stop_hook_active: true }, { gitStatus: () => " M a", handoffUpdatedThisSession: () => false, evidence: () => ({ status: "MISSING" }) })).toBeNull();
  });
});

describe("session-end", () => {
  it("only logs a note and never emits context", () => {
    const notes: string[] = [];
    expect(sessionEnd({ cwd: "/r" }, { note: (m: string) => notes.push(m), hasClaudeMem: () => false })).toBeNull();
    expect(notes[0]).toContain("claude-mem");
    notes.length = 0;
    expect(sessionEnd({ cwd: "/r" }, { note: (m: string) => notes.push(m), hasClaudeMem: () => true })).toBeNull();
    expect(notes).toEqual([]);
  });
});
