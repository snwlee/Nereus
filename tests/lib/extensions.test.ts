import { describe, it, expect } from "vitest";
import { loadExtensions } from "../../plugins/nereus/hooks/scripts/lib/extensions.mjs";

// 실제 계약: installPath 는 installed_plugins.json 에, 활성 여부는 settings.json 에 따로 있다.
const records = [{ name: "nereus-game@nereus", enabled: true, installPath: "/p/game" }];


describe("loadExtensions", () => {
  it("활성 플러그인의 routes 와 stacks 를 모은다", () => {
    const readJson = (p: string) =>
      p === "/p/game/nereus-extension.json"
        ? {
            routes: [{ skill: "nereus-game:roblox", why: "로블록스", re: "로블록스|roblox" }],
            stacks: [{ name: "roblox", marker: "default.project.json" }],
          }
        : undefined;
    const out = loadExtensions({ readJson, records });
    expect(out.routes).toHaveLength(1);
    expect(out.routes[0].re.test("로블록스 게임")).toBe(true);
    expect(out.stacks[0]).toEqual({ name: "roblox", marker: "default.project.json" });
  });

  it("깨진 확장 파일은 그 플러그인만 건너뛴다", () => {
    const readJson = () => {
      throw new Error("bad json");
    };
    expect(loadExtensions({ readJson, records })).toEqual({ routes: [], stacks: [] });
  });

  it("비활성 플러그인은 로드하지 않는다", () => {
    const readJson = () => ({ routes: [{ skill: "x:y", why: "z", re: "z" }] });
    expect(loadExtensions({ readJson, records: [{ name: "nereus-game@nereus", enabled: false, installPath: "/p/game" }] })).toEqual({ routes: [], stacks: [] });
  });

  it("companions 를 모은다 — 설치 명령은 선언에서 유도한다", () => {
    const readJson = () => ({
      companions: [
        {
          id: "unity@unity-agent-plugin",
          label: "Unity 공식 플러그인",
          why: "엔진 절차 위임",
          marketplace: "Unity-Technologies/unity-agent-plugin",
          scope: "project",
          when: { stack: "unity" },
        },
      ],
    });
    const out = loadExtensions({ readJson, records });
    expect(out.companions).toHaveLength(1);
    expect(out.companions[0]).toMatchObject({
      id: "unity@unity-agent-plugin",
      marketplace: "Unity-Technologies/unity-agent-plugin",
      scope: "project",
      when: { stack: "unity" },
    });
  });

  it("id 나 marketplace 가 없는 companion 은 버린다 — 명령을 유도할 수 없다", () => {
    const readJson = () => ({ companions: [{ label: "이름만 있다" }, { id: "x@y" }] });
    expect(loadExtensions({ readJson, records }).companions).toEqual([]);
  });

  it("companions 를 선언하지 않은 확장도 깨지지 않는다", () => {
    const readJson = () => ({ routes: [{ skill: "x:y", why: "z", re: "z" }] });
    expect(loadExtensions({ readJson, records }).companions).toEqual([]);
  });

  it("컴파일 안 되는 정규식 항목은 버린다", () => {
    const readJson = () => ({ routes: [{ skill: "x:y", why: "z", re: "(" }] });
    expect(loadExtensions({ readJson, records }).routes).toEqual([]);
  });
});

describe("실제 설정 파일 계약", () => {
  it("enabledPlugins 는 불리언 맵이고 installPath 는 설치기록에 있다", () => {
    const installed = { plugins: { "nereus-game@nereus": [{ installPath: "/p/game", version: "0.1.0" }] } };
    const settings = { enabledPlugins: { "nereus-game@nereus": true, "off@x": false } };
    const readJson = (p: string) => {
      if (p.endsWith("installed_plugins.json")) return installed;
      if (p.endsWith("settings.json")) return settings;
      if (p === "/p/game/nereus-extension.json") return { routes: [{ skill: "nereus-game:roblox", why: "로블록스", re: "roblox" }] };
      return undefined;
    };
    const out = loadExtensions({
      readJson,
      pluginsFile: "/h/.claude/plugins/installed_plugins.json",
      settingsFile: "/h/.claude/settings.json",
    });
    expect(out.routes.map((r) => r.skill)).toEqual(["nereus-game:roblox"]);
  });

  it("enabledPlugins 에서 false 면 로드하지 않는다", () => {
    const readJson = (p: string) => {
      if (p.endsWith("installed_plugins.json")) return { plugins: { "g@n": [{ installPath: "/p/game" }] } };
      if (p.endsWith("settings.json")) return { enabledPlugins: { "g@n": false } };
      return { routes: [{ skill: "x:y", why: "z", re: "z" }] };
    };
    expect(loadExtensions({ readJson, pluginsFile: "/h/i.json", settingsFile: "/h/settings.json" }).routes).toEqual([]);
  });
});
