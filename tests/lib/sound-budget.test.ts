import { describe, it, expect } from "vitest";
import { checkSound } from "../../plugins/nereus-game/lib/sound-budget.mjs";

const profile = { sound: { maxConcurrent: 16, minVariants: 2, loudnessLufs: [-16, -12] } };
const codes = (r: any) => r.violations.map((v: any) => v.code);

describe("sound budget", () => {
  it("프로파일에 sound 기준이 없으면 통과가 아니라 no-baseline 이다", () => {
    const r = checkSound({ profile: {}, plan: { maxConcurrent: 4, cues: [], actions: [] } });
    expect(codes(r)).toEqual(["no-baseline"]);
  });
  it("동시 발음수가 상한을 넘으면 concurrency", () => {
    const r = checkSound({ profile, plan: { maxConcurrent: 32, cues: [], actions: [] } });
    expect(codes(r)).toContain("concurrency");
  });
  it("변형이 모자라면 큐 이름과 함께 variants", () => {
    const plan = { maxConcurrent: 8, cues: [{ name: "jump", variants: 1, actions: ["jump"] }], actions: ["jump"] };
    const r = checkSound({ profile, plan });
    expect(codes(r)).toContain("variants");
    expect(r.violations.find((v: any) => v.code === "variants").cue).toBe("jump");
  });
  it("라우드니스가 목표 범위 밖이면 loudness", () => {
    const plan = { maxConcurrent: 8, loudnessLufs: -6, cues: [], actions: [] };
    expect(codes(checkSound({ profile, plan }))).toContain("loudness");
  });
  it("어떤 큐에도 매핑되지 않은 동작은 no-feedback", () => {
    const plan = { maxConcurrent: 8, cues: [{ name: "jump", variants: 3, actions: ["jump"] }], actions: ["jump", "land"] };
    const r = checkSound({ profile, plan });
    expect(codes(r)).toContain("no-feedback");
    expect(r.violations.find((v: any) => v.code === "no-feedback").action).toBe("land");
  });
  it("기준을 전부 만족하면 위반이 없다", () => {
    const plan = { maxConcurrent: 8, loudnessLufs: -14, cues: [{ name: "jump", variants: 3, actions: ["jump"] }], actions: ["jump"] };
    expect(checkSound({ profile, plan }).violations).toEqual([]);
  });
});
