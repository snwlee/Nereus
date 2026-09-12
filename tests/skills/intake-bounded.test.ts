import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const skill = readFileSync(join(root, "plugins", "nereus", "skills", "intake", "SKILL.md"), "utf8");

describe("intake bounded path", () => {
  it("intake declares the Bounded HARD-GATE verbatim", () => {
    // 게이트는 남는다 — 막는 대상이 "사용자 승인 전"에서 "intake.md 를 쓰기 전"으로 바뀌었을 뿐이다.
    expect(skill).toContain("intake.md 를 쓰기 전에는 구현도 코드 수정도 하지 않는다");
  });
  it("intake never hands the go/no-go decision back to the user", () => {
    expect(skill).toContain("승인은 사용자가 그 작업을 요청한 시점에 이미 끝났다");
    expect(skill).toContain("착수 여부를 다시 묻지 않는다");
  });
  it("intake references the loop route for parallel overflow", () => {
    expect(skill).toContain("nereus:loop");
  });
});
