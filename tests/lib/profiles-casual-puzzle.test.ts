import { describe, it, expect } from "vitest";
import { loadProfile } from "../../plugins/nereus-game/lib/profiles.mjs";
import { checkSound } from "../../plugins/nereus-game/lib/sound-budget.mjs";
import { checkImpact } from "../../plugins/nereus-game/lib/impact-budget.mjs";

describe("casual-puzzle 프로파일", () => {
  it("로드되고 루프·지표를 가진다", () => {
    const p = loadProfile("casual-puzzle");
    expect(p.genre).toBe("casual-puzzle");
    expect(p.loop.length).toBeGreaterThan(0);
    expect(p.metrics.length).toBeGreaterThan(0);
  });

  it("시뮬레이터가 읽는 balance 키가 전부 숫자다", () => {
    const b = loadProfile("casual-puzzle").balance;
    expect(typeof b.failureMode).toBe("string");
    expect(Number.isFinite(b.cliffRatio)).toBe(true);
    expect(Number.isFinite(b.dominanceRatio)).toBe(true);
    expect(Number.isFinite(b.targetTurnsToFirstStage)).toBe(true);
  });

  it("failureMode 는 시뮬레이터가 실제로 계산하는 축이다", () => {
    const computed = ["bottleneck", "cliff", "dominant-strategy"];
    expect(computed).toContain(loadProfile("casual-puzzle").balance.failureMode);
  });

  it("sound·impact 게이트가 no-baseline 으로 떨어지지 않는다", () => {
    const profile = loadProfile("casual-puzzle");
    expect(checkSound({ profile, plan: { cues: [], actions: [] } }).violations)
      .not.toContainEqual(expect.objectContaining({ code: "no-baseline" }));
    expect(checkImpact({ profile, plan: { cues: [] } }).violations)
      .not.toContainEqual(expect.objectContaining({ code: "no-baseline" }));
  });

  it("l10n·typography·liveops 기준을 가진다", () => {
    const p = loadProfile("casual-puzzle");
    expect(Number.isFinite(p.liveops.retentionDriftPct)).toBe(true);
    expect(Number.isFinite(p.l10n.maxWidth)).toBe(true);
    expect(Number.isFinite(p.typography.maxFontKb)).toBe(true);
    expect(Number.isFinite(p.typography.minSizePx)).toBe(true);
  });

  it("퍼즐 절벽 임계는 타이쿤보다 좁다", () => {
    expect(loadProfile("casual-puzzle").balance.cliffRatio)
      .toBeLessThan(loadProfile("sim-tycoon").balance.cliffRatio);
  });
});
