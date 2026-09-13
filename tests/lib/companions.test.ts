import { describe, it, expect } from "vitest";
import { companionRows, renderCompanions } from "../../plugins/nereus/skills/setup/scripts/companions.mjs";

const unity = {
  id: "unity@unity-agent-plugin",
  marketplace: "Unity-Technologies/unity-agent-plugin",
  label: "Unity 공식 플러그인",
  why: "엔진 절차 위임",
  scope: "project",
  when: { stack: "unity" },
};
const stacks = [{ name: "unity", marker: "ProjectSettings/ProjectVersion.txt" }];
const inUnityProject = { exists: (p: string) => p.includes("ProjectVersion.txt") };
const elsewhere = { exists: () => false };

describe("companionRows", () => {
  it("미설치면 마켓 추가 + 설치 명령을 유도한다", () => {
    const [row] = companionRows({ companions: [unity], stacks, rows: [], ...inUnityProject });
    expect(row.status).toBe("미설치");
    expect(row.commands).toEqual([
      "claude plugin marketplace add Unity-Technologies/unity-agent-plugin",
      "claude plugin install unity@unity-agent-plugin --scope project",
    ]);
  });

  it("설치되어 있으면 업데이트 명령을 낸다 — 마켓부터 갱신한다", () => {
    const [row] = companionRows({
      companions: [unity], stacks, ...inUnityProject,
      rows: [{ name: "unity@unity-agent-plugin", enabled: true, version: "1.2.0" }],
    });
    expect(row.status).toBe("설치됨 1.2.0");
    expect(row.commands).toEqual([
      "claude plugin marketplace update unity-agent-plugin",
      "claude plugin update unity@unity-agent-plugin --scope project",
    ]);
  });

  it("비활성이면 설치가 아니라 enable 을 안내한다", () => {
    const [row] = companionRows({
      companions: [unity], stacks, ...inUnityProject,
      rows: [{ name: "unity@unity-agent-plugin", enabled: false, version: "1.2.0" }],
    });
    expect(row.status).toBe("비활성");
    expect(row.commands).toEqual(["claude plugin enable unity@unity-agent-plugin"]);
  });

  it("해당 스택 프로젝트가 아니면 무관으로 표시하고 권하지 않는다", () => {
    const [row] = companionRows({ companions: [unity], stacks, rows: [], ...elsewhere });
    expect(row.relevant).toBe(false);
  });

  it("when 이 없으면 항상 관련 있다", () => {
    const [row] = companionRows({ companions: [{ ...unity, when: null }], stacks, rows: [], ...elsewhere });
    expect(row.relevant).toBe(true);
  });

  it("선언한 스택을 찾을 수 없으면 무관으로 단정하지 않는다", () => {
    const [row] = companionRows({ companions: [unity], stacks: [], rows: [], ...elsewhere });
    expect(row.relevant).toBe(true);
    expect(row.note).toContain("unity");
  });
});

describe("renderCompanions", () => {
  it("관련 있는 것만 표로 내고 없으면 그렇게 말한다", () => {
    const table = renderCompanions(companionRows({ companions: [unity], stacks, rows: [], ...inUnityProject }));
    expect(table).toContain("unity@unity-agent-plugin");
    expect(table).toContain("claude plugin install");
    expect(renderCompanions([])).toContain("없다");
  });
});
