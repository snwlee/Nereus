import { describe, it, expect } from "vitest";
import { loadExtensions } from "../../plugins/nereus/hooks/scripts/lib/extensions.mjs";

const settings = { enabledPlugins: { "nereus-game@nereus": { installPath: "/p/game" } } };

describe("loadExtensions", () => {
  it("활성 플러그인의 routes 와 stacks 를 모은다", () => {
    const readJson = (p: string) =>
      p === "/p/game/nereus-extension.json"
        ? {
            routes: [{ skill: "nereus-game:roblox", why: "로블록스", re: "로블록스|roblox" }],
            stacks: [{ name: "roblox", marker: "default.project.json" }],
          }
        : undefined;
    const out = loadExtensions({ readJson, settings });
    expect(out.routes).toHaveLength(1);
    expect(out.routes[0].re.test("로블록스 게임")).toBe(true);
    expect(out.stacks[0]).toEqual({ name: "roblox", marker: "default.project.json" });
  });

  it("깨진 확장 파일은 그 플러그인만 건너뛴다", () => {
    const readJson = () => {
      throw new Error("bad json");
    };
    expect(loadExtensions({ readJson, settings })).toEqual({ routes: [], stacks: [] });
  });

  it("비활성 플러그인은 로드하지 않는다", () => {
    const readJson = () => ({ routes: [{ skill: "x:y", why: "z", re: "z" }] });
    expect(loadExtensions({ readJson, settings: { enabledPlugins: {} } })).toEqual({ routes: [], stacks: [] });
  });

  it("컴파일 안 되는 정규식 항목은 버린다", () => {
    const readJson = () => ({ routes: [{ skill: "x:y", why: "z", re: "(" }] });
    expect(loadExtensions({ readJson, settings }).routes).toEqual([]);
  });
});
