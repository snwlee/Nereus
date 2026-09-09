import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const HOOKS_JSON = path.join(REPO, ".opencode", "hooks.json");
const SCRIPTS = path.join(REPO, "plugins", "nereus", "hooks", "scripts");

function load() {
  return JSON.parse(fs.readFileSync(HOOKS_JSON, "utf8"));
}
function commandsOf(cfg: any, event: string): string[] {
  return (cfg.hooks?.[event] ?? []).flatMap((g: any) => (g.hooks ?? []).map((h: any) => h.command ?? ""));
}
function matchersOf(cfg: any, event: string): string[] {
  return (cfg.hooks?.[event] ?? []).map((g: any) => g.matcher ?? "");
}

describe("opencode hooks mapping (Claude schema)", () => {
  it(".opencode/hooks.json 이 유효한 JSON이다", () => {
    expect(() => load()).not.toThrow();
  });
  it("자사 브릿지 플러그인이 없다 (oh-my-opencode 내장 브릿지와 중복 실행 방지)", () => {
    expect(fs.existsSync(path.join(REPO, ".opencode", "plugins", "nereus-hooks.js"))).toBe(false);
  });
  it("모든 command가 저장소 안 스크립트를 가리킨다", () => {
    const cfg = load();
    const cmds = Object.keys(cfg.hooks ?? {}).flatMap((e) => commandsOf(cfg, e));
    expect(cmds.length).toBeGreaterThan(0);
    for (const c of cmds) {
      const m = c.match(/hooks\/scripts\/([a-z-]+\.mjs)/);
      expect(m).not.toBeNull();
      expect(fs.existsSync(path.join(SCRIPTS, m![1]))).toBe(true);
    }
  });
  it("PreToolUse가 Bash와 Edit|Write를 잡고 pre-tool-guard로 간다", () => {
    const cfg = load();
    const all = matchersOf(cfg, "PreToolUse").join("|");
    expect(all).toMatch(/Bash/);
    expect(all).toMatch(/Edit/);
    expect(commandsOf(cfg, "PreToolUse").join(" ")).toMatch(/pre-tool-guard\.mjs/);
  });
  it("PostToolUse 편집 경로에 tdd-guard가 있다", () => {
    const cfg = load();
    expect(commandsOf(cfg, "PostToolUse").join(" ")).toMatch(/tdd-guard\.mjs/);
  });
  it("Stop·SessionStart·PreCompact·SessionEnd·UserPromptSubmit이 연결된다", () => {
    const cfg = load();
    expect(commandsOf(cfg, "Stop").join(" ")).toMatch(/finish-check\.mjs/);
    expect(commandsOf(cfg, "SessionStart").join(" ")).toMatch(/session-start\.mjs/);
    expect(commandsOf(cfg, "PreCompact").join(" ")).toMatch(/pre-compact\.mjs/);
    expect(commandsOf(cfg, "SessionEnd").join(" ")).toMatch(/session-end\.mjs/);
    expect(commandsOf(cfg, "UserPromptSubmit").join(" ")).toMatch(/skill-router\.mjs/);
  });
});
