import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("build cost tiers", () => {
  it("build declares the three cost tiers", () => {
    const md = readFileSync(join(root, "plugins/nereus/skills/build/SKILL.md"), "utf8");
    expect(md).toContain("기계적");
    expect(md).toContain("mechanical");
    expect(md).toContain("통합");
    expect(md).toContain("integration");
  });
  it("review escalate references the tier table", () => {
    const md = readFileSync(join(root, "plugins/nereus/skills/review/SKILL.md"), "utf8");
    expect(md).toContain("비용 티어");
  });
});
