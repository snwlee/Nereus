import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  runLoop,
  parseTasks,
  planWaves,
  planWorktree,
  runWave,
  WAVE_RE,
} from "../../plugins/nereus/skills/baton/scripts/loop-runner.mjs";

const T = (s: string) => `- [ ] ${s}`;

describe("parseTasks — wave 태그", () => {
  it("keeps the existing shape and adds wave: null when untagged", () => {
    const t = parseTasks([T("로그인 폼"), "- [x] 완료된 것"].join("\n"));
    expect(t).toEqual([
      { text: "로그인 폼", done: false, wave: null },
      { text: "완료된 것", done: true, wave: null },
    ]);
  });

  it("reads [wave:N] and strips it from the text", () => {
    const t = parseTasks(T("[wave:2] 결제 API"));
    expect(t[0]).toMatchObject({ text: "결제 API", wave: 2, done: false });
  });

  it("tolerates spacing and case like the [flow] tag does", () => {
    for (const tag of ["[wave:1]", "[Wave: 1]", "[WAVE:1]", "[wave : 1]"]) {
      expect(parseTasks(T(`${tag} x`))[0].wave).toBe(1);
    }
  });

  it("keeps other tags such as [flow] in the text", () => {
    const t = parseTasks(T("[wave:1] [flow] 결제 흐름"));
    expect(t[0].text).toBe("[flow] 결제 흐름");
    expect(t[0].wave).toBe(1);
  });

  it("ignores a malformed wave tag instead of guessing", () => {
    expect(parseTasks(T("[wave:] x"))[0].wave).toBeNull();
    expect(parseTasks(T("[wave:abc] x"))[0].wave).toBeNull();
    expect(parseTasks(T("[wave:0] x"))[0].wave).toBeNull(); // 1부터
  });

  it("WAVE_RE is not global — a shared regex with /g leaks lastIndex", () => {
    expect(WAVE_RE.global).toBe(false);
  });
});

describe("planWaves — 순서를 보존하며 인접한 같은 wave 만 묶는다", () => {
  const p = (lines: string[]) => planWaves(parseTasks(lines.join("\n")));

  it("groups adjacent tasks that share a wave number", () => {
    const g = p([T("[wave:1] a"), T("[wave:1] b"), T("[wave:2] c")]);
    expect(g.map((x) => x.map((t) => t.text))).toEqual([["a", "b"], ["c"]]);
  });

  it("puts untagged tasks in their own group so they stay sequential", () => {
    const g = p([T("a"), T("b")]);
    expect(g.map((x) => x.length)).toEqual([1, 1]);
  });

  it("does NOT merge the same wave number across a gap — declaration order carries implicit dependency", () => {
    // [wave:1] a / [wave:2] b / [wave:1] c 에서 a 와 c 를 합치면 b 를 앞질러 실행된다.
    const g = p([T("[wave:1] a"), T("[wave:2] b"), T("[wave:1] c")]);
    expect(g.map((x) => x.map((t) => t.text))).toEqual([["a"], ["b"], ["c"]]);
  });

  it("skips done tasks", () => {
    const g = planWaves(parseTasks(["- [x] [wave:1] done", T("[wave:1] a")].join("\n")));
    expect(g.map((x) => x.map((t) => t.text))).toEqual([["a"]]);
  });

  it("returns [] when everything is done", () => {
    expect(planWaves(parseTasks("- [x] a"))).toEqual([]);
  });

  it("a single-task wave group is indistinguishable from the sequential path", () => {
    const g = p([T("[wave:1] only")]);
    expect(g).toHaveLength(1);
    expect(g[0]).toHaveLength(1);
  });
});

