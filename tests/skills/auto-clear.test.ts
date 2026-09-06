import { describe, it, expect } from "vitest";
import { planSteps, resolveOptions, execute, parseWait, quietFor, confirmIdle, DEFAULT_RESUME_PROMPT } from "../../plugins/nereus/skills/handoff/scripts/auto-clear.mjs";

const base = { handle: "term_abc", enabled: true, dirty: false };

describe("auto-clear", () => {
  it("plans: wait for this turn to end, clear, wait again, then re-prompt", () => {
    const steps = planSteps(base)!;
    expect(steps.map((s) => s.kind)).toEqual(["wait", "send", "wait", "send"]);
    // 1) 현재 턴이 끝나기 전에 입력을 보내면 큐에 쌓여 순서가 뒤엉킨다.
    expect(steps[0].args).toContain("tui-idle");
    expect(steps[1].args).toContain("/clear");
    // 2) /clear 만으로는 재개되지 않는다 — Claude 는 사용자 입력이 있어야 턴을 시작한다.
    expect(steps[3].args).toContain(DEFAULT_RESUME_PROMPT);
    for (const s of steps) expect(s.args).toContain("term_abc");
  });

  it("does nothing outside an Orca terminal", () => {
    expect(planSteps({ ...base, handle: "" })).toBeNull();
    expect(planSteps({ ...base, handle: undefined })).toBeNull();
  });

  it("does nothing when disabled by config", () => {
    expect(planSteps({ ...base, enabled: false })).toBeNull();
  });

  it("refuses to clear while changes are uncommitted — clearing would strand them", () => {
    expect(planSteps({ ...base, dirty: true })).toBeNull();
  });

  it("carries a custom resume prompt", () => {
    const steps = planSteps({ ...base, resumePrompt: "계속" })!;
    expect(steps[3].args).toContain("계속");
  });

  it("always passes an explicit timeout to every wait", () => {
    for (const s of planSteps(base)!.filter((s) => s.kind === "wait")) {
      expect(s.args).toContain("--timeout-ms");
    }
  });
});

describe("auto-clear resolveOptions", () => {
  const deps = {
    env: { ORCA_TERMINAL_HANDLE: "term_abc" },
    config: { autoClear: { enabled: true, prompt: "이어서 진행해" } },
    gitStatus: () => ({ ok: true, stdout: "" }),
  };

  it("takes the handle from the Orca env var and the prompt from config", () => {
    expect(resolveOptions(deps)).toEqual({ handle: "term_abc", enabled: true, dirty: false, resumePrompt: "이어서 진행해" });
  });

  it("reports dirty when git status has any output", () => {
    expect(resolveOptions({ ...deps, gitStatus: () => ({ ok: true, stdout: " M a.ts\n" }) }).dirty).toBe(true);
  });

  it("treats a failed git status as dirty — unknown state must not be cleared", () => {
    expect(resolveOptions({ ...deps, gitStatus: () => ({ ok: false, stdout: "" }) }).dirty).toBe(true);
  });

  it("honors the config switch", () => {
    expect(resolveOptions({ ...deps, config: { autoClear: { enabled: false } } }).enabled).toBe(false);
  });
});

describe("auto-clear idle detection", () => {
  it("parseWait reads the satisfied flag, not the exit code", () => {
    expect(parseWait('{"ok":true,"result":{"wait":{"satisfied":true}}}')).toMatchObject({ satisfied: true });
    // orca 는 조건 미충족에도 종료코드 0 으로 끝난다. 실측된 실제 응답:
    expect(parseWait('{"ok":true,"result":{"wait":{"satisfied":false,"status":"running","blockedReason":"codex-trust-workspace"}}}'))
      .toMatchObject({ satisfied: false, blockedReason: "codex-trust-workspace" });
    expect(parseWait("쓰레기")).toBeNull();
  });

  it("quietFor reports how long the terminal has produced no output", () => {
    // 실측 형태는 result.terminal.lastOutputAt 이다.
    expect(quietFor('{"result":{"terminal":{"lastOutputAt":1000}}}', 4000)).toBe(3000);
    expect(quietFor('{"result":{"lastOutputAt":1000}}', 4000)).toBe(3000);
    expect(quietFor("쓰레기", 4000)).toBeNull();
    expect(quietFor('{"result":{"terminal":{}}}', 4000)).toBeNull();
  });

  it("confirmIdle accepts a satisfied tui-idle immediately", () => {
    const exec = () => ({ ok: true, stdout: '{"result":{"wait":{"satisfied":true}}}' });
    expect(confirmIdle({ handle: "t", exec, sleep: () => {}, now: () => 0 })).toMatchObject({ ok: true, via: "tui-idle" });
  });

  it("falls back to a quiet window when tui-idle is blocked", () => {
    let t = 0;
    const exec = (_c: string, args: string[]) =>
      args[1] === "wait"
        ? { ok: true, stdout: '{"result":{"wait":{"satisfied":false,"blockedReason":"codex-trust-workspace"}}}' }
        : { ok: true, stdout: `{"result":{"terminal":{"lastOutputAt":${t > 8000 ? 0 : t}}}}` };
    const r = confirmIdle({ handle: "t", exec, sleep: (ms: number) => { t += ms; }, now: () => t, quietMs: 3000, deadlineMs: 60000 });
    expect(r).toMatchObject({ ok: true, via: "quiet" });
  });

  it("gives up rather than clearing blind when idle is never confirmed", () => {
    // 출력이 계속 갱신되는 = 턴이 계속 도는 터미널
    let t = 0;
    const exec = (_c: string, args: string[]) =>
      args[1] === "wait"
        ? { ok: true, stdout: '{"result":{"wait":{"satisfied":false}}}' }
        : { ok: true, stdout: `{"result":{"terminal":{"lastOutputAt":${t}}}}` };
    const r = confirmIdle({ handle: "t", exec, sleep: (ms: number) => { t += ms; }, now: () => t, quietMs: 3000, deadlineMs: 20000 });
    expect(r.ok).toBe(false);
  });
});

describe("auto-clear execute", () => {
  const steps = () => planSteps(base)!;

  it("never sends /clear when idle could not be confirmed", () => {
    const sent: string[] = [];
    const logged: string[] = [];
    const r = execute(steps(), {
      exec: (_c: string, args: string[]) => { if (args[1] === "send") sent.push(args[5]); return { ok: true, stdout: "" }; },
      confirm: () => ({ ok: false, reason: "turn-still-running" }),
      log: (m: string) => logged.push(m),
    });
    expect(sent).toEqual([]);
    expect(r.some((x: any) => x.aborted)).toBe(true);
    expect(logged.join("\n")).toContain("turn-still-running");
  });

  it("sends /clear and the resume prompt once idle is confirmed", () => {
    const sent: string[] = [];
    execute(steps(), {
      exec: (_c: string, args: string[]) => { if (args[1] === "send") sent.push(args[5]); return { ok: true, stdout: "" }; },
      confirm: () => ({ ok: true, via: "quiet" }),
      log: () => {},
    });
    expect(sent).toEqual(["/clear", DEFAULT_RESUME_PROMPT]);
  });

  it("logs every run so a background failure is not silent", () => {
    const logged: string[] = [];
    execute(steps(), { exec: () => ({ ok: true, stdout: "" }), confirm: () => ({ ok: true, via: "quiet" }), log: (m: string) => logged.push(m) });
    expect(logged.length).toBeGreaterThan(0);
  });
});
