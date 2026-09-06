import { describe, it, expect } from "vitest";
import { handle } from "../../plugins/nereus/hooks/scripts/baton-meter.mjs";

const mk = (ratio: number, over: any = {}) => {
  const marks = new Set<string>(over.marks ?? []);
  const limits: Record<string, number> = {};
  return {
    input: { session_id: "s1", cwd: "/r", transcript_path: "/t.jsonl", tool_name: "Edit" },
    deps: {
      usage: () => ({ inputTotal: ratio * 200000, model: "claude-opus-5" }),
      config: () => ({ baton: { warn: 0.5, hard: 0.7 } }),
      official: () => null,
      hasMark: (k: string) => marks.has(k),
      setMark: (k: string) => { marks.add(k); },
      loadLimit: (sid: string) => limits[sid] ?? null,
      saveLimit: (sid: string, v: number) => { limits[sid] = v; },
      marks, limits,
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

  it("back-computes the real context limit from the official ratio and caches it", () => {
    const { input, deps } = mk(0);
    // 1M 세션의 실측: 공식 9%, transcript 88,917 토큰. 모델 문자열엔 [1m] 이 없다.
    const usage = () => ({ inputTotal: 88_917, model: "claude-opus-5" });
    expect(handle(input, { ...deps, usage, official: () => 0.09 })).toBeNull();
    expect(deps.limits["s1"]).toBe(1_000_000);
  });

  it("uses the cached limit when the official value goes stale, instead of the 200k guess", () => {
    const { input, deps } = mk(0);
    const usage = () => ({ inputTotal: 150_000, model: "claude-opus-5" });
    // statusline 이 살아있는 동안 한도를 학습한다.
    handle(input, { ...deps, usage, official: () => 0.15 });
    expect(deps.limits["s1"]).toBe(1_000_000);
    // 이후 공식 값이 낡아 폴백으로 떨어져도 실제 15% 로 읽어야 한다.
    // 학습이 없었다면 150k/200k = 75% 로 하드 스톱(70%)이 잘못 걸린다.
    expect(handle(input, { ...deps, usage, official: () => null })).toBeNull();
  });

  it("still falls back to the model table when nothing was learned", () => {
    const { input, deps } = mk(0);
    const usage = () => ({ inputTotal: 150_000, model: "claude-opus-5" });
    const out = handle(input, { ...deps, usage, official: () => null })!;
    expect(out.hookSpecificOutput.additionalContext).toMatch(/하드 스톱 75%/);
  });

  it("does not cache a limit when the official ratio is zero or usage is missing", () => {
    const { input, deps } = mk(0);
    handle(input, { ...deps, usage: () => ({ inputTotal: 88_917, model: "m" }), official: () => 0 });
    handle(input, { ...deps, usage: () => null, official: () => 0.5 });
    expect(deps.limits["s1"]).toBeUndefined();
  });
});