describe("planWorktree — 병렬 실행은 반드시 격리된다", () => {
  it("derives a worktree dir and branch per task from a stable slug", () => {
    const w = planWorktree({ task: { text: "결제 API 추가" }, index: 0, root: "/repo", base: "abc1234" });
    expect(w.branch).toMatch(/^baton\/wave-/);
    expect(w.dir).toContain(path.join(".nereus", "worktrees"));
    expect(w.args).toEqual(["worktree", "add", "-b", w.branch, w.dir, "abc1234"]);
  });

  it("gives distinct paths to distinct tasks in the same wave", () => {
    const a = planWorktree({ task: { text: "a" }, index: 0, root: "/repo", base: "h" });
    const b = planWorktree({ task: { text: "b" }, index: 1, root: "/repo", base: "h" });
    expect(a.dir).not.toBe(b.dir);
    expect(a.branch).not.toBe(b.branch);
  });

  it("slugifies unsafe text into one path segment", () => {
    const w = planWorktree({ task: { text: "../../etc/passwd 를 고쳐" }, index: 0, root: "/repo", base: "h" });
    expect(w.branch).not.toContain("..");
    expect(path.basename(w.dir)).not.toContain("/");
  });
});

describe("runWave", () => {
  const task = (text: string) => ({ text, done: false, wave: 1 });

  const mkDeps = (over: any = {}) => {
    const calls: any[] = [];
    return {
      calls,
      deps: {
        head: () => "base1",
        addWorktree: (w: any) => { calls.push(["add", w.dir]); return { ok: true }; },
        removeWorktree: (w: any) => { calls.push(["remove", w.dir]); return { ok: true }; },
        runClaude: async (_p: string, cwd: string) => { calls.push(["claude", cwd]); return { ok: true }; },
        commitIn: (cwd: string) => { calls.push(["commit", cwd]); return { ok: true }; },
        mergeBranch: (b: string) => { calls.push(["merge", b]); return { ok: true }; },
        abortMerge: () => { calls.push(["abort"]); return { ok: true }; },
        log: () => {},
        ...over,
      },
    };
  };

  it("runs a single-task wave in the main worktree — no isolation overhead", async () => {
    const { calls, deps } = mkDeps();
    const r = await runWave([task("only")], { root: "/repo", goal: "g", paths: {} }, deps);
    expect(r.ok).toBe(true);
    expect(calls.some((c) => c[0] === "add")).toBe(false);
    expect(calls.filter((c) => c[0] === "claude")).toHaveLength(1);
    expect(calls[calls.length - 1][0]).not.toBe("merge");
  });

  it("isolates every task of a multi-task wave and merges them back in order", async () => {
    const { calls, deps } = mkDeps();
    const r = await runWave([task("a"), task("b")], { root: "/repo", goal: "g", paths: {} }, deps);
    expect(r.ok).toBe(true);
    expect(calls.filter((c) => c[0] === "add")).toHaveLength(2);
    expect(calls.filter((c) => c[0] === "claude")).toHaveLength(2);
    // 병합은 순차 — 동시에 merge 하면 인덱스가 깨진다
    const merges = calls.filter((c) => c[0] === "merge");
    expect(merges).toHaveLength(2);
    expect(calls.filter((c) => c[0] === "remove")).toHaveLength(2);
  });

  it("commits inside each worktree before merging — an uncommitted worktree merges nothing", async () => {
    const { calls, deps } = mkDeps();
    await runWave([task("a"), task("b")], { root: "/repo", goal: "g", paths: {} }, deps);
    const firstMerge = calls.findIndex((c) => c[0] === "merge");
    const commits = calls.map((c, i) => [c, i]).filter(([c]: any) => c[0] === "commit");
    expect(commits.length).toBe(2);
    for (const [, i] of commits as any) expect(i).toBeLessThan(firstMerge);
  });

  it("reports a merge conflict AND aborts it — half-merged state breaks the next run", async () => {
    // 실측에서 잡힌 결함: 반환값만 보면 통과하지만 저장소에 MERGE_HEAD 와 UU 가 남았다.
    const { calls, deps } = mkDeps({ mergeBranch: (b: string) => ({ ok: false, conflict: true, branch: b }) });
    const r = await runWave([task("a"), task("b")], { root: "/repo", goal: "g", paths: {} }, deps);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/conflict|충돌/i);
    expect(r.branch).toBeTruthy();
    // 충돌을 되돌려 저장소를 깨끗하게 남긴다
    expect(calls.some((c) => c[0] === "abort")).toBe(true);
  });

  it("keeps the task branches after a conflict so the work is recoverable", async () => {
    const { calls, deps } = mkDeps({ mergeBranch: (b: string) => ({ ok: false, conflict: true, branch: b }) });
    const r = await runWave([task("a"), task("b")], { root: "/repo", goal: "g", paths: {} }, deps);
    // 워크트리는 정리하되 브랜치를 지우는 호출은 없어야 한다
    expect(calls.some((c) => c[0] === "remove")).toBe(true);
    expect(calls.some((c) => c[0] === "delete-branch")).toBe(false);
    expect(r.branch).toMatch(/^baton\//);
  });

  it("always removes the worktrees it created, even when a task fails", async () => {
    const { calls, deps } = mkDeps({ runClaude: async () => ({ ok: false, error: "boom" }) });
    await runWave([task("a"), task("b")], { root: "/repo", goal: "g", paths: {} }, deps);
    expect(calls.filter((c) => c[0] === "remove")).toHaveLength(2);
  });

  it("refuses to isolate when git cannot report HEAD — a wrong base silently forks from nowhere", async () => {
    const { deps } = mkDeps({ head: () => null });
    const r = await runWave([task("a"), task("b")], { root: "/repo", goal: "g", paths: {} }, deps);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/HEAD/);
  });
});

