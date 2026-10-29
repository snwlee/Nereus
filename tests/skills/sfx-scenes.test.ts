import { describe, it, expect } from "vitest";
import { parseSceneTimes, sceneArgs } from "../../plugins/nereus/skills/sfx/scripts/scenes.mjs";

const line = (t: number) => `[Parsed_showinfo_1 @ 0x1] n:   0 pts:  12 pts_time:${t}    duration:1 fmt:yuv420p`;

describe("sfx.scenes", () => {
  it("근접 중복 제거·오름차순", () => {
    expect(parseSceneTimes([line(2.5), line(1.0), line(1.1)].join("\n"))).toEqual([1, 2.5]);
  });
  it("반올림 셋째 자리", () => {
    expect(parseSceneTimes(line(1.23456))).toEqual([1.235]);
  });
  it("minGapSec 조절", () => {
    expect(parseSceneTimes([line(1.0), line(1.1)].join("\n"), { minGapSec: 0.05 })).toEqual([1, 1.1]);
  });
  it("ffmpeg 인자", () => {
    const a = sceneArgs("in.mp4", 0.4);
    expect(a).toContain("in.mp4");
    expect(a.join(" ")).toContain("select='gt(scene,0.4)',showinfo");
    expect(a.slice(-3)).toEqual(["-f", "null", "-"]);
  });
  it("숫자가 아닌 threshold 는 거부한다", () => {
    expect(() => sceneArgs("in.mp4", Number("0.3)',movie=x"))).toThrow(/threshold/);
    expect(() => sceneArgs("in.mp4", 2)).toThrow(/threshold/);
  });
});
