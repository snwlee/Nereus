import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// 머신 절대 경로를 하드코딩하면 로컬만 통과하고 CI 에서 ENOENT 로 깨진다(실제로 깨졌다).
// 저장소 루트는 이 파일 위치에서 계산한다.
const ROOT = path.resolve(__dirname, "..", "..");
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
