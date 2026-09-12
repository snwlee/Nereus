import { describe, it, expect } from "vitest";
import { loadProfile, validateProfile } from "../../plugins/nereus-game/lib/profiles.mjs";

describe("loadProfile", () => {
  it("알려진 장르를 돌려준다", () => {
    const p = loadProfile("sim-tycoon");
    expect(p.genre).toBe("sim-tycoon");
    expect(Array.isArray(p.loop)).toBe(true);
    expect(p.loop.length).toBeGreaterThan(0);
    expect(p.balance).toBeDefined();
  });

  it("알 수 없는 장르는 기본값으로 떨어지지 않고 던진다", () => {
    expect(() => loadProfile("does-not-exist")).toThrow(/알 수 없는 장르/);
  });

  it("loop 가 없으면 검증 실패", () => {
    expect(validateProfile({ genre: "x", metrics: [], balance: {} })).toContain("loop");
  });

  it("두 장르의 루프가 서로 다르다", () => {
    expect(loadProfile("sim-tycoon").loop).not.toEqual(loadProfile("obby-platformer").loop);
  });
});
