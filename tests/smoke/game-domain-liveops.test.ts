import { describe, it, expect } from "vitest";
import fs from "node:fs";

const ext = JSON.parse(fs.readFileSync("plugins/nereus-game/nereus-extension.json", "utf8"));
const NEW = ["nereus-game:sound", "nereus-game:liveops", "nereus-game:localization"];

describe("새 도메인 배선", () => {
  it("세 스킬이 routes 에 선언돼 있다", () => {
    const skills = ext.routes.map((r: any) => r.skill);
    for (const s of NEW) expect(skills).toContain(s);
  });
  it("선언된 route 마다 SKILL.md 가 실재한다 — dangling route 금지", () => {
    for (const r of ext.routes) {
      const name = String(r.skill).split(":")[1];
      expect(fs.existsSync(`plugins/nereus-game/skills/${name}/SKILL.md`), r.skill).toBe(true);
    }
  });
  it("각 SKILL.md 가 자기 검사기를 실제로 부른다 — 선언만 하고 배선 안 하는 것을 막는다", () => {
    const pairs: Array<[string, string]> = [
      ["sound", "sound-budget.mjs"],
      ["liveops", "liveops-plan.mjs"],
      ["localization", "l10n-scan.mjs"],
    ];
    for (const [skill, lib] of pairs) {
      const md = fs.readFileSync(`plugins/nereus-game/skills/${skill}/SKILL.md`, "utf8");
      expect(md, skill).toContain(lib);
    }
  });
  it("도메인 스킬은 엔진에 묶이지 않는다", () => {
    for (const s of NEW) {
      const name = s.split(":")[1];
      const md = fs.readFileSync(`plugins/nereus-game/skills/${name}/SKILL.md`, "utf8");
      expect(md, name).toMatch(/엔진과 무관|엔진 불가지론/);
    }
  });
  it("impact 스킬이 배선돼 있고 자기 검사기를 부른다", () => {
    const skills = ext.routes.map((r: any) => r.skill);
    expect(skills).toContain("nereus-game:impact");
    const md = fs.readFileSync("plugins/nereus-game/skills/impact/SKILL.md", "utf8");
    expect(md).toContain("impact-budget.mjs");
    expect(md).toMatch(/엔진과 무관|엔진 불가지론/);
  });
  it("gameux 가 임팩트를 impact 로 넘긴다 — 두 곳에 같은 기준을 두지 않는다", () => {
    const md = fs.readFileSync("plugins/nereus-game/skills/gameux/SKILL.md", "utf8");
    expect(md).toContain("nereus-game:impact");
  });
  it("localization 스킬이 폰트 검사기를 부른다", () => {
    const md = fs.readFileSync("plugins/nereus-game/skills/localization/SKILL.md", "utf8");
    expect(md).toContain("font-check.mjs");
  });
  it("asset 스킬이 폰트 라이선스를 경유 규칙으로 갖는다", () => {
    const md = fs.readFileSync("plugins/nereus-game/skills/asset/SKILL.md", "utf8");
    expect(md).toMatch(/폰트/);
  });
  it("gameux 가 폰트를 localization 으로 넘긴다", () => {
    const md = fs.readFileSync("plugins/nereus-game/skills/gameux/SKILL.md", "utf8");
    expect(md).toMatch(/폰트/);
  });
  it("compliance 스킬이 배선돼 있고 자기 검사기를 부른다", () => {
    const skills = ext.routes.map((r: any) => r.skill);
    expect(skills).toContain("nereus-game:compliance");
    const md = fs.readFileSync("plugins/nereus-game/skills/compliance/SKILL.md", "utf8");
    expect(md).toContain("compliance-check.mjs");
  });
  it("compliance SKILL 이 출처를 밝힌다 — 법적 요건은 근거 없이 적지 않는다", () => {
    const md = fs.readFileSync("plugins/nereus-game/skills/compliance/SKILL.md", "utf8");
    expect(md).toContain("create.roblox.com");
  });
  it("balance 가 확률 아이템을 compliance 로 넘긴다", () => {
    const md = fs.readFileSync("plugins/nereus-game/skills/balance/SKILL.md", "utf8");
    expect(md).toContain("nereus-game:compliance");
  });
  it("track 스킬이 배선돼 있고 자기 추천기를 부른다", () => {
    const skills = ext.routes.map((r: any) => r.skill);
    expect(skills).toContain("nereus-game:track");
    const md = fs.readFileSync("plugins/nereus-game/skills/track/SKILL.md", "utf8");
    expect(md).toContain("track-advisor.mjs");
  });
  it("track SKILL 이 추천은 강제가 아님을 밝힌다", () => {
    const md = fs.readFileSync("plugins/nereus-game/skills/track/SKILL.md", "utf8");
    expect(md).toMatch(/강제하지 않는다|게이트가 아니다/);
  });
});
