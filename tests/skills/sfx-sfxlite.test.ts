import { describe, it, expect } from "vitest";
import { parseList, buildRenderArgs, parseRenderLine, SFXLITE_COMMIT, sfxliteHome } from "../../plugins/nereus/skills/sfx/scripts/sfxlite.mjs";

const LIST = [
  "252 sounds in the bank forge_v2r6+forge04r1+fit1+pluck1",
  "id                              dur s peak s  kinds / knobs",
  "click/soft                      0.094  0.004  click | dur param, pitch F#7 -33c",
  "cut_hit/air                     0.549  0.043  hit | dur trim, pitch Ab1 -32c",
  "fit/key/thock                   0.120  0.003  key, click | dur param",
].join("\n");
const WROTE = "wrote p.wav: ui_pop/soft seed 1: 0.180 s, onset 0.003 s, peak at 0.042 s, end 0.157 s, -1.0 dBFS, -15.4 LUFS momentary max; checks: clean";

describe("sfx.synth", () => {
  it("list 파싱", () => {
    const l = parseList(LIST);
    expect(l).toHaveLength(3);
    expect(l[0]).toEqual({ id: "click/soft", durSec: 0.094, peakSec: 0.004, kinds: ["click"] });
    expect(l[2].kinds).toEqual(["key", "click"]);
  });
  it("render 인자 — 준 노브만", () => {
    expect(buildRenderArgs({ id: "ui_pop/soft", out: "a.wav" })).toEqual(["-m", "sfxlite", "render", "ui_pop/soft", "-o", "a.wav"]);
    expect(buildRenderArgs({ id: "whoosh_fast/crisp", out: "w.wav", dur: 0.8, apex: 0.32, pitch: "E6", seed: 7 }))
      .toEqual(["-m", "sfxlite", "render", "whoosh_fast/crisp", "-o", "w.wav", "--dur", "0.8", "--apex", "0.32", "--pitch", "E6", "--seed", "7"]);
  });
  it("잘못된 id 거부", () => {
    expect(() => buildRenderArgs({ id: "../x; rm", out: "a.wav" })).toThrow();
    expect(() => buildRenderArgs({ id: "click", out: "a.wav" })).toThrow();
  });
  it("render 결과 파싱", () => {
    expect(parseRenderLine(WROTE)).toEqual({ durSec: 0.18, peakSec: 0.042, checks: "clean" });
    expect(parseRenderLine("Traceback (most recent call last):")).toBeNull();
  });
  it("커밋 고정·설치 위치", () => {
    expect(SFXLITE_COMMIT).toBe("c91a7c9d2690ae658f790859d4ad4004857903dd");
    expect(sfxliteHome({ NEREUS_SFXLITE: "/x/y" })).toBe("/x/y");
    expect(sfxliteHome({ HOME: "/h" })).toBe("/h/.local/share/nereus/sfx/earshot-sfx-lite");
  });
});
