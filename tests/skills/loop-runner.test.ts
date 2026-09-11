import { describe, it, expect } from "vitest";
import { runLoop, parseTasks, buildPrompt, claudeArgs, LOOP_ALLOWED_TOOLS } from "../../plugins/nereus/skills/baton/scripts/loop-runner.mjs";

describe("loop-runner", () => {
  it("parses tasks with checkbox state", () => {
    const t = parseTasks("- [ ] A [flow]\n- [x] B\n  - [ ] C\ntext\n- [X] D");
    // wave 태그가 없으면 wave: null — [flow] 등 다른 태그는 텍스트에 그대로 남는다.
    // 중첩된 `  - [ ] C` 는 B 의 스텝이지 태스크가 아니다. 이 테스트는 원래 C 를 태스크로
    // 셌는데, 그 동작이 nereus:spec 산출물에서 wave 를 깨뜨려 바로잡았다(loop-waves 테스트 참조).
    expect(t).toEqual([
      { text: "A [flow]", done: false, wave: null },
      { text: "B", done: true, wave: null },
      { text: "D", done: true, wave: null },
    ]);
  });
  it("prompt references only handoff, tasks and spec paths", () => {
    const p = buildPrompt({ handoff: ".nereus/handoff.md", tasks: "openspec/changes/x/tasks.md", spec: "openspec/changes/x/proposal.md", goal: "작업" });
    expect(p).toContain(".nereus/handoff.md");
    expect(p).toContain("tasks.md");
    expect(p).toContain("커밋");
  });
  it("stops when all tasks done and evaluate passes", async () => {
    let calls = 0;
    const tasksSeq = ["- [ ] A\n- [ ] B", "- [x] A\n- [ ] B", "- [x] A\n- [x] B"];
    const r = await runLoop({ max: 10, goal: "g", paths: { handoff: "h", tasks: "t", spec: "s" } }, {
      readTasks: () => tasksSeq[Math.min(calls, 2)],
      runClaude: async () => { calls++; return { ok: true }; },
      gitDirty: () => false, commit: () => {}, evaluate: async () => ({ pass: true }), log: () => {},
    });
    expect(r).toEqual({ status: "converged", iterations: 2 });
  });
  it("stops at max iterations", async () => {
    let done = 0;
    const r = await runLoop({ max: 3, goal: "g", paths: { handoff: "h", tasks: "t", spec: "s" } }, {
      readTasks: () => Array.from({ length: 100 }, (_, i) => `- [${i < done ? "x" : " "}] T${i}`).join("\n"),
      runClaude: async () => { done++; return { ok: true }; }, gitDirty: () => false, commit: () => {}, evaluate: async () => ({ pass: false }), log: () => {},
    });
    expect(r).toEqual({ status: "max_reached", iterations: 3 });
  });
  it("commits when dirty and gives up after 3 failures on the same task", async () => {
    const commits: string[] = [];
    const r = await runLoop({ max: 10, goal: "g", paths: { handoff: "h", tasks: "t", spec: "s" } }, {
      readTasks: () => "- [ ] A\n- [ ] B", runClaude: async () => ({ ok: true }), gitDirty: () => true, commit: (m: string) => commits.push(m), evaluate: async () => ({ pass: false }), log: () => {},
    });
    expect(r).toEqual({ status: "stuck", iterations: 3, task: "A" });
    expect(commits.length).toBe(3);
  });
});

