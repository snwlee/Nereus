import { describe, it, expect } from "vitest";
import fs from "node:fs";

const REF = "plugins/nereus/skills/build/references/laziness-ladder.md";
const BUILD = "plugins/nereus/skills/build/SKILL.md";

describe("게으름 사다리", () => {
  it("build 스킬이 실제로 가리킨다 — 선언하고 배선하지 않는 것을 막는다", () => {
    expect(fs.existsSync(REF)).toBe(true);
    expect(fs.readFileSync(BUILD, "utf8")).toContain("laziness-ladder.md");
  });
  it("일곱 단이 순서대로 있다 — 첫 단에서 멈추는 게 핵심이다", () => {
    const t = fs.readFileSync(REF, "utf8");
    for (let n = 1; n <= 7; n += 1) expect(t, `${n}단`).toMatch(new RegExp(`^${n}\\.`, "m"));
  });
  it("출처와 라이선스를 밝힌다 — 남의 것을 가져왔다", () => {
    const t = fs.readFileSync(REF, "utf8");
    expect(t).toMatch(/DietrichGebert\/ponytail/);
    expect(t).toMatch(/MIT/);
  });
  it("가져오지 않은 것을 이유와 함께 적는다 — 조용히 이중 게이트를 만들지 않는다", () => {
    const t = fs.readFileSync(REF, "utf8");
    expect(t).toMatch(/가져오지 않(은|는)/);
    // 상류의 테스트 최소주의는 Nereus TDD 게이트와 충돌한다. 반드시 거부를 명시한다.
    expect(t).toMatch(/TDD/);
  });
  it("줄이면 안 되는 것을 명시한다", () => {
    const t = fs.readFileSync(REF, "utf8");
    for (const k of ["입력 검증", "에러 처리", "보안", "접근성"]) expect(t, k).toContain(k);
  });
});
