import { describe, it, expect } from "vitest";
import { planWork } from "../../plugins/nereus/skills/spec/scripts/plan.mjs";

const brown = { fsx: { exists: (p: string) => p.endsWith("openspec") }, commitCount: () => 50, hasSource: () => true };
const green = { fsx: { exists: () => false }, commitCount: () => 2, hasSource: () => false };

describe("planWork", () => {
  it("turns the interview off for a medium change to existing code", () => {
    const p = planWork({ cwd: "/r", size: "medium" }, brown);
    expect(p.interview).toBe("none");
    expect(p.specTool).toBe("openspec");
    expect(p.reverseSpec).toBe(true);
  });
  it("keeps a short interview for a medium greenfield feature", () => {
    const p = planWork({ cwd: "/r", size: "medium" }, green);
    expect(p.interview).toBe("short");
    expect(p.specTool).toBe("spec-kit");
    expect(p.reverseSpec).toBe(false);
  });
  it("skips the interview and the spec tool for a small change either way", () => {
    for (const deps of [brown, green]) {
      const p = planWork({ cwd: "/r", size: "small" }, deps);
      expect(p.interview).toBe("none");
      expect(p.specTool).toBe("tasks-only");
      expect(p.reverseSpec).toBe(false);
    }
  });
  it("asks for a PRD only on a large greenfield product", () => {
    expect(planWork({ cwd: "/r", size: "large" }, green).prd).toBe(true);
    expect(planWork({ cwd: "/r", size: "large" }, green).interview).toBe("full");
    expect(planWork({ cwd: "/r", size: "large" }, brown).prd).toBe(false);
    expect(planWork({ cwd: "/r", size: "large" }, brown).interview).toBe("short");
  });
  it("defaults an unknown size to medium", () => {
    expect(planWork({ cwd: "/r" }, brown).size).toBe("medium");
    expect(planWork({ cwd: "/r", size: "enormous" }, brown).size).toBe("medium");
  });
  it("carries the classify verdict through untouched", () => {
    const p = planWork({ cwd: "/r", size: "medium" }, brown);
    expect(p.kind).toBe("brownfield");
    expect(p.tool).toBe("openspec");
    expect(typeof p.reason).toBe("string");
  });
});
