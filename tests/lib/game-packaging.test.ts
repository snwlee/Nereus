import { describe, it, expect } from "vitest";
import fs from "node:fs";

describe("nereus-game 패키징", () => {
  it("마켓플레이스에 등재되고 이름이 매니페스트와 같다", () => {
    const mp = JSON.parse(fs.readFileSync(".claude-plugin/marketplace.json", "utf8"));
    const entry = mp.plugins.find((p: any) => p.name === "nereus-game");
    expect(entry).toBeTruthy();
    expect(entry.source).toBe("./plugins/nereus-game");
    const pj = JSON.parse(fs.readFileSync("plugins/nereus-game/.claude-plugin/plugin.json", "utf8"));
    expect(pj.name).toBe(entry.name);
    expect(pj.license).toBe("MIT");
  });

  it("CCGS 귀속을 NOTICE 에 적는다", () => {
    const notice = fs.readFileSync("plugins/nereus-game/NOTICE", "utf8");
    expect(notice).toContain("Claude-Code-Game-Studios");
    expect(notice).toContain("MIT");
  });

  it("awesome-gamedev-agent-skills 귀속과 Apache 전문을 동봉한다", () => {
    const notice = fs.readFileSync("plugins/nereus-game/NOTICE", "utf8");
    expect(notice).toContain("awesome-gamedev-agent-skills");
    expect(notice).toContain("Apache License, Version 2.0");
    expect(notice).toContain("All skills in this repository are original works");
    expect(fs.readFileSync("plugins/nereus-game/LICENSES/Apache-2.0.txt", "utf8")).toContain("TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION");
  });
});
