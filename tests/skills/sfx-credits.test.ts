import { describe, it, expect } from "vitest";
import { renderSoundsMd, SYNTH_NOTICE } from "../../plugins/nereus/skills/sfx/scripts/credits.mjs";

describe("sfx.credits", () => {
  it("CC-BY 표기 누락 거부", () => {
    expect(() => renderSoundsMd([{ t: 1, sound: "x", source: "openverse", license: "by", attribution: "" }])).toThrow(/attribution/);
  });
  it("차단 라이선스 거부", () => {
    expect(() => renderSoundsMd([{ t: 1, sound: "x", source: "openverse", license: "by-nc", attribution: "A" }])).toThrow();
  });
  it("합성음 고지·표", () => {
    const md = renderSoundsMd([{ t: 1, sound: "ui_pop/soft", source: "sfxlite", license: "synth" }]);
    expect(md.startsWith("# Sounds")).toBe(true);
    expect(md).toContain("| t | sound | source | license | credit |");
    expect(md).toContain("ui_pop/soft");
    expect(md).toContain(SYNTH_NOTICE);
    expect(SYNTH_NOTICE).toContain("Synthesized with earshot-sfx-lite");
  });
  it("파이프 이스케이프·합성음 없으면 고지 없음", () => {
    const md = renderSoundsMd([{ t: 2, sound: "a|b", source: "freesound", license: "cc0", attribution: "x | y" }]);
    expect(md).toContain("a\\|b");
    expect(md).toContain("x \\| y");
    expect(md).not.toContain(SYNTH_NOTICE);
  });
});
