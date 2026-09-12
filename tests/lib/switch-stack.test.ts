import { describe, it, expect } from "vitest";
import { isSwitchTarget, detectSwitchBuild } from "../../plugins/nereus-game/lib/switch-stack.mjs";

const fsWith = (files: string[]) => ({ exists: (p: string) => files.some((f) => p.replace(/\\/g, "/").endsWith(f)) });

describe("switch-stack", () => {
  it("NDA 구역이 있으면 Switch 대상", () => {
    expect(isSwitchTarget("/p", fsWith(["Platform/Switch"]))).toBe(true);
  });

  it("없으면 Switch 대상이 아니다", () => {
    expect(isSwitchTarget("/p", fsWith(["Assets"]))).toBe(false);
  });

  it("빌드 명령이 설정돼 있으면 돌려준다", () => {
    const out = detectSwitchBuild("/p", fsWith(["Platform/Switch"]), { switch: { build: "make nx" } });
    expect(out).toEqual({ command: "make nx" });
  });

  it("설정이 없으면 명령을 지어내지 않는다", () => {
    expect(detectSwitchBuild("/p", fsWith(["Platform/Switch"]), {})).toBeNull();
  });
});
