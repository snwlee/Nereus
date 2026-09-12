import { describe, it, expect } from "vitest";
import { checkImpact } from "../../plugins/nereus-game/lib/impact-budget.mjs";

const profile = { impact: { maxFrozenMsPerSec: 120, maxShakeAmplitude: 0.8, maxParticles: 500, minInputBufferMs: 100 } };
const codes = (r: any) => r.violations.map((v: any) => v.code);
const fullCue = (over: any = {}) => ({ name: "hit", visual: true, sound: "swing", haptic: true, ...over });
const okPlan = { maxParticles: 100, inputBufferMs: 120, cues: [fullCue()] };

describe("impact budget", () => {
  it("프로파일에 impact 기준이 없으면 통과가 아니라 no-baseline 이다", () => {
    expect(codes(checkImpact({ profile: {}, plan: okPlan }))).toEqual(["no-baseline"]);
  });

  it("히트스톱 누적이 예산을 넘으면 hitstop-budget", () => {
    const plan = { ...okPlan, cues: [fullCue({ hitstopMs: 100, hitsPerSecond: 3 })] };
    expect(codes(checkImpact({ profile, plan }))).toContain("hitstop-budget");
  });

  it("개별 히트스톱은 짧아도 합이 넘으면 잡는다 — 이것이 개별 값만 보면 놓치는 양상이다", () => {
    const plan = { ...okPlan, cues: [
      fullCue({ name: "a", hitstopMs: 50, hitsPerSecond: 1 }),
      fullCue({ name: "b", hitstopMs: 40, hitsPerSecond: 1 }),
      fullCue({ name: "c", hitstopMs: 40, hitsPerSecond: 1 }),
    ] };
    const r = checkImpact({ profile, plan });
    expect(codes(r)).toContain("hitstop-budget");
    expect(r.violations.find((v: any) => v.code === "hitstop-budget").frozenMsPerSec).toBe(130);
  });

  it("동시 활성 셰이크 진폭의 합이 넘으면 shake-amplitude", () => {
    const plan = { ...okPlan, cues: [
      fullCue({ name: "a", shake: { amplitude: 0.4, concurrent: true }, reducedMotion: "플래시로 대체" }),
      fullCue({ name: "b", shake: { amplitude: 0.5, concurrent: true }, reducedMotion: "플래시로 대체" }),
    ] };
    expect(codes(checkImpact({ profile, plan }))).toContain("shake-amplitude");
  });

  it("동시에 활성되지 않는 셰이크는 합에 넣지 않는다", () => {
    const plan = { ...okPlan, cues: [
      fullCue({ name: "a", shake: { amplitude: 0.6, concurrent: false }, reducedMotion: "플래시" }),
      fullCue({ name: "b", shake: { amplitude: 0.6, concurrent: false }, reducedMotion: "플래시" }),
    ] };
    expect(codes(checkImpact({ profile, plan }))).not.toContain("shake-amplitude");
  });

  it("파티클 동시 수가 넘으면 particle-budget", () => {
    expect(codes(checkImpact({ profile, plan: { ...okPlan, maxParticles: 900 } }))).toContain("particle-budget");
  });

  it("피드백 층이 하나뿐이면 single-channel", () => {
    const plan = { ...okPlan, cues: [{ name: "hit", visual: true }] };
    const r = checkImpact({ profile, plan });
    expect(codes(r)).toContain("single-channel");
    expect(r.violations.find((v: any) => v.code === "single-channel").cue).toBe("hit");
  });

  it("셰이크를 쓰는데 모션 감소 대체가 없으면 no-reduced-motion", () => {
    const plan = { ...okPlan, cues: [fullCue({ shake: { amplitude: 0.2, concurrent: true } })] };
    const r = checkImpact({ profile, plan });
    expect(codes(r)).toContain("no-reduced-motion");
    expect(r.violations.find((v: any) => v.code === "no-reduced-motion").cue).toBe("hit");
  });

  it("입력 버퍼가 하한 미만이면 input-buffer", () => {
    expect(codes(checkImpact({ profile, plan: { ...okPlan, inputBufferMs: 30 } }))).toContain("input-buffer");
  });

  it("기준을 전부 만족하면 예산 위반이 없다", () => {
    expect(checkImpact({ profile, plan: okPlan }).violations).toEqual([]);
  });

  it("없는 사운드 큐를 참조하면 sound-missing", () => {
    const r = checkImpact({ profile, plan: okPlan, soundCues: ["punch"] });
    expect(codes(r)).toContain("sound-missing");
    expect(r.violations.find((v: any) => v.code === "sound-missing").cue).toBe("hit");
  });

  it("sound 선언 자체가 없는 이펙트도 sound-missing — 소리 없이 터지는 이펙트는 절반만 만든 것이다", () => {
    const plan = { ...okPlan, cues: [{ name: "hit", visual: true, haptic: true }] };
    expect(codes(checkImpact({ profile, plan, soundCues: ["swing"] }))).toContain("sound-missing");
  });

  it("사운드 계획이 없으면 그 항목만 unmeasured 로 남고 예산은 그대로 판정한다", () => {
    const r = checkImpact({ profile, plan: { ...okPlan, maxParticles: 900 } });
    expect(r.unmeasured).toContain("sound-cross-check");
    expect(codes(r)).toContain("particle-budget");
    expect(codes(r)).not.toContain("sound-missing");
  });

  it("교차 검증을 통과하면 unmeasured 가 비워진다", () => {
    const r = checkImpact({ profile, plan: okPlan, soundCues: ["swing"] });
    expect(codes(r)).not.toContain("sound-missing");
    expect(r.unmeasured).toEqual([]);
  });
});
