import { describe, it, expect } from "vitest";
import { structuralConflicts, fingerprint } from "../../plugins/nereus/hooks/scripts/lib/plugin-conflicts.mjs";

const rec = (name: string, version: string, enabled: boolean, surfaces: any) => ({
  name, version, enabled, installPath: "/i/" + name,
  surfaces: { skills: [], hooks: [], mcp: [], agents: [], bins: [], mainAgent: null, ...surfaces },
});

describe("structuralConflicts", () => {
  it("flags a duplicated MCP server name as HIGH with a deny remedy", () => {
    const c = structuralConflicts([
      rec("ecc@ecc", "2.0.0", true, { mcp: ["chrome-devtools"] }),
      rec("nereus@nereus", "0.19.3", true, { mcp: ["chrome-devtools"] }),
    ], "global");
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ severity: "HIGH", kind: "mcp-shadow", unit: "chrome-devtools", scope: "global" });
    expect(c[0].remedy).toMatchObject({ applicable: true, kind: "permissions-deny", value: "mcp__chrome-devtools" });
  });
  it("ignores a duplicate when one side is disabled", () => {
    expect(structuralConflicts([
      rec("ecc@ecc", "2.0.0", false, { mcp: ["chrome-devtools"] }),
      rec("nereus@nereus", "0.19.3", true, { mcp: ["chrome-devtools"] }),
    ], "global")).toEqual([]);
  });
  it("flags duplicated agent names and bin names as HIGH", () => {
    const kinds = structuralConflicts([
      rec("a@m", "1", true, { agents: ["reviewer"], bins: ["ooo"] }),
      rec("b@m", "1", true, { agents: ["reviewer"], bins: ["ooo"] }),
    ], "global").map((x: any) => x.kind).sort();
    expect(kinds).toEqual(["agent-shadow", "bin-shadow"]);
  });
  it("flags a shared hook point as LOW with no remedy", () => {
    const c = structuralConflicts([
      rec("a@m", "1", true, { hooks: [{ event: "PostToolUse", matcher: "Edit" }] }),
      rec("b@m", "1", true, { hooks: [{ event: "PostToolUse", matcher: "Edit" }] }),
    ], "global");
    expect(c[0]).toMatchObject({ severity: "LOW", kind: "hook-shared" });
    expect(c[0].remedy.applicable).toBe(false);
  });
});

describe("fingerprint", () => {
  const base = { kind: "mcp-shadow", unit: "chrome-devtools", sides: [{ name: "ecc@ecc", version: "2.0.0" }, { name: "nereus@nereus", version: "0.19.3" }] };
  it("is stable regardless of side order", () => {
    expect(fingerprint(base)).toBe(fingerprint({ ...base, sides: [base.sides[1], base.sides[0]] }));
  });
  it("changes when a version changes", () => {
    expect(fingerprint(base)).not.toBe(fingerprint({ ...base, sides: [{ name: "ecc@ecc", version: "2.1.0" }, base.sides[1]] }));
  });
});
