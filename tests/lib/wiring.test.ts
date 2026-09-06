import { describe, it, expect } from "vitest";
import { isEntryScript, findOrphans, checkReleaseHandoff, checkWiring } from "../../plugins/nereus/hooks/scripts/lib/wiring.mjs";

describe("isEntryScript", () => {
  it("treats skill and hook scripts as entry points", () => {
    expect(isEntryScript("plugins/nereus/skills/handoff/scripts/auto-clear.mjs")).toBe(true);
    expect(isEntryScript("plugins/nereus/hooks/scripts/session-start.mjs")).toBe(true);
  });
  it("ignores shared libs, tests and non-scripts", () => {
    expect(isEntryScript("plugins/nereus/hooks/scripts/lib/exec.mjs")).toBe(false);
    expect(isEntryScript("tests/skills/auto-clear.test.ts")).toBe(false);
    expect(isEntryScript("plugins/nereus/skills/handoff/SKILL.md")).toBe(false);
  });
});

describe("findOrphans", () => {
  const script = "plugins/nereus/skills/handoff/scripts/auto-clear.mjs";

  it("flags a new script that nothing references", () => {
    const r = findOrphans({
      scripts: [script],
      refs: [{ file: "plugins/nereus/skills/handoff/SKILL.md", text: "핸드오프를 커밋한다." }],
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ category: "unwired", file: script });
  });

  it("passes once a SKILL.md invokes it by filename", () => {
    const r = findOrphans({
      scripts: [script],
      refs: [{ file: "plugins/nereus/skills/handoff/SKILL.md", text: 'node "${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/auto-clear.mjs"' }],
    });
    expect(r).toEqual([]);
  });

  it("does not count the script itself as its own reference", () => {
    const r = findOrphans({ scripts: [script], refs: [{ file: script, text: "// auto-clear.mjs 는 …" }] });
    expect(r).toHaveLength(1);
  });

  it("does not count tests as wiring — passing tests were exactly the auto-clear trap", () => {
    const r = findOrphans({
      scripts: [script],
      refs: [{ file: "tests/skills/auto-clear.test.ts", text: 'import { planSteps } from "../../plugins/nereus/skills/handoff/scripts/auto-clear.mjs";' }],
    });
    expect(r).toHaveLength(1);
  });

  it("counts a reference from another script or a hooks manifest", () => {
    expect(findOrphans({ scripts: [script], refs: [{ file: "plugins/nereus/hooks/hooks.json", text: "scripts/auto-clear.mjs" }] })).toEqual([]);
  });
});

describe("checkReleaseHandoff", () => {
  const bump = (file: string) => ({ file, added: ['  "version": "0.13.0",'], removed: ['  "version": "0.12.0",'] });
  const manifest = "plugins/nereus/.claude-plugin/plugin.json";

  it("flags a version bump when handoff.md still describes the old version", () => {
    const r = checkReleaseHandoff([bump(manifest)], () => "# Handoff — Nereus (v0.12.0)");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ category: "handoff_stale" });
  });

  it("passes when handoff.md mentions the new version — handoff.md is gitignored, so diff membership cannot be the signal", () => {
    expect(checkReleaseHandoff([bump(manifest)], () => "# Handoff — Nereus (v0.13.0)")).toEqual([]);
  });

  it("passes when handoff.md is itself part of the change", () => {
    expect(checkReleaseHandoff([bump(manifest), { file: ".nereus/handoff.md", added: ["## 완료"], removed: [] }], () => "낡음")).toEqual([]);
  });

  it("stays quiet in projects that keep no handoff at all", () => {
    expect(checkReleaseHandoff([bump(manifest)], () => null)).toEqual([]);
  });

  it("stays quiet when no version changed", () => {
    expect(checkReleaseHandoff([{ file: "src/a.ts", added: ["const a = 1;"], removed: [] }], () => "낡음")).toEqual([]);
  });

  it("ignores dependency version lines in a lockfile", () => {
    expect(checkReleaseHandoff([{ file: "package-lock.json", added: ['      "version": "1.2.3",'], removed: [] }], () => "낡음")).toEqual([]);
  });
});

describe("checkWiring", () => {
  it("merges both checks over a parsed diff and a repo reader", () => {
    const files = [
      { file: "plugins/nereus/skills/handoff/scripts/orphan.mjs", added: ["export const x = 1;"], removed: [] },
      { file: "plugins/nereus/.claude-plugin/plugin.json", added: ['  "version": "0.13.0",'], removed: [] },
    ];
    const r = checkWiring({ files, listRefs: () => [{ file: "plugins/nereus/skills/handoff/SKILL.md", text: "무관한 내용" }], readHandoff: () => "v0.12.0" });
    expect(r.pass).toBe(false);
    expect(r.findings.map((f: any) => f.category).sort()).toEqual(["handoff_stale", "unwired"]);
  });

  it("passes a fully wired release", () => {
    const files = [
      { file: "plugins/nereus/skills/handoff/scripts/wired.mjs", added: ["export const x = 1;"], removed: [] },
      { file: "plugins/nereus/.claude-plugin/plugin.json", added: ['  "version": "0.13.0",'], removed: [] },
      { file: ".nereus/handoff.md", added: ["## 완료"], removed: [] },
    ];
    const r = checkWiring({ files, listRefs: () => [{ file: "plugins/nereus/skills/handoff/SKILL.md", text: "node scripts/wired.mjs" }], readHandoff: () => "v0.13.0" });
    expect(r).toEqual({ pass: true, findings: [] });
  });
});
