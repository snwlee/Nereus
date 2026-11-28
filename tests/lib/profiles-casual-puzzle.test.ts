import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { loadProfile, listProfiles } from "../../plugins/nereus-game/lib/profiles.mjs";
import { checkSound } from "../../plugins/nereus-game/lib/sound-budget.mjs";
import { checkImpact } from "../../plugins/nereus-game/lib/impact-budget.mjs";
import { simulate } from "../../plugins/nereus-game/lib/balance-sim.mjs";
import { measureRetry } from "../../plugins/nereus-game/lib/retry-economy.mjs";

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

describe("casual-puzzle 곡선 회귀 게이트", () => {
  const profile = loadProfile("casual-puzzle");
  const smooth = {
    income: { base: 10, growth: 1.05 },
    stages: [
      { name: "L1", cost: 10 },
      { name: "L2", cost: 16 },
      { name: "L3", cost: 26 },
      { name: "L4", cost: 42 },
    ],
  };

  it("완만한 곡선은 절벽을 내지 않는다", () => {
    const r = simulate({ profile, economy: smooth, turns: 40, seed: 1 });
    expect(r.summary.cliffs).toEqual([]);
    expect(r.summary.primaryFailure).toBe("cliff");
  });

  // 2.5배 점프는 퍼즐에서만 벽이다. 오비(3)·타이쿤(8) 임계로는 안 잡힌다.
  // 12배 같은 큰 점프로 검사하면 어떤 임계값이든 통과해서 게이트가 아무 일도 하지 않는다.
  const walled = {
    ...smooth,
    stages: [...smooth.stages.slice(0, 2), { name: "WALL", cost: 40 }, { name: "L4", cost: 64 }],
  };

  it("퍼즐 임계에서는 2.5배 점프를 벽으로 잡는다", () => {
    const r = simulate({ profile, economy: walled, turns: 40, seed: 1 });
    expect(r.summary.cliffs).toContain(2);
  });

  it("같은 곡선이 타이쿤 임계에서는 벽이 아니다 — 임계가 실제로 일한다", () => {
    const r = simulate({ profile: loadProfile("sim-tycoon"), economy: walled, turns: 40, seed: 1 });
    expect(r.summary.cliffs).toEqual([]);
  });

  it("같은 시드는 같은 결과다", () => {
    const a = simulate({ profile, economy: smooth, turns: 40, seed: 7 });
    const b = simulate({ profile, economy: smooth, turns: 40, seed: 7 });
    expect(a.summary).toEqual(b.summary);
  });
});

describe("문서가 프로파일 목록과 어긋나지 않는다", () => {
  it("balance SKILL.md 가 casual-puzzle 을 언급한다", () => {
    const md = fs.readFileSync("plugins/nereus-game/skills/balance/SKILL.md", "utf8");
    expect(md).toContain("casual-puzzle");
  });

  it("수명(목숨) 판정이 문서에 적혀 있다", () => {
    const md = fs.readFileSync("plugins/nereus-game/skills/balance/SKILL.md", "utf8");
    expect(md).toMatch(/수명|에너지/);
  });

  it("SKILL.md 가 재시도·스타터 판정과 비통과 규칙을 적는다", () => {
    const md = fs.readFileSync("plugins/nereus-game/skills/balance/SKILL.md", "utf8");
    for (const c of ["retry-cliff", "retry-too-easy", "lives-wall", "continue-weak", "no-baseline", "unmeasured",
      "starter-missing", "starter-duplicate", "starter-not-one-time", "starter-not-cheapest", "starter-replaced-pricier",
      "회복 시간", "잠정"]) expect(md).toContain(c);
  });

  it("샘플 레벨 파일이 measureRetry 로 돈다", () => {
    const sample = JSON.parse(fs.readFileSync("plugins/nereus-game/skills/balance/assets/puzzle-levels.sample.json", "utf8"));
    const r = measureRetry({ profile: loadProfile("casual-puzzle"), ...sample });
    expect(r.levels.length).toBe(sample.levels.length);
    expect(r.violations.map((v: { code: string }) => v.code)).toContain("retry-cliff");
  });

  it("프로파일 note 가 재시도 경제를 미측정이라 하지 않는다", () => {
    expect(loadProfile("casual-puzzle").balance.note).not.toContain("아직 측정되지 않는다");
  });

  it("README 가 프로파일 다섯을 전부 적는다", () => {
    const md = fs.readFileSync("plugins/nereus-game/README.md", "utf8");
    for (const g of listProfiles()) expect(md).toContain(`\`${g}\``);
  });

  it("프로파일이 다섯이다", () => {
    expect(listProfiles().sort()).toEqual(
      ["battle-pvp", "casual-puzzle", "narrative", "obby-platformer", "sim-tycoon"],
    );
  });
});
