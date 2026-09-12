import { describe, it, expect } from "vitest";
import { lintTasks } from "../../plugins/nereus/skills/spec/scripts/lint-tasks.mjs";

const LT = String.fromCharCode(60), GT = String.fromCharCode(62);
const task = (...steps: string[]) => [
  "- [ ] T1. 예시",
  "  - Files: Modify `a.ts`",
  "  - Interfaces: 없음",
  "  - Steps:",
  ...steps,
  "  - Done when: 통과",
].join("\n");

describe("lint-tasks", () => {
  it("does not flag TypeScript generics inside a fenced code block", () => {
    // 제네릭을 리터럴로 적으면 이 파일 자신이 린터에 걸린다 — 그것이 고치려는 오탐이다.
    const md = task("    - [ ] 구현:", "      ```ts", `      const rows: Array${LT}string${GT} = [];`, `      const pair: Map${LT}string, number${GT} = new Map();`, "      ```");
    expect(lintTasks(md).findings).toEqual([]);
  });
  it("does not flag a less-than comparison inside a fenced code block", () => {
    const md = task("    - [ ] 구현:", "      ```js", "      const cmp = (a, b) => (a.name < b.name ? 1 : -1);", "      ```");
    expect(lintTasks(md).findings).toEqual([]);
  });
  it("still flags an angle-bracket placeholder in prose", () => {
    const md = task(`    - [ ] 값을 채운다: ${LT}채우기${GT}`);
    expect(lintTasks(md).findings.length).toBeGreaterThan(0);
  });
  it("still flags an elision inside a code block — that is a real gap", () => {
    const md = task("    - [ ] 구현:", "      ```js", "      const m = fs.statSync(...).mtimeMs;", "      ```");
    expect(lintTasks(md).findings.length).toBeGreaterThan(0);
  });
});
