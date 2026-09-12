import { describe, it, expect } from "vitest";
import { isNdaPath, ndaPathsIn, NDA_ZONES } from "../../plugins/nereus-game/lib/nda.mjs";

describe("isNdaPath", () => {
  it("기본 구역을 잡는다", () => {
    expect(isNdaPath("Platform/Switch/Boot.cs")).toBe(true);
    expect(isNdaPath("vendor/NintendoSDK/nn.h")).toBe(true);
    expect(isNdaPath("build/game.nx.json")).toBe(true);
  });

  it("일반 경로는 아니다", () => {
    expect(isNdaPath("Assets/Game/Player.cs")).toBe(false);
  });

  it("윈도우 경로 구분자도 잡는다", () => {
    expect(isNdaPath("Platform\\Switch\\Boot.cs")).toBe(true);
  });

  it("프로젝트가 구역을 덧붙일 수 있다", () => {
    expect(isNdaPath("secret/a.txt", ["secret/**"])).toBe(true);
  });

  it("기본 구역 목록이 비어 있지 않다", () => {
    expect(NDA_ZONES.length).toBeGreaterThan(0);
  });
});

describe("ndaPathsIn", () => {
  it("명령 문자열에서 NDA 경로를 뽑는다", () => {
    const found = ndaPathsIn("codex review Platform/Switch/Boot.cs Assets/Player.cs");
    expect(found).toEqual(["Platform/Switch/Boot.cs"]);
  });

  it("NDA 경로가 없으면 빈 배열", () => {
    expect(ndaPathsIn("codex review Assets/Player.cs")).toEqual([]);
  });
});
