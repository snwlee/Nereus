import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

const DIR = "plugins/nereus-game/skills/roblox";
const REFS = ["datastores.md", "remote-validation.md", "simulator-economy.md"];
const hasLune = spawnSync("lune", ["--version"]).status === 0;

describe("roblox 참고 자료", () => {
  it("SKILL.md 가 세 장을 전부 가리키고 실재한다", () => {
    const skill = fs.readFileSync(`${DIR}/SKILL.md`, "utf8");
    for (const r of REFS) {
      expect(skill, r).toContain(`references/${r}`);
      expect(fs.existsSync(`${DIR}/references/${r}`), r).toBe(true);
    }
  });
  it("옮긴 파일마다 출처와 라이선스를 적는다", () => {
    const files = [...REFS.map((r) => `${DIR}/references/${r}`), `${DIR}/templates/economy_math.luau`, `${DIR}/templates/test_economy_math.luau`];
    for (const f of files) {
      const t = fs.readFileSync(f, "utf8");
      expect(t, f).toContain("awesome-gamedev-agent-skills");
      expect(t, f).toContain("Apache-2.0");
    }
  });
  it("라우트를 늘리지 않는다 — 흡수는 references 로만", () => {
    const ext = JSON.parse(fs.readFileSync("plugins/nereus-game/nereus-extension.json", "utf8"));
    expect(ext.routes.filter((r: any) => /roblox/.test(r.skill))).toHaveLength(1);
  });
  it.skipIf(!hasLune)("Luau 경제 수식 테스트가 lune 으로 통과한다", () => {
    execFileSync("lune", ["run", "test_economy_math.luau"], { cwd: `${DIR}/templates`, stdio: "pipe" });
  });
});
