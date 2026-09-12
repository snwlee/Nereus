import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { loadExtensions } from "../../plugins/nereus/hooks/scripts/lib/extensions.mjs";
import { routePrompt } from "../../plugins/nereus/hooks/scripts/lib/router.mjs";
import { detectStack, detectTestRunner } from "../../plugins/nereus/hooks/scripts/lib/stack.mjs";

// 실제 계약: readInventory 가 돌려주는 형태({name, enabled, installPath})를 그대로 넣는다.
const records = [{ name: "nereus-game@nereus", enabled: true, installPath: "plugins/nereus-game" }];
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

describe("nereus-game 배선", () => {
  it("확장이 라우터와 스택에 실제로 붙는다", () => {
    const ext = loadExtensions({ readJson, records });
    expect(ext.routes.length).toBeGreaterThan(0);
    const hits = routePrompt("로블록스 유즈맵 만들자", { extraRoutes: ext.routes });
    expect(hits.some((h) => h.skill.startsWith("nereus-game:"))).toBe(true);
    const fsx = { exists: (p: string) => p.endsWith("default.project.json"), readFile: () => "" };
    expect(detectStack("/proj", fsx, { extraStacks: ext.stacks })).toContain("roblox");
  });

  it("코어 워크플로 스킬 이름을 재사용하지 않는다", () => {
    const ext = loadExtensions({ readJson, records });
    const banned = ["intake", "spec", "build", "review", "finish"];
    for (const r of ext.routes) {
      expect(banned).not.toContain(r.skill.split(":")[1]);
    }
  });
});

// 회귀: 확장이 선언한 라우트가 실재하지 않는 스킬을 가리켜, 설치하면 라우터가
// 모델에게 없는 스킬을 부르라고 지시했다. 게이트의 unwired 검사는 실행 스크립트만 본다.
describe("라우트가 가리키는 스킬이 실재한다", () => {
  it("선언된 모든 route.skill 에 대응하는 SKILL.md 가 있다", () => {
    const ext = loadExtensions({ readJson, records });
    expect(ext.routes.length).toBeGreaterThan(0);
    for (const r of ext.routes) {
      const [plugin, skill] = r.skill.split(":");
      expect(plugin, r.skill).toBe("nereus-game");
      expect(fs.existsSync(`plugins/nereus-game/skills/${skill}/SKILL.md`), r.skill).toBe(true);
    }
  });
});

describe("도메인 라우트와 Unity 스택", () => {
  it("도메인 라우트 6종과 Unity 스택이 확장에 선언돼 있다", () => {
    const ext = loadExtensions({ readJson, records });
    const skills = ext.routes.map((r) => r.skill);
    for (const s of ["level", "narrative", "gameux", "asset", "balance", "unity"]) {
      expect(skills, s).toContain(`nereus-game:${s}`);
    }
    expect(ext.stacks.map((s: any) => s.name)).toContain("unity");
  });

  it("Unity 프로젝트에서 코어가 확장 스택을 인식한다", () => {
    const ext = loadExtensions({ readJson, records });
    const fsx = {
      exists: (p: string) => p.endsWith("ProjectSettings/ProjectVersion.txt") || p.endsWith("Packages/manifest.json"),
      readFile: () => "",
    };
    expect(detectStack("/proj", fsx, { extraStacks: ext.stacks })).toContain("unity");
    expect(detectTestRunner("/proj", fsx, { extraStacks: ext.stacks })?.runner).toBe("unity-test-framework");
  });
});

describe("switch 라우트", () => {
  it("선언돼 있고 스킬이 실재하며 라우팅된다", () => {
    const ext = loadExtensions({ readJson, records });
    expect(ext.routes.map((r) => r.skill)).toContain("nereus-game:switch");
    const hits = routePrompt("스위치 이식 준비하자", { extraRoutes: ext.routes });
    expect(hits.some((h) => h.skill === "nereus-game:switch")).toBe(true);
  });
});
