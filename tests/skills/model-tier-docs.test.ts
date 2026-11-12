import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../plugins/nereus/skills");
const read = (s: string) => fs.readFileSync(path.join(SKILLS, s, "SKILL.md"), "utf8");

describe("skills hand model aliases to subagent calls", () => {
  it("intake explains models, the session advice and the plan line", () => {
    const t = read("intake");
    expect(t).toMatch(/\| `models` \|/);
    expect(t).toMatch(/models\.session/);
    expect(t).toMatch(/`\.nereus\/intake\.md` 1행에 `계획:/);
  });
  it("review runs with --size and launches EGM and refuter on their aliases", () => {
    const t = read("review");
    expect(t).toMatch(/review\.mjs" \[--size small\|medium\|large\]/);
    expect(t).toMatch(/model: `egmModel`/);
    expect(t).toMatch(/model: `refuterModel`/);
    expect(t).toMatch(/sizeAssumed/);
  });
  it("goldfish runs plan with --size and launches reviewers on reviewerModel", () => {
    const t = read("goldfish");
    expect(t).toMatch(/\[--size small\|medium\|large\]/);
    expect(t).toMatch(/model: `reviewerModel`/);
    expect(t).toMatch(/sizeAssumed/);
  });
  it("subagent docs state the retry rule with a sonnet floor", () => {
    for (const s of ["review", "goldfish"]) {
      expect(read(s), s).toMatch(/한 단계 아래 별칭을 명시해 한 번만 재시도/);
      expect(read(s), s).toMatch(/하한은 `sonnet`/);
      expect(read(s), s).toMatch(/degraded/);
    }
    expect(read("review")).toMatch(/반박은 재시도하지 않는다/);
    expect(read("review")).toMatch(/지적은 차단으로 남기고/);
  });
  it("build maps cost tiers to aliases", () => {
    const t = read("build");
    expect(t).toMatch(/\| 린트·재테스트 실행 \| `haiku` \(파일을 바꾸지 않는 실행만\) \|/);
    expect(t).toMatch(/haiku < sonnet < opus < fable/);
  });
});
