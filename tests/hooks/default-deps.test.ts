import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { handle as batonMeter } from "../../plugins/nereus/hooks/scripts/baton-meter.mjs";
import { handle as tddGuard } from "../../plugins/nereus/hooks/scripts/tdd-guard.mjs";
import { handle as finishCheck } from "../../plugins/nereus/hooks/scripts/finish-check.mjs";
import { handle as preCompact } from "../../plugins/nereus/hooks/scripts/pre-compact.mjs";
import { handle as sessionEnd } from "../../plugins/nereus/hooks/scripts/session-end.mjs";
import { toolStatusCached, handle as sessionStart } from "../../plugins/nereus/hooks/scripts/session-start.mjs";
import { run } from "../../plugins/nereus/hooks/scripts/lib/exec.mjs";
import { loadConfig } from "../../plugins/nereus/hooks/scripts/lib/config.mjs";
import { mdToTypst, wrapMarkdownForTypst, templatePath } from "../../plugins/nereus/skills/pdf/scripts/pdf.mjs";
import { classify } from "../../plugins/nereus/skills/spec/scripts/classify.mjs";

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "nereus-deps-"));
  fs.writeFileSync(path.join(dir, "package.json"), '{"scripts":{"test":"vitest run"}}');
  fs.mkdirSync(path.join(dir, "src"));
  const line = JSON.stringify({ message: { role: "assistant", model: "claude-opus-5", usage: { input_tokens: 170000 } } });
  fs.writeFileSync(path.join(dir, "t.jsonl"), line + "\n");
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("default (file-backed) dependencies", () => {
  it("baton-meter uses file marks: hard stop repeats, warn once", () => {
    const input = { session_id: "d1", cwd: dir, transcript_path: path.join(dir, "t.jsonl") };
    expect(batonMeter(input)!.hookSpecificOutput.additionalContext).toContain("하드 스톱");
    expect(batonMeter(input)).not.toBeNull();
    const warnLine = JSON.stringify({ message: { role: "assistant", model: "claude-opus-5", usage: { input_tokens: 140000 } } });
    fs.writeFileSync(path.join(dir, "w.jsonl"), warnLine + "\n");
    const w = { session_id: "d2", cwd: dir, transcript_path: path.join(dir, "w.jsonl") };
    expect(batonMeter(w)).not.toBeNull();
    expect(batonMeter(w)).toBeNull();
    expect(fs.existsSync(path.join(dir, ".nereus", ".baton-warn-d2"))).toBe(true);
  });
  it("tdd-guard persists history per session in .nereus", () => {
    const edit = (f: string) => ({ session_id: "d3", cwd: dir, tool_name: "Edit", tool_input: { file_path: path.join(dir, f) } });
    expect(tddGuard(edit("src/a.ts"))).not.toBeNull();
    expect(tddGuard(edit("src/a.ts"))).toBeNull();
    expect(JSON.parse(fs.readFileSync(path.join(dir, ".nereus", ".tdd-d3.json"), "utf8"))).toEqual(["src/a.ts", "src/a.ts"]);
  });
  it("finish-check default deps work outside a git repo and track handoff freshness", () => {
    const first = finishCheck({ cwd: dir, session_id: "d4" });
    expect(first === null || typeof first.systemMessage === "string").toBe(true);
    fs.mkdirSync(path.join(dir, ".nereus"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".nereus", "handoff.md"), "# H");
    expect(finishCheck({ cwd: dir, session_id: "d4" })).toBeNull();
  });
  it("pre-compact reads real mtime", () => {
    expect(preCompact({ cwd: dir })).toBeNull();
    expect(preCompact({ cwd: path.join(dir, "nowhere") })).not.toBeNull();
  });
  it("session-end default detection does not throw", () => {
    const notes: string[] = [];
    expect(sessionEnd({ cwd: dir }, { note: (m: string) => notes.push(m) })).toBeNull();
  });
  it("toolStatusCached writes and reuses a cache file", () => {
    const cacheFile = path.join(dir, "tools.json");
    let probes = 0;
    const a = toolStatusCached({ cacheFile, probe: () => { probes++; return false; }, now: 1000 });
    const b = toolStatusCached({ cacheFile, probe: () => { probes++; return true; }, now: 2000 });
    expect(a.missing.length).toBeGreaterThan(0);
    expect(b.missing).toEqual(a.missing);
    expect(probes).toBe(a.missing.length);
    expect(sessionStart({ cwd: dir, source: "startup" }, { toolStatus: () => toolStatusCached({ cacheFile, now: 3000 }) })).not.toBeNull();
  });
  it("exec.run executes a real command and reports missing ones", () => {
    expect(run("node", ["-e", "process.stdout.write('hi')"]).stdout).toBe("hi");
    expect(run("definitely-not-a-binary-xyz", []).ok).toBe(false);
  });
  it("loadConfig with real files merges project over user", () => {
    const userDir = path.join(dir, "u"); const projectDir = path.join(dir, ".nereus");
    fs.mkdirSync(userDir, { recursive: true }); fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(userDir, "config.json"), '{"secondOpinion":"codex"}');
    fs.writeFileSync(path.join(projectDir, "config.json"), '{"secondOpinion":"gemini"}');
    expect(loadConfig({ userDir, projectDir }).secondOpinion).toBe("gemini");
  });
  it("pdf markdown wrapping produces typst files", () => {
    expect(mdToTypst("# T\n## S\n**b** `c`\n- x")).toBe("= T\n== S\n*b* `c`\n- x");
    const main = wrapMarkdownForTypst({ markdown: "# T", template: templatePath("typst", "report"), title: 'A "q"', font: "Noto Sans KR", outDir: dir });
    expect(fs.readFileSync(main, "utf8")).toContain('title: "A \\"q\\""');
    expect(fs.existsSync(path.join(dir, "body.typ"))).toBe(true);
  });
  it("classify default deps run against a real directory", () => {
    expect(classify(dir).kind).toBe("greenfield");
  });
});
