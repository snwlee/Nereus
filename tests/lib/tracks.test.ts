import { describe, it, expect } from "vitest";
import { loadTracks, platformRule, revenueRule } from "../../plugins/nereus-game/lib/tracks.mjs";

describe("tracks", () => {
  it("규모 임계값은 추정이라고 표시돼 있다 — 실측 이력이 없다", () => {
    const t = loadTracks();
    expect(t.manyTrack.maxTasks).toBeGreaterThan(0);
    expect(t.manyTrack.estimate).toBe(true);
    expect(t.manyTrack.basis).toBeTruthy();
  });
  it("추정 표시가 없는 임계값은 거부한다 — 틀린 확신을 준다", () => {
    const deps = { readJson: () => ({ platforms: {}, revenue: {}, manyTrack: { maxTasks: 10 } }) };
    expect(() => loadTracks(deps)).toThrow(/estimate/);
  });
  it("로블록스는 깊게를 강제한다", () => {
    const r = platformRule(loadTracks(), "roblox");
    expect(r.forcesDeep).toBe(true);
    expect(r.why).toBeTruthy();
  });
  it("스팀은 강제하지 않는다", () => {
    expect(platformRule(loadTracks(), "steam").forcesDeep).toBe(false);
  });
  it("IAP 는 깊게를 강제하고 유료 단품은 강제하지 않는다", () => {
    const t = loadTracks();
    expect(revenueRule(t, "iap").forcesDeep).toBe(true);
    expect(revenueRule(t, "premium").forcesDeep).toBe(false);
  });
  it("알 수 없는 플랫폼은 기본값으로 떨어지지 않고 던진다", () => {
    expect(() => platformRule(loadTracks(), "nope")).toThrow(/알 수 없는 플랫폼/);
  });
  it("알 수 없는 수익 모델은 던진다", () => {
    expect(() => revenueRule(loadTracks(), "nope")).toThrow(/알 수 없는 수익 모델/);
  });
});
