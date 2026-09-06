import { describe, it, expect } from "vitest";
import { slugifyCwd, skillsUsed, coverageReport } from "../../plugins/nereus/hooks/scripts/lib/coverage.mjs";

const toolUse = (skill: string) => JSON.stringify({ message: { role: "assistant", content: [{ type: "tool_use", name: "Skill", input: { skill } }] } });

describe("coverage — 스킬이 실제로 발동했는가", () => {
  it("cwd 를 트랜스크립트 디렉터리 이름으로 바꾼다", () => {
    expect(slugifyCwd("/Volumes/SKHY1TB/workspace/Nereus")).toBe("-Volumes-SKHY1TB-workspace-Nereus");
    expect(slugifyCwd("C:\\Users\\me\\proj")).toBe("C--Users-me-proj");
  });
  it("트랜스크립트에서 발동한 스킬 이름을 뽑는다", () => {
    const text = [toolUse("nereus:build"), JSON.stringify({ message: { content: "text" } }), "깨진 줄", toolUse("nereus:build"), toolUse("other:thing")].join("\n");
    expect([...skillsUsed(text)].sort()).toEqual(["nereus:build", "other:thing"]);
    expect(skillsUsed("").size).toBe(0);
  });
  it("슬래시 커맨드 호출도 센다", () => {
    const line = JSON.stringify({ message: { content: "<command-name>/nereus:setup</command-name>" } });
    expect([...skillsUsed(line)]).toEqual(["nereus:setup"]);
    expect([...skillsUsed("<command-name>nereus:build</command-name>")]).toEqual(["nereus:build"]);
  });
  it("Skill 이 아닌 도구는 세지 않는다", () => {
    const text = JSON.stringify({ message: { content: [{ type: "tool_use", name: "Bash", input: { command: "ls" } }] } });
    expect(skillsUsed(text).size).toBe(0);
  });
  it("세션 비율과 한 번도 안 뜬 스킬을 낸다", () => {
    const r = coverageReport({
      sessions: [{ id: "a", skills: new Set(["nereus:build"]) }, { id: "b", skills: new Set() }, { id: "c", skills: new Set(["nereus:build", "nereus:review"]) }],
      installed: ["nereus:build", "nereus:review", "nereus:seo"],
    });
    expect(r.sessionsSampled).toBe(3);
    expect(r.sessionsWithSkill).toBe(2);
    expect(r.coverage).toBeCloseTo(2 / 3);
    expect(r.used).toEqual([{ name: "nereus:build", sessions: 2 }, { name: "nereus:review", sessions: 1 }]);
    expect(r.unused).toEqual(["nereus:seo"]);
  });
  it("설치되지 않은 스킬 사용은 무시하고, 세션이 없으면 0 을 낸다", () => {
    const r = coverageReport({ sessions: [{ id: "a", skills: new Set(["foreign:x"]) }], installed: ["nereus:build"] });
    expect(r.sessionsWithSkill).toBe(0);
    expect(r.used).toEqual([]);
    expect(coverageReport({ sessions: [], installed: ["nereus:build"] })).toMatchObject({ sessionsSampled: 0, coverage: 0, unused: ["nereus:build"] });
  });
});
