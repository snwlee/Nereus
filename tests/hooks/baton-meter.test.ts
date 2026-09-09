import { describe, it, expect } from "vitest";
import { handle, DEFAULT_USAGE_READER } from "../../plugins/nereus/hooks/scripts/baton-meter.mjs";

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

  it("hard stop routes through the handoff skill so its auto-clear step runs", () => {
    // 예전 문구는 절차를 직접 서술하고 "사용자가 /clear 를 친다"로 끝나 SKILL 6단계(auto-clear)가
    // 통째로 빠졌다. auto-clear.log 가 한 번도 생기지 않은 원인이다.
    const { input, deps } = mk(0.85);
    const ctx = handle(input, deps)!.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("nereus:handoff");
    expect(ctx).toMatch(/Skill/);
    expect(ctx).toMatch(/auto-clear|자동/);
    // 사용자에게 /clear 를 치라고 떠넘기지 않는다
    expect(ctx).not.toMatch(/\/clear 만 치면/);
  });

  it("the warn message also names the skill rather than restating the steps", () => {
    const { input, deps } = mk(0.55);
    const ctx = handle(input, deps)!.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("nereus:handoff");
    expect(ctx).toMatch(/70%/); // 강제 정지 지점을 알려준다
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

  it("transcript 를 주지 않는 하네스에서는 조용히 끝나지 않고 1회 경고한다", () => {
    // OpenCode 는 세션을 SQLite 에 담아 transcript_path 를 주지 않는다. 예전에는 return null 이라
    // Baton 이 조용히 무동작했다 — 보호가 0인데 그 사실이 어디에도 드러나지 않았다.
    const { input, deps } = mk(0.9);
    const { transcript_path, ...noTranscript } = input;
    const first = handle(noTranscript, { ...deps, usage: () => null })!;
    expect(first).not.toBeNull();
    const ctx = first.hookSpecificOutput.additionalContext;
    expect(ctx).toMatch(/측정|자동/);
    expect(ctx).toContain("nereus:handoff");
    // 매 도구 호출마다 반복하면 노이즈다 — 세션당 한 번
    expect(handle(noTranscript, { ...deps, usage: () => null })).toBeNull();
  });

  it("transcript 는 있는데 usage 레코드가 아직 없으면 조용하다 (세션 초반은 정상)", () => {
    // 실측: 응답 전에 끝난 Codex 세션은 token_count 레코드가 없다(3줄, task_started 만).
    // 그것을 측정 불가로 경고하면 모든 세션 시작이 노이즈가 된다.
    const { input, deps } = mk(0.9);
    expect(handle(input, { ...deps, usage: () => null })).toBeNull();
    expect([...deps.marks].some((m) => m.includes("nometer"))).toBe(false);
  });

  it("Codex transcript 가 준 한도를 그대로 분모로 쓴다 (역산·모델 표 추측 없이)", () => {
    const { input, deps } = mk(0);
    // input 129200 / window 258400 = 50% → warn(50%) 발화, hard(70%) 미달
    const usage = () => ({ inputTotal: 129_200, limit: 258_400, model: "gpt-5.4" });
    const out = handle(input, { ...deps, usage, official: () => null })!;
    expect(out.hookSpecificOutput.additionalContext).toMatch(/50%/);
    expect(out.hookSpecificOutput.additionalContext).not.toMatch(/하드 스톱/);
  });

  it("does not cache a limit when the official ratio is zero or usage is missing", () => {
    const { input, deps } = mk(0);
    handle(input, { ...deps, usage: () => ({ inputTotal: 88_917, model: "m" }), official: () => 0 });
    handle(input, { ...deps, usage: () => null, official: () => 0.5 });
    expect(deps.limits["s1"]).toBeUndefined();
  });
});

describe("baton-meter 기본 usage 리더", () => {
  it("두 하네스 포맷을 모두 보는 readUsage 를 쓴다 (Claude 전용 파서가 아니다)", () => {
    // 파서를 만들어도 여기서 쓰지 않으면 Codex 는 여전히 무동작이다.
    const codex = JSON.stringify({
      type: "event_msg",
      payload: { type: "token_count", info: { last_token_usage: { input_tokens: 999 }, model_context_window: 258400 } },
    });
    expect(DEFAULT_USAGE_READER("/x.jsonl", { readFile: () => codex })).toMatchObject({ inputTotal: 999, limit: 258400 });
  });
});
