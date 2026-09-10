import { describe, it, expect } from "vitest";
import { runLoop, parseTasks, buildPrompt } from "../../plugins/nereus/skills/baton/scripts/loop-runner.mjs";

describe("loop-runner", () => {
  it("parses tasks with checkbox state", () => {
    const t = parseTasks("- [ ] A [flow]\n- [x] B\n  - [ ] C\ntext\n- [X] D");
    // wave 태그가 없으면 wave: null — [flow] 등 다른 태그는 텍스트에 그대로 남는다
    expect(t).toEqual([
      { text: "A [flow]", done: false, wave: null },
      { text: "B", done: true, wave: null },
      { text: "C", done: false, wave: null },
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
