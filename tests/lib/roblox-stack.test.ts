import { describe, it, expect } from "vitest";
import { detectRobloxRunner } from "../../plugins/nereus-game/lib/roblox-stack.mjs";

const fsWith = (files: string[]) => ({
  exists: (p: string) => files.some((f) => p.endsWith(f)),
  readFile: () => "",
});

describe("detectRobloxRunner", () => {
  it("lune.yaml 이 있으면 lune 러너", () => {
    expect(detectRobloxRunner("/p", fsWith(["default.project.json", "lune.yaml"]))).toEqual({
      runner: "lune",
      command: "lune run tests",
    });
  });

  it("러너가 없으면 null", () => {
    expect(detectRobloxRunner("/p", fsWith(["default.project.json"]))).toBeNull();
  });

  it("로블록스 프로젝트가 아니면 null", () => {
    expect(detectRobloxRunner("/p", fsWith(["package.json"]))).toBeNull();
  });
});
