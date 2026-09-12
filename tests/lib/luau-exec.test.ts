import { describe, it, expect } from "vitest";
import { runLuauTask, MAX_TASK_SECONDS, MAX_CONCURRENT } from "../../plugins/nereus-game/lib/luau-exec.mjs";

const base = { universeId: "1", placeId: "2", script: "return true", apiKey: "k" };
const deps = (states: string[]) => {
  let i = 0;
  return {
    sleep: async () => {},
    http: async (_url: string, opts: any) => {
      if (opts?.method === "POST") return { path: "tasks/abc", state: "PROCESSING" };
      const state = states[Math.min(i++, states.length - 1)];
      return { path: "tasks/abc", state, output: { results: [true] }, logs: ["ok"] };
    },
  };
};

describe("runLuauTask", () => {
  it("완료까지 폴링하고 통과를 판정한다", async () => {
    const r = await runLuauTask({ ...base, timeoutSeconds: 60 }, deps(["PROCESSING", "COMPLETE"]));
    expect(r.pass).toBe(true);
    expect(r.logs).toContain("ok");
  });

  it("실패 상태는 통과가 아니다", async () => {
    const r = await runLuauTask({ ...base, timeoutSeconds: 60 }, deps(["FAILED"]));
    expect(r.pass).toBe(false);
  });

  it("상한을 넘는 타임아웃은 거부한다", async () => {
    await expect(runLuauTask({ ...base, timeoutSeconds: MAX_TASK_SECONDS + 1 }, deps(["COMPLETE"])))
      .rejects.toThrow(/쪼/);
  });

  it("API 키가 없으면 네트워크를 부르지 않는다", async () => {
    let called = false;
    const spy = { sleep: async () => {}, http: async () => { called = true; return {}; } };
    const r = await runLuauTask({ ...base, apiKey: "", timeoutSeconds: 60 }, spy);
    expect(called).toBe(false);
    expect(r.configured).toBe(false);
  });

  it("동시 상한 상수를 노출한다", () => {
    expect(MAX_CONCURRENT).toBe(10);
  });
});
