import { describe, it, expect } from "vitest";
import { handle } from "../../plugins/nereus/hooks/scripts/baton-meter.mjs";

const mk = (ratio: number, over: any = {}) => {
  const marks = new Set<string>(over.marks ?? []);
  return {
    input: { session_id: "s1", cwd: "/r", transcript_path: "/t.jsonl", tool_name: "Edit" },
    deps: {
      usage: () => ({ inputTotal: ratio * 200000, model: "claude-opus-5" }),
      config: () => ({ baton: { warn: 0.5, hard: 0.7 } }),
      official: () => null,
      hasMark: (k: string) => marks.has(k),
      setMark: (k: string) => { marks.add(k); },
      marks,
    },
  };
};

describe("baton-meter hook", () => {
  it("is silent under warn threshold", () => {
    const { input, deps } = mk(0.3);
    expect(handle(input, deps)).toBeNull();
  });
  it("warns once at warn threshold and sets a session mark", () => {
    const { input, deps } = mk(0.55);
    const first = handle(input, deps)!;
    expect(first.hookSpecificOutput.additionalContext).toMatch(/55%/);
    expect(first.hookSpecificOutput.additionalContext).toContain("handoff");
    expect(handle(input, deps)).toBeNull();
    expect([...deps.marks].some((m) => m.includes("warn"))).toBe(true);
  });
  it("hard-stops every time at hard threshold", () => {
    const { input, deps } = mk(0.85);
    const a = handle(input, deps)!;
    const b = handle(input, deps)!;
    expect(a.hookSpecificOutput.additionalContext).toContain("하드 스톱");
    expect(b).not.toBeNull();
  });
  it("is silent when transcript unreadable", () => {
    const { input, deps } = mk(0.9);
    expect(handle(input, { ...deps, usage: () => null })).toBeNull();
  });
});
