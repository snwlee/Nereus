import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { TOOLS } from "../../plugins/nereus/skills/setup/scripts/detect.mjs";
import { toolStatusCached } from "../../plugins/nereus/hooks/scripts/session-start.mjs";

// 2026-11-12: 브라우저 1순위를 agent-browser(vercel-labs, Apache-2.0) CLI 로 바꾸고 chrome-devtools MCP 를 뺐다.
// 이유: MCP 는 세션마다 npx 3단 프로세스로 상주한다 — 세션당 RAM 1~2GB 의 범인이었다(2026-09-21 실측).
// agent-browser 는 쓸 때만 데몬이 뜨고 1시간 유휴면 스스로 닫힌다. Lighthouse 는 npx lighthouse 로 돈다.

const P = "plugins/nereus";
const read = (f: string) => fs.readFileSync(`${P}/${f}`, "utf8");
const all = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (["node_modules", "__pycache__"].includes(e.name) ? [] : all(`${dir}/${e.name}`)) : [`${dir}/${e.name}`]);

describe("browser MCP 를 상주시키지 않는다", () => {
  it(".mcp.json 에 browser 서버가 없고 context7 은 남는다", () => {
    const servers = JSON.parse(read(".mcp.json")).mcpServers;
    expect(Object.keys(servers)).not.toContain("browser");
    expect(JSON.stringify(servers)).not.toMatch(/chrome-devtools-mcp/);
    expect(servers).toHaveProperty("context7");
  });
  it("어떤 에이전트·스킬도 mcp__plugin_nereus_browser 도구를 가리키지 않는다", () => {
    const hits = all(P).filter((f) => /\.(md|mjs|json)$/.test(f) && /mcp__plugin_nereus_browser/.test(fs.readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});

describe("agent-browser 가 1순위다", () => {
  for (const f of ["agents/frontend.md", "agents/qa.md", "skills/e2e/SKILL.md"]) {
    it(`${f} 가 agent-browser 와 core 스킬 로드를 안내한다`, () => {
      const t = read(f);
      expect(t).toMatch(/agent-browser/);
      expect(t).toMatch(/agent-browser skills get core/);
    });
  }
  it("setup 은 agent-browser 를 필수 도구로 감지한다", () => {
    const row = TOOLS.find((t: any) => t.bin === "agent-browser");
    expect(row, "agent-browser 행").toBeTruthy();
    expect(row.required).toBe(true);
    expect(row.install.win32).toMatch(/agent-browser/);
  });
  it("세션 시작이 agent-browser 누락을 알린다", () => {
    const r = toolStatusCached({ cacheFile: path.join(os.tmpdir(), `nereus-ab-${process.pid}.json`), probe: () => false, now: 1 });
    expect(r.missing).toContain("agent-browser");
  });
});

describe("Lighthouse 는 npx 로 돈다", () => {
  it("seo 스킬이 npx lighthouse 를 쓰고 MCP 도구를 쓰지 않는다", () => {
    const t = read("skills/seo/SKILL.md");
    expect(t).toMatch(/npx -y lighthouse/);
    expect(t).not.toMatch(/lighthouse_audit/);
    // 실험실 측정은 INP 를 내지 않는다 — TBT 를 대리 지표로 쓴다고 밝힌다(지어내지 않는다).
    expect(t).toMatch(/TBT/);
  });
  it("setup 문서는 MCP 서버를 context7 하나로 설명한다", () => {
    expect(read("skills/setup/SKILL.md")).not.toMatch(/`browser`\(chrome-devtools-mcp\)/);
  });
});
