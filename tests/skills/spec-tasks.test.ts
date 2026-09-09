import { describe, it, expect } from "vitest";
import { lintTasks } from "../../plugins/nereus/skills/spec/scripts/lint-tasks.mjs";

const GOOD = `- [ ] T3. 토큰 만료 검사 미들웨어 [flow]
  - Files: Create \`src/auth/expiry.ts\` · Modify \`src/app.ts:40-55\` · Test \`src/auth/expiry.test.ts\`
  - Interfaces: Consumes \`verifyToken(token): Claims\` · Produces \`expiryGuard(): Middleware\`
  - Steps: [ ] 실패 테스트 작성 → [ ] 실패 확인 → [ ] 최소 구현 → [ ] 통과 확인 → [ ] 커밋
  - Done when: 만료 토큰 요청이 401, 유효 토큰은 통과, \`npm test\` 전부 통과`;

describe("lintTasks", () => {
  it("완전한 태스크는 통과한다", () => {
    const r = lintTasks(GOOD);
    expect(r.pass).toBe(true);
    expect(r.tasks).toBe(1);
    expect(r.findings).toEqual([]);
  });
  it("필수 항목이 빠지면 missing_section", () => {
    const r = lintTasks("- [ ] T1. 무언가\n  - Files: Create `a.ts`\n");
    expect(r.pass).toBe(false);
    const cats = r.findings.map((f: any) => f.message);
    expect(cats.join(" ")).toMatch(/Interfaces/);
    expect(cats.join(" ")).toMatch(/Done when/);
  });
  it("TBD·꺾쇠·말줄임표를 placeholder로 잡는다", () => {
    const r = lintTasks(GOOD.replace("401", "TBD") + "\n- [ ] T4. 기타\n  - Files: Create `<채우기>`\n  - Interfaces: Consumes `f(): void` · Produces `g(): void`\n  - Steps: ...\n  - Done when: 된다");
    expect(r.findings.some((f: any) => f.category === "placeholder")).toBe(true);
  });
  it("뭉뚱그린 지시·타 태스크 참조를 placeholder로 잡는다", () => {
    const r = lintTasks(`- [ ] T5. 에러 처리
  - Files: Modify \`src/a.ts:1-10\`
  - Interfaces: Consumes \`f(): void\` · Produces \`g(): void\`
  - Steps: 적절한 에러 처리를 추가하고 Task 3과 유사하게 테스트 작성
  - Done when: 잘 된다`);
    expect(r.findings.filter((f: any) => f.category === "placeholder").length).toBeGreaterThanOrEqual(2);
  });
  it("태스크가 아닌 서문·제약은 무시한다", () => {
    const r = lintTasks(`# 작업 목록\n\nGlobal Constraints: Node 20.\n\n${GOOD}`);
    expect(r.pass).toBe(true);
    expect(r.tasks).toBe(1);
  });
  it("여러 태스크를 세고 태스크명을 findings에 붙인다", () => {
    const r = lintTasks(`${GOOD}\n- [ ] T4. 빈 태스크\n`);
    expect(r.tasks).toBe(2);
    expect(r.findings.some((f: any) => f.task === "T4. 빈 태스크")).toBe(true);
  });
});
