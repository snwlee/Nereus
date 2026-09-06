import { describe, it, expect } from "vitest";
import { planSteps, resolveOptions, DEFAULT_RESUME_PROMPT } from "../../plugins/nereus/skills/handoff/scripts/auto-clear.mjs";

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