describe("runLoop — wave 연결 (연결 없으면 runWave 는 죽은 코드다)", () => {
  const mk = (tasksText: string[], over: any = {}) => {
    let idx = 0;
    const seen: any[] = [];
    return {
      seen,
      deps: {
        readTasks: () => tasksText[Math.min(idx, tasksText.length - 1)],
        // runWave 를 주입해 runLoop 이 실제로 그것을 부르는지 본다
        runWave: async (group: any[]) => { seen.push(group.map((t) => t.text)); idx++; return { ok: true }; },
        gitDirty: () => false,
        commit: () => {},
        evaluate: async () => ({ pass: true }),
        log: () => {},
        ...over,
      },
    };
  };

  it("hands a whole wave group to runWave, not one task at a time", async () => {
    const { seen, deps } = mk([
      "- [ ] [wave:1] a\n- [ ] [wave:1] b",
      "- [x] [wave:1] a\n- [x] [wave:1] b",
    ]);
    const r = await runLoop({ cwd: "/repo", max: 3, goal: "g", paths: { tasks: "t.md" } }, deps);
    expect(seen[0]).toEqual(["a", "b"]);
    expect(r.status).toBe("converged");
  });

  it("untagged tasks still go one at a time (하위 호환)", async () => {
    const { seen, deps } = mk([
      "- [ ] a\n- [ ] b",
      "- [x] a\n- [ ] b",
      "- [x] a\n- [x] b",
    ]);
    await runLoop({ cwd: "/repo", max: 3, goal: "g", paths: { tasks: "t.md" } }, deps);
    expect(seen[0]).toEqual(["a"]);
    expect(seen[1]).toEqual(["b"]);
  });

  it("stops on a merge conflict instead of retrying blindly", async () => {
    const { deps } = mk(["- [ ] [wave:1] a\n- [ ] [wave:1] b"], {
      runWave: async () => ({ ok: false, reason: "병합 충돌(conflict): baton/wave-0-a", branch: "baton/wave-0-a" }),
    });
    const r = await runLoop({ cwd: "/repo", max: 5, goal: "g", paths: { tasks: "t.md" } }, deps);
    expect(r.status).toBe("conflict");
    expect(r.branch).toBe("baton/wave-0-a");
  });
});
