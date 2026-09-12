import { describe, it, expect } from "vitest";
import { assetDoctor } from "../../plugins/nereus-game/lib/asset-doctor.mjs";

describe("assetDoctor", () => {
  it("전부 없으면 단계별로 막힌 이유를 낸다", () => {
    const r = assetDoctor({ which: () => false, env: {} });
    expect(r.length).toBeGreaterThan(0);
    for (const s of r) {
      expect(s.ok).toBe(false);
      expect(s.why).not.toBe("");
    }
  });

  it("Blender 가 있으면 3D 단계가 가용", () => {
    const r = assetDoctor({ which: (b: string) => b === "blender", env: {} });
    const three = r.find((s: any) => s.stage === "3d");
    expect(three.ok).toBe(true);
  });

  it("오디오는 API 키로 판정한다", () => {
    const r = assetDoctor({ which: () => false, env: { ELEVENLABS_API_KEY: "k" } });
    const audio = r.find((s: any) => s.stage === "audio");
    expect(audio.ok).toBe(true);
  });

  it("예외를 던지지 않는다", () => {
    expect(() => assetDoctor({})).not.toThrow();
  });
});
