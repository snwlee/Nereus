import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { measureRetry } from "../../plugins/nereus-game/lib/retry-economy.mjs";
import { loadProfile } from "../../plugins/nereus-game/lib/profiles.mjs";

// 픽스처: 진척 [0, 2] 의 합은 평균 moves, 표준편차 √(moves/3) — 정규 근사로 목표 클리어율을 맞춘 값이다(tasks.md 픽스처 표).
const profile = loadProfile("casual-puzzle");
const midProfile = { ...profile, retry: { ...profile.retry, earlyLevels: 0 } };
const lvl = (name: string, goal: number, extra: Record<string, unknown> = {}) =>
  ({ name, moves: 20, goal, progress: [0, 2], ...extra });
const codes = (r: { violations: Array<{ code: string }> }) => r.violations.map((v) => v.code);
const forLevel = (r: { violations: Array<{ code: string; level?: string }> }, name: string) =>
  r.violations.filter((v) => v.level === name).map((v) => v.code);
const CLI = "plugins/nereus-game/lib/retry-economy.mjs";
const runCli = (input: string) => spawnSync(process.execPath, [CLI], { input, encoding: "utf8" });

describe("재시도 측정 — 결정성과 지표", () => {
  it("같은 시드는 같은 결과", () => {
    const levels = [lvl("A", 20), lvl("B", 21)];
    expect(measureRetry({ profile, levels, seed: 5 })).toEqual(measureRetry({ profile, levels, seed: 5 }));
  });

  it("레벨을 끼워 넣어도 다른 레벨의 지표는 그대로", () => {
    const before = measureRetry({ profile, levels: [lvl("A", 20), lvl("B", 21)], seed: 1 });
    const after = measureRetry({ profile, levels: [lvl("새", 19), lvl("A", 20), lvl("B", 21)], seed: 1 });
    expect(after.levels.slice(1)).toEqual(before.levels);
  });

  it("이어하기 유무는 기본 판 결과를 바꾸지 않는다", () => {
    const levels = [lvl("A", 21)];
    const without = measureRetry({ profile, levels, seed: 2 });
    const withOffer = measureRetry({ profile, levels, seed: 2, continueOffer: { moves: 5, price: 900 } });
    expect(withOffer.levels[0].firstTryWinRate).toBe(without.levels[0].firstTryWinRate);
  });

  it("이동 수가 클리어율을 움직인다", () => {
    const levels = [
      { name: "짧음", moves: 18, goal: 20, progress: [0, 2] },
      { name: "김", moves: 22, goal: 20, progress: [0, 2] },
    ];
    const r = measureRetry({ profile, levels, seed: 1 });
    expect(r.levels[1].firstTryWinRate - r.levels[0].firstTryWinRate).toBeGreaterThanOrEqual(0.4);
  });

  it("누적 클리어율", () => {
    const r = measureRetry({ profile, levels: [lvl("A", 20.5)], seed: 1 });
    const { firstTryWinRate: p, cumulativeWinRate } = r.levels[0];
    expect(cumulativeWinRate).toHaveLength(profile.retry.attempts);
    cumulativeWinRate.forEach((c: number, i: number) => expect(c).toBeCloseTo(1 - (1 - p) ** (i + 1), 3));
  });
});

