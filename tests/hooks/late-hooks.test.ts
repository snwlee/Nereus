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
    // aggregate 를 반드시 주입한다 — 빼면 실제 집계가 돌고, cwd "/r" 쓰기가 성공하는 플랫폼(Windows)에서
    // 학습 후보 노트가 먼저 들어와 notes[0] 이 밀린다
    const noAgg = { aggregate: () => ({ added: 0, open: 0 }) };
    expect(sessionEnd({ cwd: "/r" }, { ...noAgg, note: (m: string) => notes.push(m), hasClaudeMem: () => false })).toBeNull();
    expect(notes[0]).toContain("claude-mem");
    notes.length = 0;
    expect(sessionEnd({ cwd: "/r" }, { ...noAgg, note: (m: string) => notes.push(m), hasClaudeMem: () => true })).toBeNull();
    expect(notes).toEqual([]);
  });
});
