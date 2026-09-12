import { describe, it, expect } from "vitest";
import { listProfiles, loadProfile, validateProfile } from "../../plugins/nereus-game/lib/profiles.mjs";
import { checkSound } from "../../plugins/nereus-game/lib/sound-budget.mjs";
import { checkImpact } from "../../plugins/nereus-game/lib/impact-budget.mjs";

describe("장르 프로파일의 새 도메인 기준", () => {
  it("모든 장르가 sound · liveops · l10n 기준을 갖는다", () => {
    for (const g of listProfiles()) {
      const p = loadProfile(g);
      expect(p.sound, g).toBeTruthy();
      expect(p.liveops, g).toBeTruthy();
      expect(p.l10n, g).toBeTruthy();
    }
  });
  it("sound 기준이 있으므로 어떤 장르도 no-baseline 을 내지 않는다", () => {
    const plan = { maxConcurrent: 1, loudnessLufs: -14, cues: [], actions: [] };
    for (const g of listProfiles()) {
      const r = checkSound({ profile: loadProfile(g), plan });
      expect(r.violations.map((v: any) => v.code), g).not.toContain("no-baseline");
    }
  });
  it("새 키는 선택 키다 — 기존 필수 키 검증을 바꾸지 않는다", () => {
    expect(validateProfile({ genre: "x", loop: [], metrics: [], balance: {} })).toEqual([]);
  });
  it("모든 장르가 impact 기준을 갖는다", () => {
    for (const g of listProfiles()) expect(loadProfile(g).impact, g).toBeTruthy();
  });
  it("impact 기준이 있으므로 어떤 장르도 no-baseline 을 내지 않는다", () => {
    const plan = { maxParticles: 1, inputBufferMs: 999, cues: [] };
    for (const g of listProfiles()) {
      const r = checkImpact({ profile: loadProfile(g), plan });
      expect(r.violations.map((v: any) => v.code), g).not.toContain("no-baseline");
    }
  });
});