describe("재시도 판정 — 티어", () => {
  it("중반 레벨 클리어율 하한 미만", () => {
    const r = measureRetry({ profile: midProfile, levels: [lvl("벽", 23)], seed: 1 });
    expect(r.levels[0].tier).toBe("mid");
    expect(forLevel(r, "벽")).toContain("retry-cliff");
  });

  it("초반 레벨 기본 티어", () => {
    const r = measureRetry({ profile, levels: [lvl("첫", 21)], seed: 1 });
    expect(r.levels[0].tier).toBe("early");
    expect(forLevel(r, "첫")).toContain("retry-cliff");
  });

  it("티어를 적은 레벨도 위치에 센다", () => {
    const p1 = { ...profile, retry: { ...profile.retry, earlyLevels: 1 } };
    const r = measureRetry({ profile: p1, levels: [lvl("H", 21.7, { tier: "hard" }), lvl("다음", 20)], seed: 1 });
    expect(r.levels[1].tier).toBe("mid");
  });

  it("게임별 기준 덮어쓰기", () => {
    const retry = { ...profile.retry, earlyLevels: 0,
      tiers: { ...profile.retry.tiers, mid: { firstTry: [0.05, 0.9], maxLivesOut: 0.1 } } };
    const out = runCli(JSON.stringify({ genre: "casual-puzzle", retry, levels: [lvl("벽", 23)], seed: 1 }));
    expect(out.status).toBe(0);
    expect(JSON.parse(out.stdout).violations).toEqual([]);
    const base = runCli(JSON.stringify({ genre: "casual-puzzle", retry: { ...retry, tiers: profile.retry.tiers }, levels: [lvl("벽", 23)], seed: 1 }));
    expect(JSON.parse(base.stdout).violations.map((v: { code: string }) => v.code)).toContain("retry-cliff");
  });

  it("명시한 티어가 위치 규칙보다 우선", () => {
    const r = measureRetry({ profile, levels: [lvl("H", 21.7, { tier: "hard" })], seed: 1 });
    expect(r.levels[0].tier).toBe("hard");
    expect(r.violations).toEqual([]);
  });

  it("하드 레벨 클리어율 상한 초과", () => {
    const r = measureRetry({ profile, levels: [lvl("쉬운하드", 18, { tier: "hard" })], seed: 1 });
    expect(forLevel(r, "쉬운하드")).toContain("retry-too-easy");
  });

  it("결정적 레벨과 범위 경계", () => {
    const r = measureRetry({ profile, levels: [{ name: "D", moves: 10, goal: 3, progress: [0.3, 0.3] }], seed: 1 });
    expect(r.levels[0].firstTryWinRate).toBe(1);
    expect(codes(r)).not.toContain("retry-too-easy");
  });
});

describe("재시도 판정 — 목숨", () => {
  it("목숨 벽", () => {
    const r = measureRetry({ profile: midProfile, levels: [lvl("벽", 23)], lives: { cap: 5 }, seed: 1 });
    expect(r.levels[0].livesOutRate).toBeGreaterThan(0.1);
    expect(forLevel(r, "벽")).toContain("lives-wall");
  });

  it("범위 안 하드 레벨은 `lives.cap` 5 에서 벽이 아니다", () => {
    const r = measureRetry({ profile, levels: [lvl("H", 21.7, { tier: "hard" })], lives: { cap: 5 }, seed: 1 });
    expect(r.levels[0].firstTryWinRate).toBeGreaterThanOrEqual(0.2);
    expect(r.levels[0].firstTryWinRate).toBeLessThanOrEqual(0.3);
    expect(codes(r)).not.toContain("lives-wall");
  });

  it("목숨 3개면 중반 하한 근처 레벨이 벽이다", () => {
    const r = measureRetry({ profile: midProfile, levels: [lvl("M", 20.3)], lives: { cap: 3 }, seed: 1 });
    expect(r.levels[0].firstTryWinRate).toBeGreaterThanOrEqual(0.4);
    expect(r.levels[0].firstTryWinRate).toBeLessThanOrEqual(0.5);
    expect(forLevel(r, "M")).toEqual(["lives-wall"]);
  });

  it("0 이하 목숨은 목숨 없음", () => {
    const r = measureRetry({ profile, levels: [lvl("A", 20)], lives: { cap: 0 }, seed: 1 });
    expect(r.levels[0].livesOutRate).toBeNull();
    expect(r.unmeasured).toContain("lives");
  });
});

describe("재시도 판정 — 이어하기", () => {
  it("약한 이어하기", () => {
    const r = measureRetry({ profile: midProfile, levels: [lvl("벽", 23)], continueOffer: { moves: 1, price: 900 }, seed: 1 });
    expect(r.levels[0].continueSaveRate).toBeLessThan(0.3);
    expect(forLevel(r, "벽")).toContain("continue-weak");
    expect(r.levels[0].continueCostPerClear).toBeGreaterThan(0);
  });

  it("실패가 적으면 이어하기를 재지 않는다", () => {
    const r = measureRetry({ profile, levels: [lvl("쉬움", 14)], continueOffer: { moves: 5, price: 900 }, seed: 1 });
    expect(r.levels[0].continueSaveRate).toBeNull();
    expect(r.levels[0].continueCostPerClear).toBeNull();
    expect(codes(r)).not.toContain("continue-weak");
  });
});

