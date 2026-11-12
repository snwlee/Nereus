import { describe, it, expect } from "vitest";
import { AGENT_TIERS, modelsFor, resolveSize } from "../../plugins/nereus/skills/spec/scripts/model-tiers.mjs";
import { reviewOutput } from "../../plugins/nereus/skills/review/scripts/review.mjs";
import { planReview, parseReport } from "../../plugins/nereus/skills/goldfish/scripts/goldfish.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ALIASES = ["haiku", "sonnet", "opus", "fable"];
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];

describe("model tiers", () => {
  it("every tier uses a known alias and effort", () => {
    for (const [k, t] of Object.entries(AGENT_TIERS)) {
      expect(ALIASES, k).toContain(t.model);
      expect(EFFORTS, k).toContain(t.effort);
    }
  });
  it("pins the opus agents, the security effort, and keeps economy-designer on sonnet", () => {
    expect(AGENT_TIERS["nereus/architect"].model).toBe("opus");
    expect(AGENT_TIERS["nereus/security"]).toEqual({ model: "opus", effort: "high" });
    expect(AGENT_TIERS["nereus-game/gameplay-engineer"].model).toBe("opus");
    expect(AGENT_TIERS["nereus-game/economy-designer"].model).toBe("sonnet");
  });
  it("picks per-size models, medium for missing or unknown sizes", () => {
    const mid = { reviewer: "sonnet", refuter: "opus", session: null };
    expect(modelsFor("small")).toEqual(mid);
    expect(modelsFor("medium")).toEqual(mid);
    expect(modelsFor(undefined)).toEqual(mid);
    expect(modelsFor("enormous")).toEqual(mid);
    expect(modelsFor("large")).toEqual({ reviewer: "opus", refuter: "opus", session: "fable" });
  });
  it("review output carries subagent aliases only when EGM runs, and always the size", () => {
    const on = reviewOutput({ mode: "egm", runners: { egm: true } });
    expect(on.plan).toEqual({ egm: true });
    expect(on).toMatchObject({ egmModel: "sonnet", refuterModel: "opus", size: "medium", sizeAssumed: true });
    expect(reviewOutput({ mode: "egm", runners: { egm: true }, size: "large" })).toMatchObject({ egmModel: "opus", sizeAssumed: false });
    const off = reviewOutput({ mode: "none", runners: { egm: false }, size: "small" });
    for (const k of ["egmPersonas", "securityRefuter", "egmModel", "refuterModel"]) expect(off).not.toHaveProperty(k);
    expect(off).toMatchObject({ size: "small", sizeAssumed: false });
  });
  it("goldfish plan carries the reviewer alias and the size", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gf-"));
    fs.writeFileSync(path.join(dir, "doc.md"), "# Doc\n\nbody\n");
    expect(planReview("doc.md", { cwd: dir, mode: "feature" })).toMatchObject({ reviewerModel: "sonnet", size: "medium", sizeAssumed: true });
    expect(planReview("doc.md", { cwd: dir, mode: "feature", size: "large" })).toMatchObject({ reviewerModel: "opus", sizeAssumed: false });
  });
  it("a degraded marker in a third column keeps the reviewer row parseable", () => {
    const md = "## Reviewer Status\n| Reviewer | Status | Note |\n|---|---|---|\n| egm-design | completed | degraded |\n";
    expect(parseReport(md).reviewers.map((r: { name: string; status: string }) => [r.name, r.status])).toEqual([["egm-design", "completed"]]);
  });
  it("goldfish doc puts degraded in its own column", () => {
    const doc = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../../plugins/nereus/skills/goldfish/SKILL.md"), "utf8");
    expect(doc).toMatch(/\| 이름 \| completed \| degraded \|/);
  });
  it("flags an assumed size", () => {
    expect(resolveSize("large")).toEqual({ size: "large", assumed: false });
    expect(resolveSize(undefined)).toEqual({ size: "medium", assumed: true });
    expect(resolveSize("huge")).toEqual({ size: "medium", assumed: true });
    expect(resolveSize("constructor")).toEqual({ size: "medium", assumed: true });
    expect(modelsFor("constructor")).toEqual({ reviewer: "sonnet", refuter: "opus", session: null });
  });
});
