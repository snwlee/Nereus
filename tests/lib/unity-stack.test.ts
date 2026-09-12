import { describe, it, expect } from "vitest";
import { detectUnityRunner } from "../../plugins/nereus-game/lib/unity-stack.mjs";

const fsWith = (files: string[], manifest = "") => ({
  exists: (p: string) => files.some((f) => p.replace(/\\/g, "/").endsWith(f)),
  readFile: () => manifest,
});

describe("detectUnityRunner", () => {
  it("테스트 프레임워크가 있으면 batchmode 러너", () => {
    const fsx = fsWith(
      ["ProjectSettings/ProjectVersion.txt", "Packages/manifest.json"],
      JSON.stringify({ dependencies: { "com.unity.test-framework": "1.4.5" } }),
    );
    const out = detectUnityRunner("/p", fsx);
    expect(out?.runner).toBe("unity-test-framework");
    expect(out?.command).toContain("-batchmode");
  });

  it("테스트 프레임워크가 없으면 null", () => {
    const fsx = fsWith(
      ["ProjectSettings/ProjectVersion.txt", "Packages/manifest.json"],
      JSON.stringify({ dependencies: {} }),
    );
    expect(detectUnityRunner("/p", fsx)).toBeNull();
  });

  it("Unity 프로젝트가 아니면 null", () => {
    expect(detectUnityRunner("/p", fsWith(["package.json"]))).toBeNull();
  });
});
