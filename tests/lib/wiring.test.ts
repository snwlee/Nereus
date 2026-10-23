import { describe, it, expect } from "vitest";
import { isEntryScript, findOrphans, checkWiring } from "../../plugins/nereus/hooks/scripts/lib/wiring.mjs";

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

describe("checkWiring", () => {
  it("flags orphans over a parsed diff and a repo reader, and no longer checks handoff", () => {
    const files = [
      { file: "plugins/nereus/skills/handoff/scripts/orphan.mjs", added: ["export const x = 1;"], removed: [] },
      { file: "plugins/nereus/.claude-plugin/plugin.json", added: ['  "version": "0.13.0",'], removed: [] },
    ];
    const r = checkWiring({ files, listRefs: () => [{ file: "plugins/nereus/skills/handoff/SKILL.md", text: "무관한 내용" }] });
    expect(r.pass).toBe(false);
    expect(r.findings.map((f: any) => f.category)).toEqual(["unwired"]);
  });

  it("passes a fully wired release", () => {
    const files = [
      { file: "plugins/nereus/skills/handoff/scripts/wired.mjs", added: ["export const x = 1;"], removed: [] },
      { file: "plugins/nereus/.claude-plugin/plugin.json", added: ['  "version": "0.13.0",'], removed: [] },
    ];
    const r = checkWiring({ files, listRefs: () => [{ file: "plugins/nereus/skills/handoff/SKILL.md", text: "node scripts/wired.mjs" }] });
    expect(r).toEqual({ pass: true, findings: [] });
  });
});
