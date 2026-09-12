// NDA 훅은 hooks.json 에 배선되지 않으면 존재하지 않는 것과 같다.
// 1·2차에서 "선언했는데 실재/배선 안 됨"을 네 번 만났다. 구현보다 먼저 깐다.
import { describe, it, expect } from "vitest";
import fs from "node:fs";

const ROOT = "plugins/nereus-game";

describe("NDA 경계 배선", () => {
  it("nda-guard 가 PreToolUse 에 배선돼 있다", () => {
    const hooks = JSON.parse(fs.readFileSync(`${ROOT}/hooks/hooks.json`, "utf8"));
    const pre = hooks.hooks?.PreToolUse ?? [];
    const cmds = pre.flatMap((e: any) => (e.hooks ?? []).map((h: any) => h.command));
    expect(cmds.join(" ")).toContain("nda-guard.mjs");
    expect(cmds.join(" ")).toContain("CLAUDE_PLUGIN_ROOT");
  });

  it("switch 스킬이 있고 Lotcheck 본문을 저장소에 담지 않는다", () => {
    const p = `${ROOT}/skills/switch/SKILL.md`;
    expect(fs.existsSync(p)).toBe(true);
    const text = fs.readFileSync(p, "utf8");
    expect(text).toContain(".nereus/lotcheck");
  });

  it("훅 스크립트가 실재한다", () => {
    expect(fs.existsSync(`${ROOT}/hooks/scripts/nda-guard.mjs`)).toBe(true);
  });
});
