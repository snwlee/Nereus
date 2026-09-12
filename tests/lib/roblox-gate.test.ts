import { describe, it, expect } from "vitest";
import { robloxStageTwo } from "../../plugins/nereus-game/lib/roblox-gate.mjs";

const robloxFs = { exists: (p: string) => p.endsWith("default.project.json"), readFile: () => "" };
const plainFs = { exists: () => false, readFile: () => "" };

describe("robloxStageTwo", () => {
  it("로블록스가 아니면 건너뛴다", async () => {
    const r = await robloxStageTwo({ cwd: "/p", env: {} }, { fsx: plainFs, run: async () => ({}) });
    expect(r.status).toBe("skipped");
  });

  it("자격증명이 없으면 미설정으로 통과시킨다", async () => {
    let called = false;
    const r = await robloxStageTwo(
      { cwd: "/p", env: {} },
      { fsx: robloxFs, run: async () => { called = true; return {}; } },
    );
    expect(r.status).toBe("unconfigured");
    expect(r.pass).toBe(true);
    expect(called).toBe(false);
  });

  it("2단이 실패하면 통과가 아니다", async () => {
    const env = { ROBLOX_API_KEY: "k", ROBLOX_UNIVERSE_ID: "1", ROBLOX_PLACE_ID: "2" };
    const r = await robloxStageTwo(
      { cwd: "/p", env },
      { fsx: robloxFs, run: async () => ({ configured: true, pass: false, logs: ["boom"] }) },
    );
    expect(r.status).toBe("failed");
    expect(r.pass).toBe(false);
    expect(r.logs).toContain("boom");
  });

  it("2단이 통과하면 통과다", async () => {
    const env = { ROBLOX_API_KEY: "k", ROBLOX_UNIVERSE_ID: "1", ROBLOX_PLACE_ID: "2" };
    const r = await robloxStageTwo(
      { cwd: "/p", env },
      { fsx: robloxFs, run: async () => ({ configured: true, pass: true, logs: [] }) },
    );
    expect(r.status).toBe("passed");
    expect(r.pass).toBe(true);
  });

  it("2단 호출이 예외를 던져도 finish 를 죽이지 않는다", async () => {
    const env = { ROBLOX_API_KEY: "k", ROBLOX_UNIVERSE_ID: "1", ROBLOX_PLACE_ID: "2" };
    const r = await robloxStageTwo(
      { cwd: "/p", env },
      { fsx: robloxFs, run: async () => { throw new Error("ECONNRESET"); } },
    );
    expect(r.status).toBe("failed");
    expect(r.pass).toBe(false);
    expect(r.reason).toContain("ECONNRESET");
  });
});