// --- 자율 게이트 배선 (autonomousGate) ---
// 지금까지 루프는 서브세션이 체크박스를 채웠다는 것만으로 "진행"으로 쳤고, 검증 없이 커밋했다.
// 게이트는 반복마다 검증을 돌려 (1) 실패한 반복을 진행으로 세지 않고 (2) 커밋 메시지에 실패를 남긴다.
describe("loop-runner — 자율 게이트", () => {
  const base = { max: 10, goal: "g", paths: { handoff: "h", tasks: "t", spec: "s" } };
  // 반복마다 체크박스가 하나씩 늘어나는 tasks — 게이트가 없으면 항상 "진행"으로 보인다.
  const growingTasks = () => {
    let done = 0;
    return {
      readTasks: () => Array.from({ length: 100 }, (_, i) => `- [${i < done ? "x" : " "}] T${i}`).join("\n"),
      tick: () => { done++; },
    };
  };

  // sameTaskFails 는 "같은 태스크" 키로 센다. 서브세션이 체크박스를 채우면 키가 매번 바뀌어
  // 리셋되므로, 게이트가 계속 실패해도 max 까지 걸어간다. 연속 게이트 실패는 따로 세야 한다.
  it("stops with gate_blocked after 3 consecutive gate failures, even as checkboxes advance", async () => {
    const t = growingTasks();
    const r = await runLoop(base, {
      readTasks: t.readTasks,
      runClaude: async () => { t.tick(); return { ok: true }; },
      gitDirty: () => true, commit: () => {},
      gate: async () => ({ pass: false, reason: "npm test 실패" }),
      evaluate: async () => ({ pass: false }), log: () => {},
    });
    // 게이트가 없었다면 progressed=true 로 계속 돌아 max_reached 였다.
    expect(r).toEqual({ status: "gate_blocked", iterations: 3, reason: "npm test 실패" });
  });

  it("records the gate failure reason in the checkpoint commit message", async () => {
    const commits: string[] = [];
    await runLoop({ ...base, max: 1 }, {
      readTasks: () => "- [ ] A",
      runClaude: async () => ({ ok: true }),
      gitDirty: () => true, commit: (m: string) => commits.push(m),
      gate: async () => ({ pass: false, reason: "npm test 실패" }),
      evaluate: async () => ({ pass: false }), log: () => {},
    });
    expect(commits).toHaveLength(1);
    expect(commits[0]).toContain("npm test 실패");
  });

  it("skips the gate entirely when the iteration changed nothing", async () => {
    let gateCalls = 0;
    await runLoop({ ...base, max: 1 }, {
      readTasks: () => "- [ ] A",
      runClaude: async () => ({ ok: true }),
      gitDirty: () => false, commit: () => {},
      gate: async () => { gateCalls++; return { pass: false }; },
      evaluate: async () => ({ pass: false }), log: () => {},
    });
    expect(gateCalls).toBe(0);
  });

  it("falls back to evaluate when no gate command is configured", async () => {
    let evalCalls = 0;
    await runLoop({ ...base, max: 1 }, {
      readTasks: () => "- [ ] A",
      runClaude: async () => ({ ok: true }),
      gitDirty: () => true, commit: () => {},
      evaluate: async () => { evalCalls++; return { pass: true }; }, log: () => {},
    });
    expect(evalCalls).toBeGreaterThan(0);
  });

  it("stops with budget_exhausted once the deadline passes", async () => {
    let t = 0;
    const r = await runLoop({ ...base, timeoutMs: 100 }, {
      readTasks: () => "- [ ] A",
      runClaude: async () => ({ ok: true }),
      gitDirty: () => true, commit: () => {},
      gate: async () => ({ pass: true }),
      evaluate: async () => ({ pass: false }), log: () => {},
      now: () => (t += 1000),  // 첫 반복 안에서 데드라인을 넘긴다
    });
    expect(r).toEqual({ status: "budget_exhausted", iterations: 1 });
  });
});

describe("claudeArgs — 서브세션 권한", () => {
  // acceptEdits 는 **파일 편집만** 자동 승인한다. Bash 는 승인을 묻는데, 비대화형 `-p`
  // 세션에서 그 물음은 곧 거부다. 그래서 wave 서브세션이 테스트를 한 번도 돌리지 못하고
  // tdd-override 로 RED 없이 구현했다(add-plugin-doctor 사이클에서 실측).
  it("keeps acceptEdits and never escalates to bypassPermissions", () => {
    const a = claudeArgs("작업", { allowedTools: LOOP_ALLOWED_TOOLS });
    expect(a.slice(0, 2)).toEqual(["-p", "작업"]);
    expect(a).toContain("acceptEdits");
    expect(a.join(" ")).not.toContain("bypassPermissions");
  });

  it("passes the allowlist so the subsession can actually run its tests", () => {
    const a = claudeArgs("작업", { allowedTools: ["Bash(npm test:*)"] });
    const i = a.indexOf("--allowedTools");
    expect(i).toBeGreaterThan(-1);
    expect(a[i + 1]).toBe("Bash(npm test:*)");
  });

  it("omits the flag entirely when the allowlist is empty", () => {
    expect(claudeArgs("작업", { allowedTools: [] })).not.toContain("--allowedTools");
    expect(claudeArgs("작업")).not.toContain("--allowedTools");
  });

  it("allows the test runners and committing, but not pushing", () => {
    const joined = LOOP_ALLOWED_TOOLS.join(" ");
    for (const needed of ["node", "npx vitest", "npm test", "git add", "git commit"]) {
      expect(joined).toContain(needed);
    }
    expect(joined).not.toContain("git push");
  });
});
