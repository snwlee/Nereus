import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { checkFrames } from "../../plugins/nereus-game/lib/frame-budget.mjs";

const ok = { targetFps: 60, build: "release", device: "target" };
const fill = (n: number, v: number) => Array.from({ length: n }, () => v);
const codes = (r: any) => r.violations.map((v: any) => v.code);

describe("프레임 예산", () => {
  it("예산 안의 릴리스·대상 기기 측정은 통과", () => {
    const r = checkFrames({ ...ok, samplesMs: fill(100, 10) });
    expect(r.budgetMs).toBeCloseTo(16.667, 2);
    expect(r.p95).toBe(10);
    expect(r.pass).toBe(true);
  });
  it("p95 가 예산을 넘으면 over-budget", () => {
    expect(codes(checkFrames({ ...ok, samplesMs: fill(100, 20) }))).toContain("over-budget");
  });
  it("예산 2배 초과 프레임이 1% 넘으면 hitch-rate", () => {
    const r = checkFrames({ ...ok, samplesMs: [...fill(95, 10), ...fill(5, 40)] });
    expect(codes(r)).toEqual(["hitch-rate"]);
    expect(r.p99).toBe(40);
  });
  it("후반이 전반보다 크게 느려지면 thermal-drop", () => {
    expect(codes(checkFrames({ ...ok, samplesMs: [...fill(100, 12), ...fill(100, 25)] }))).toContain("thermal-drop");
  });
  it("프레임당 GC 할당은 0 이어야 한다", () => {
    expect(codes(checkFrames({ ...ok, samplesMs: fill(100, 10), gcBytesPerFrame: 512 }))).toContain("gc-per-frame");
  });
  it("에디터 측정은 위반이 없어도 통과가 아니다", () => {
    const r = checkFrames({ ...ok, build: "editor", samplesMs: fill(100, 10) });
    expect(r.violations).toEqual([]);
    expect(r.evidence).toBe(false);
    expect(r.pass).toBe(false);
  });
  it("CPU·GPU 시간으로 병목 쪽을 가른다", () => {
    expect(checkFrames({ ...ok, samplesMs: fill(10, 15), cpuMs: 5, gpuMs: 14 }).bound).toBe("gpu");
    expect(checkFrames({ ...ok, samplesMs: fill(10, 15) }).bound).toBe("unknown");
  });
  it("목표 FPS 나 표본이 없으면 던진다", () => {
    expect(() => checkFrames({ ...ok, targetFps: 0, samplesMs: [10] })).toThrow();
    expect(() => checkFrames({ ...ok, samplesMs: [] })).toThrow();
  });
  it("프로세스로 돌면 stdout JSON 을 낸다", () => {
    const out = execFileSync("node", ["plugins/nereus-game/lib/frame-budget.mjs"], {
      input: JSON.stringify({ ...ok, samplesMs: fill(100, 20) }),
      encoding: "utf8",
    });
    expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("over-budget");
  });
  // 리뷰 R1: 숫자가 아닌 표본이 섞이면 정렬·백분위가 깨진 채 판정했다.
  it("숫자가 아니거나 음수인 표본은 던진다", () => {
    expect(() => checkFrames({ ...ok, samplesMs: [10, NaN, 12] })).toThrow();
    expect(() => checkFrames({ ...ok, samplesMs: [10, "12" as any] })).toThrow();
    expect(() => checkFrames({ ...ok, samplesMs: [10, -1] })).toThrow();
  });
});
