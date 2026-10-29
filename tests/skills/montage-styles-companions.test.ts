import { describe, it, expect } from "vitest";
import { companionVerdict, COMPANIONS } from "../../plugins/nereus/skills/montage/scripts/style-companions.mjs";

describe("montage-styles.companion", () => {
  it("lemo 는 허용", () => {
    expect(companionVerdict("lemo-opuscar", { commercial: true }).verdict).toBe("allow");
    expect(companionVerdict("Lemo Opuscar").verdict).toBe("allow");
  });
  it("onetake — 광고 차단, 비상업 지명만 조건부", () => {
    const ad = companionVerdict("onetake", { commercial: true, named: true });
    expect(ad.verdict).toBe("block");
    expect(ad.reason).toMatch(/PolyForm/);
    expect(companionVerdict("onetake", { commercial: false, named: true }).verdict).toBe("conditional");
    expect(companionVerdict("onetake", { commercial: false }).verdict).toBe("block");
  });
  it("collage — 키 없으면 차단, 있으면 조건부", () => {
    expect(companionVerdict("Collage B-roll", {}).verdict).toBe("block");
    const c = companionVerdict("collage_broll", { paidKey: true, commercial: true });
    expect(c.verdict).toBe("conditional");
    expect(c.reason).toMatch(/budget/);
  });
  it("claude animation base — 광고 차단(Clawd), 비상업 조건부", () => {
    expect(companionVerdict("claude-animation-base", { commercial: true }).reason).toMatch(/Clawd/);
    expect(companionVerdict("claude-animation-base", { commercial: true }).verdict).toBe("block");
    expect(companionVerdict("Claude Animation Base", { commercial: false }).verdict).toBe("conditional");
  });
  it("미상은 차단, 저장소 기록", () => {
    expect(companionVerdict("something-else").verdict).toBe("block");
    expect(COMPANIONS["lemo-opuscar"].repo).toBe("https://github.com/lemomo-ai/lemo-opuscar");
    expect(COMPANIONS["onetake"].license).toMatch(/PolyForm/);
  });
});
