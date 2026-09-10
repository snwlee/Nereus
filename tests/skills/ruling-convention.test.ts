import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROOT = "/Volumes/SKHY1TB/workspace/Nereus";
const common = readFileSync(`${ROOT}/plugins/nereus/skills/common/SKILL.md`, "utf8");
const review = readFileSync(`${ROOT}/plugins/nereus/skills/review/SKILL.md`, "utf8");
const finish = readFileSync(`${ROOT}/plugins/nereus/skills/finish/SKILL.md`, "utf8");

describe("ruling convention", () => {
  it("common defines the canonical Ruling format", () => {
    expect(common).toContain("Ruling:");
  });
  it("review and finish point at the canonical format", () => {
    expect(review).toContain("Ruling");
    expect(finish).toContain("Ruling");
  });
});
