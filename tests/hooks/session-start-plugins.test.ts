import { describe, it, expect } from "vitest";
import { pluginSnapshotNote, handle } from "../../plugins/nereus/hooks/scripts/session-start.mjs";

const rec = (name: string, enabled = true) => ({ name, version: "1", enabled, installPath: "/i", surfaces: { skills: [], hooks: [], mcp: [], agents: [], bins: [], mainAgent: null } });

describe("pluginSnapshotNote", () => {
  it("records a baseline without announcing on first run", () => {
    const r = pluginSnapshotNote({ records: [rec("a@m"), rec("b@m")], previous: null });
    expect(r.note).toBeNull();
    expect(r.snapshot.sort()).toEqual(["a@m", "b@m"]);
  });
  it("announces only names absent from the previous snapshot", () => {
    const r = pluginSnapshotNote({ records: [rec("a@m"), rec("b@m")], previous: ["a@m"] });
    expect(r.note).toContain("새 플러그인 1개");
    expect(r.note).toContain("/nereus:doctor");
  });
  it("says nothing when the set is unchanged", () => {
    expect(pluginSnapshotNote({ records: [rec("a@m")], previous: ["a@m"] }).note).toBeNull();
  });
  it("ignores disabled plugins", () => {
    expect(pluginSnapshotNote({ records: [rec("a@m"), rec("z@m", false)], previous: ["a@m"] }).note).toBeNull();
  });
});

describe("handle — compact", () => {
  it("neither announces nor updates the snapshot on compact", () => {
    let wrote = false;
    const out = handle({ cwd: "/w", source: "compact" }, {
      exists: () => false, readFile: () => "", learnings: () => "",
      toolStatus: () => ({ missing: [] }), pendingCandidates: () => 0,
      pluginRecords: () => [rec("new@m")], readSnapshot: () => [], writeSnapshot: () => { wrote = true; },
    });
    expect(wrote).toBe(false);
    expect(out).toBeNull();
  });
});
