import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const skill = readFileSync(join(root, "plugins", "nereus", "skills", "intake", "SKILL.md"), "utf8");

describe("intake bounded path", () => {
  it("intake declares the Bounded HARD-GATE verbatim", () => {
    expect(skill).toContain("승인 전에는 구현도 코드 수정도 하지 않는다");
  });
  it("intake references the loop route for parallel overflow", () => {
    expect(skill).toContain("nereus:loop");
  });
});
