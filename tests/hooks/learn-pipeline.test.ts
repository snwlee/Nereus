import { describe, it, expect } from "vitest";
import { handle as observeHook } from "../../plugins/nereus/hooks/scripts/observe.mjs";
import { handle as learnWatch } from "../../plugins/nereus/hooks/scripts/learn-watch.mjs";
import { aggregate, handle as sessionEnd } from "../../plugins/nereus/hooks/scripts/session-end.mjs";

describe("관찰 훅", () => {
  it("Bash·편집만 적재하고 출력은 내지 않는다", () => {
    const saved: any[] = [];
    const append = (_c: string, r: any) => { saved.push(r); return r; };
    observeHook({ cwd: "/r", tool_name: "Bash", tool_input: { command: "npm test" }, tool_response: { exit_code: 0 } }, { append });
    observeHook({ cwd: "/r", tool_name: "Read", tool_input: { file_path: "/r/a.ts" } }, { append });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ tool: "Bash", ok: true });
  });
});

describe("교정 훅", () => {
  const mk = () => { const marks = new Set<string>(); const saved: any[] = []; return { saved, deps: { append: (_c: string, r: any) => { saved.push(r); return r; }, hasMark: (k: string) => marks.has(k), setMark: (k: string) => marks.add(k) } }; };
  it("교정은 적재하고 안내는 세션당 한 번만 낸다", () => {
    const { saved, deps } = mk();
    const input = { cwd: "/r", session_id: "s", prompt: "아니 그게 아니라 jest 써" };
    expect(learnWatch(input, deps)).not.toBeNull();
    expect(learnWatch(input, deps)).toBeNull();
    expect(saved).toHaveLength(2);
    expect(saved[0].k).toBe("correction");
  });
  it("평범한 요청은 적재도 안내도 없다", () => {
    const { saved, deps } = mk();
    expect(learnWatch({ cwd: "/r", session_id: "s", prompt: "테스트 돌려줘" }, deps)).toBeNull();
    expect(saved).toHaveLength(0);
  });
});

describe("집계(SessionEnd)", () => {
  const obs = [
    { k: "tool", tool: "Bash", sig: "npm test", ok: false, t: 1 },
    { k: "tool", tool: "Edit", file: "src/a.ts", ok: true, t: 2 },
    { k: "tool", tool: "Bash", sig: "npm test", ok: true, t: 3 },
  ];
  it("관찰을 후보로 바꾸고 관찰 로그를 비운다", () => {
    let written: any[] = []; let cleared = false;
    const r = aggregate("/r", { observations: () => obs, read: () => [], write: (_c: string, l: any[]) => { written = l; }, clear: () => { cleared = true; }, now: 5 });
    expect(r.added).toBe(1);
    expect(written[0]).toMatchObject({ type: "fail_then_fix", status: "open", hits: 1 });
    expect(cleared).toBe(true);
  });
  it("관찰이 없으면 아무것도 쓰지 않는다", () => {
    let wrote = false;
    const r = aggregate("/r", { observations: () => [], read: () => [{ status: "open" }], write: () => { wrote = true; }, clear: () => {} });
    expect(wrote).toBe(false);
    expect(r).toEqual({ added: 0, open: 1 });
  });
  it("후보가 생기면 stderr 안내만 하고 컨텍스트는 내지 않는다", () => {
    const notes: string[] = [];
    const out = sessionEnd({ cwd: "/r" }, { note: (m: string) => notes.push(m), hasClaudeMem: () => true, aggregate: () => ({ added: 2, open: 3 }) });
    expect(out).toBeNull();
    expect(notes[0]).toContain("검토 대기 3건");
  });
  it("집계가 실패해도 세션 종료를 막지 않는다", () => {
    const notes: string[] = [];
    expect(sessionEnd({ cwd: "/r" }, { note: (m: string) => notes.push(m), hasClaudeMem: () => true, aggregate: () => { throw new Error("boom"); } })).toBeNull();
  });
});