describe("재시도 판정 — 경계·빈 입력·기준", () => {
  it("경계 레벨 표시", () => {
    const r = measureRetry({ profile: midProfile, levels: [lvl("경계", 20.65), lvl("가운데", 20)], seed: 1 });
    expect(r.levels[0].borderline).toBe(true);
    expect(r.levels[1].borderline).toBe(false);
  });

  it("넘을 수 없는 경계는 보지 않는다", () => {
    const r = measureRetry({ profile, levels: [{ name: "D", moves: 10, goal: 3, progress: [0.3, 0.3] }], seed: 1 });
    expect(r.levels[0].borderline).toBe(false);
  });

  it("이름 없이 id 만 있는 레벨은 id 로 보고한다", () => {
    const r = measureRetry({ profile: midProfile, levels: [{ id: "lv-14", moves: 20, goal: 23, progress: [0, 2] }], seed: 1 });
    expect(r.levels[0].name).toBe("lv-14");
    expect(forLevel(r, "lv-14")).toContain("retry-cliff");
  });

  it("빈 레벨 목록", () => {
    const r = measureRetry({ profile, levels: [], seed: 1 });
    expect(r.levels).toEqual([]);
    expect(r.violations).toEqual([]);
    expect(r.unmeasured).toContain("levels");
  });

  it("재지 않은 축", () => {
    const r = measureRetry({ profile, levels: [lvl("A", 20)], seed: 1 });
    expect(r.unmeasured).toEqual(["lives", "continue"]);
    expect(r.levels[0].livesOutRate).toBeNull();
    expect(r.levels[0].continueSaveRate).toBeNull();
    expect(r.levels[0].continueCostPerClear).toBeNull();
  });

  it("기준 없는 장르", () => {
    const r = measureRetry({ profile: loadProfile("sim-tycoon"), levels: [lvl("A", 20)], seed: 1 });
    expect(r.levels).toHaveLength(1);
    expect(r.levels[0].borderline).toBe(false);
    expect(r.violations[0].code).toBe("no-baseline");
    expect(r.violations[0]).not.toHaveProperty("level");
  });

  it("CLI 종료 코드", () => {
    const ok = runCli(JSON.stringify({ genre: "casual-puzzle", levels: [lvl("첫", 21)], seed: 1 }));
    expect(ok.status).toBe(0);
    expect(JSON.parse(ok.stdout).violations.map((v: { code: string }) => v.code)).toContain("retry-cliff");
    const bad = runCli("{");
    expect(bad.status).toBe(1);
    expect(bad.stderr).not.toBe("");
  });

  it("잘못된 입력", () => {
    const m = (over: Record<string, unknown>) => () => measureRetry({ profile, levels: [lvl("A", 20)], seed: 1, ...over });
    expect(m({ levels: null })).toThrow();
    expect(m({ levels: [lvl("A", 20, { moves: 0 })] })).toThrow(/moves/);
    expect(m({ levels: [lvl("A", 20, { moves: 1001 })] })).toThrow(/moves/);
    expect(m({ levels: [lvl("A", 0)] })).toThrow(/goal/);
    expect(m({ levels: [lvl("A", 20, { progress: [2, 1] })] })).toThrow(/progress/);
    expect(m({ levels: [lvl("A", 20), lvl("A", 21)] })).toThrow(/A/);
    expect(m({ levels: [lvl("", 20)] })).toThrow();
    expect(m({ levels: [lvl("A", 20, { tier: "boss" })] })).toThrow(/tier/);
    expect(m({ lives: { cap: 2.5 } })).toThrow(/cap/);
    expect(m({ lives: "5" })).toThrow(/lives/);
    expect(m({ continueOffer: { moves: 0, price: 1 } })).toThrow(/continueOffer/);
    expect(m({ continueOffer: { moves: 1, price: -1 } })).toThrow(/price/);
    const broken = (retry: Record<string, unknown>) => () =>
      measureRetry({ profile: { ...profile, retry: { ...profile.retry, ...retry } }, levels: [lvl("A", 20)] });
    expect(() => measureRetry({ profile: { ...profile, retry: null }, levels: [lvl("A", 20)] })).toThrow(/retry/);
    expect(broken({ trials: 0 })).toThrow(/trials/);
    expect(broken({ trials: 100001 })).toThrow(/trials/);
    expect(broken({ minContinueFailures: undefined })).toThrow(/minContinueFailures/);
    expect(broken({ earlyLevels: -1 })).toThrow(/earlyLevels/);
    expect(broken({ tiers: { early: profile.retry.tiers.early, mid: profile.retry.tiers.mid } })).toThrow(/hard/);
    expect(broken({ tiers: { ...profile.retry.tiers, mid: { firstTry: [0.6, 0.4], maxLivesOut: 0.1 } } })).toThrow(/firstTry/);
    expect(broken({ minContinueSave: 2 })).toThrow(/minContinueSave/);
    const many = Array.from({ length: 200 }, (_, i) => ({ name: `L${i}`, moves: 1000, goal: 900, progress: [0, 2] }));
    expect(() => measureRetry({ profile, levels: many })).toThrow(/2e8|추출/);
  });
});
