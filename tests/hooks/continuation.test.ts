import { describe, it, expect } from "vitest";
import { handle as finishCheck } from "../../plugins/nereus/hooks/scripts/finish-check.mjs";
import { handle as learnWatch } from "../../plugins/nereus/hooks/scripts/learn-watch.mjs";
import { hudLine, badge } from "../../plugins/nereus/skills/hud/scripts/hud.mjs";

const base = {
  gitStatus: () => "",
  handoffUpdatedThisSession: () => true,
  evidence: () => ({ status: "FRESH", passing: true }),
  config: () => ({ baton: { warn: 0.5, hard: 0.7 } }),
  ctxRatio: () => 0.2,
  progress: () => ({ total: 3, done: 1, next: "B", complete: false }),
};
const armed = (remaining = 3) => { let state: any = { remaining, goal: "g" }; return { continuation: () => state, disarm: () => { state = null; }, decrement: () => { state = { ...state, remaining: state.remaining - 1 }; }, peek: () => state }; };

describe("Stop 재진입", () => {
  it("armed 가 아니면 기존 알림 동작만 한다", () => {
    expect(finishCheck({ cwd: "/r" }, { ...base, continuation: () => null })).toBeNull();
    const out = finishCheck({ cwd: "/r" }, { ...base, continuation: () => null, gitStatus: () => " M a" })!;
    expect(out.decision).toBeUndefined();
  });
  it("armed 이고 태스크가 남았으면 종료를 막고 다음 태스크를 지시한다", () => {
    const c = armed(3);
    const out = finishCheck({ cwd: "/r" }, { ...base, ...c })!;
    expect(out.decision).toBe("block");
    expect(out.reason).toContain("B");
    expect(c.peek().remaining).toBe(2);
  });
  it("stop_hook_active 이면 절대 재진입하지 않는다", () => {
    const c = armed(3);
    expect(finishCheck({ cwd: "/r", stop_hook_active: true }, { ...base, ...c })).toBeNull();
    expect(c.peek().remaining).toBe(3);
  });
  it("남은 횟수가 0이거나 태스크가 끝났으면 해제하고 통과시킨다", () => {
    const c1 = armed(0);
    expect(finishCheck({ cwd: "/r" }, { ...base, ...c1 })).toBeNull();
    expect(c1.peek()).toBeNull();
    const c2 = armed(3);
    expect(finishCheck({ cwd: "/r" }, { ...base, ...c2, progress: () => ({ total: 2, done: 2, next: null, complete: true }) })).toBeNull();
    expect(c2.peek()).toBeNull();
  });
  it("컨텍스트가 경고선을 넘으면 재진입 대신 핸드오프를 요구한다", () => {
    const c = armed(3);
    const out = finishCheck({ cwd: "/r" }, { ...base, ...c, ctxRatio: () => 0.6 })!;
    expect(out.decision).toBeUndefined();
    expect(out.systemMessage).toContain("handoff");
    expect(c.peek()).toBeNull();
  });
  it("태스크 파일이 없으면 재진입하지 않는다", () => {
    const c = armed(3);
    expect(finishCheck({ cwd: "/r" }, { ...base, ...c, progress: () => null })).toBeNull();
  });
});

describe("learn-watch", () => {
  it("교정으로 보이는 프롬프트에 한 줄 안내를 넣는다", () => {
    const out = learnWatch({ prompt: "아니 그게 아니라 vitest 써", cwd: "/r" })!;
    expect(out.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
    expect(out.hookSpecificOutput.additionalContext).toContain("nereus:learn");
  });
  it("평범한 요청에는 아무것도 넣지 않는다", () => {
    expect(learnWatch({ prompt: "테스트 돌려줘", cwd: "/r" })).toBeNull();
    expect(learnWatch({ cwd: "/r" })).toBeNull();
  });
});

describe("HUD", () => {
  it("검증 상태를 정직하게 구분한다", () => {
    expect(badge({ complete: true, done: 2, total: 2 }, { status: "FRESH", passing: true })).toBe("검증됨");
    expect(badge({ complete: true, done: 2, total: 2 }, { status: "STALE" })).toBe("미검증");
    expect(badge({ complete: false, done: 1, total: 3 }, { status: "FRESH", passing: true })).toBe("작업중");
    expect(badge({ complete: false, done: 0, total: 3 }, { status: "MISSING" })).toBe("계획");
    expect(badge(null, { status: "FRESH", passing: true })).toBe("검증됨");
    expect(badge(null, { status: "MISSING" })).toBe("-");
  });
  it("한 줄로 합치고, 없는 정보는 생략한다", () => {
    expect(hudLine({ progress: { done: 3, total: 7, complete: false }, evidence: { status: "STALE" }, ctxPct: 54 })).toBe("⚓ 3/7 · 작업중 · 54%");
    expect(hudLine({ progress: null, evidence: { status: "MISSING" }, ctxPct: null })).toBe("⚓ -");
  });
});
