import { describe, it, expect } from "vitest";
import { classify } from "../../plugins/nereus/skills/spec/scripts/classify.mjs";

const fsOf = (files: string[]) => ({ exists: (p: string) => files.includes(p.replace(/\\/g, "/")) });

describe("spec classify", () => {
  it("is greenfield when no source and no spec dirs and few commits", () => {
    expect(classify("/r", { fsx: fsOf([]), commitCount: () => 0, hasSource: () => false })).toEqual({ kind: "greenfield", tool: "spec-kit", reason: expect.any(String) });
  });
  it("is brownfield when openspec/ exists regardless of commits", () => {
    expect(classify("/r", { fsx: fsOf(["/r/openspec"]), commitCount: () => 0, hasSource: () => false }).kind).toBe("brownfield");
  });
  it("stays greenfield when .specify/ exists (spec-kit already in use)", () => {
    const r = classify("/r", { fsx: fsOf(["/r/.specify"]), commitCount: () => 50, hasSource: () => true });
    expect(r).toMatchObject({ kind: "greenfield", tool: "spec-kit" });
  });
  it("is brownfield when source exists and commits >= 10", () => {
    expect(classify("/r", { fsx: fsOf([]), commitCount: () => 12, hasSource: () => true })).toMatchObject({ kind: "brownfield", tool: "openspec", onboard: true });
  });
  it("is greenfield when source exists but commits < 10", () => {
    expect(classify("/r", { fsx: fsOf([]), commitCount: () => 3, hasSource: () => true }).kind).toBe("greenfield");
  });
});
