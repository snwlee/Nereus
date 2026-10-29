import { describe, it, expect } from "vitest";
import { classifyLicense } from "../../plugins/nereus/skills/sfx/scripts/license.mjs";

describe("sfx.license", () => {
  it("CC0·PDM·합성음은 허용", () => {
    expect(classifyLicense("CC0")).toEqual({ verdict: "allow", license: "cc0" });
    expect(classifyLicense("pdm").verdict).toBe("allow");
    expect(classifyLicense("synth").verdict).toBe("allow");
  });
  it("CC-BY 는 표기 조건", () => {
    expect(classifyLicense("by")).toEqual({ verdict: "credit", license: "by" });
  });
  it("비상업·변경금지·동일조건·sampling+·미상은 차단", () => {
    for (const l of ["by-nc", "by-nd", "by-sa", "by-nc-sa", "by-nc-nd", "sampling+", "", undefined, "weird"])
      expect(classifyLicense(l as string).verdict).toBe("block");
  });
});
