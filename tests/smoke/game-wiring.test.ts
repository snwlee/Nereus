import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { loadExtensions } from "../../plugins/nereus/hooks/scripts/lib/extensions.mjs";
import { routePrompt } from "../../plugins/nereus/hooks/scripts/lib/router.mjs";
import { detectStack } from "../../plugins/nereus/hooks/scripts/lib/stack.mjs";

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
