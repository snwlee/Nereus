import { describe, it, expect } from "vitest";
import { CURATED, curatedConflicts } from "../../plugins/nereus/hooks/scripts/lib/plugin-curated.mjs";

const rec = (name: string, version: string, enabled = true) => ({ name, version, enabled, installPath: "/i", surfaces: { skills: [], hooks: [], mcp: [], agents: [], bins: [], mainAgent: null } });

describe("curatedConflicts", () => {
  it("reports the superpowers double gate as MEDIUM with a manual remedy", () => {
    const c = curatedConflicts([rec("superpowers@obra", "1.2.0"), rec("nereus@nereus", "0.19.3")], "global");
    const gate = c.find((x: any) => x.unit === "verification-before-completion");
    expect(gate).toMatchObject({ severity: "MEDIUM", kind: "double-gate" });
    expect(gate.remedy.applicable).toBe(false);
    expect(gate.remedy.manual).toContain("/plugin");
    expect(gate.evidence.length).toBeGreaterThan(0);
  });
  it("stays silent when only one side is present", () => {
    expect(curatedConflicts([rec("nereus@nereus", "0.19.3")], "global")).toEqual([]);
  });
  it("stays silent when a side is disabled", () => {
    expect(curatedConflicts([rec("superpowers@obra", "1.2.0", false), rec("nereus@nereus", "0.19.3")], "global")).toEqual([]);
  });
  it("ships only entries whose evidence and remedy are written", () => {
    expect(CURATED.length).toBe(2);
    for (const e of CURATED) {
      expect(e.evidence.trim().length).toBeGreaterThan(10);
      expect(e.remedy).toBeTruthy();
    }
  });
});
