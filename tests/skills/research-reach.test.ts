import { describe, it, expect } from "vitest";
import fs from "node:fs";

const DETECT = "plugins/nereus/skills/setup/scripts/detect.mjs";
const SKILL = "plugins/nereus/skills/research/SKILL.md";
const AGENT = "plugins/nereus/agents/researcher.md";

describe("Agent Reach 배선", () => {
  it("setup 이 agent-reach 를 감지 대상으로 안다", () => {
    const t = fs.readFileSync(DETECT, "utf8");
    expect(t).toMatch(/bin:\s*"agent-reach"/);
  });
  it("상류를 Panniantong 으로 고정한다 — PyPI 의 agent-reach 는 동명이인이다", () => {
    const t = fs.readFileSync(DETECT, "utf8");
    const line = t.split("\n").find((l) => /bin:\s*"agent-reach"/.test(l)) ?? "";
    expect(line).toMatch(/Panniantong/);
    // jgalea/agent-reach(PyPI 0.1.0)는 채널이 rss·youtube 둘뿐인 다른 프로젝트다.
    expect(line).not.toMatch(/uv tool install agent-reach\b/);
    expect(line).not.toMatch(/pipx install agent-reach\b/);
  });
  it("research 스킬이 doctor 로 살아 있는 경로를 먼저 묻는다", () => {
    const t = fs.readFileSync(SKILL, "utf8");
    expect(t).toContain("agent-reach doctor");
  });
  it("백엔드를 스킬에 박지 않는다 — 상류가 주기적으로 갈아치운다", () => {
    const t = fs.readFileSync(SKILL, "utf8");
    for (const backend of ["twitter-cli", "rdt-cli", "bili-cli", "OpenCLI"]) {
      expect(t, backend).not.toContain(backend);
    }
  });
  it("설치 안 됨을 결과 0 으로 읽지 않는다", () => {
    const t = fs.readFileSync(SKILL, "utf8");
    expect(t).toMatch(/미설치|없으면/);
  });
  it("researcher 에이전트도 같은 절차를 가리킨다", () => {
    expect(fs.readFileSync(AGENT, "utf8")).toContain("agent-reach doctor");
  });
});
