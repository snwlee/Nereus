# tasks — add-workflow-autonomy

- [x] T1. planWork — 규모 × 신규/수정 매트릭스 (순수)
  - Files: Create `plugins/nereus/skills/spec/scripts/plan.mjs` · Test `tests/skills/spec-plan.test.ts`
  - Interfaces: Consumes `classify(cwd, deps)` (기존, 변경 없음) · Produces `planWork({ cwd, size }, deps)` →
    `{ size, kind, tool, reason, interview, specTool, reverseSpec, prd }`.
    `interview` 는 `"none"|"short"|"full"`, `specTool` 은 `"tasks-only"|"spec-kit"|"openspec"`.
  - Steps:
    - [ ] 실패 테스트 작성 — `tests/skills/spec-plan.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { planWork } from "../../plugins/nereus/skills/spec/scripts/plan.mjs";

      const brown = { fsx: { exists: (p: string) => p.endsWith("openspec") }, commitCount: () => 50, hasSource: () => true };
      const green = { fsx: { exists: () => false }, commitCount: () => 2, hasSource: () => false };

      describe("planWork", () => {
        it("turns the interview off for a medium change to existing code", () => {
          const p = planWork({ cwd: "/r", size: "medium" }, brown);
          expect(p.interview).toBe("none");
          expect(p.specTool).toBe("openspec");
          expect(p.reverseSpec).toBe(true);
        });
        it("keeps a short interview for a medium greenfield feature", () => {
          const p = planWork({ cwd: "/r", size: "medium" }, green);
          expect(p.interview).toBe("short");
          expect(p.specTool).toBe("spec-kit");
          expect(p.reverseSpec).toBe(false);
        });
        it("skips the interview and the spec tool for a small change either way", () => {
          for (const deps of [brown, green]) {
            const p = planWork({ cwd: "/r", size: "small" }, deps);
            expect(p.interview).toBe("none");
            expect(p.specTool).toBe("tasks-only");
            expect(p.reverseSpec).toBe(false);
          }
        });
        it("asks for a PRD only on a large greenfield product", () => {
          expect(planWork({ cwd: "/r", size: "large" }, green).prd).toBe(true);
          expect(planWork({ cwd: "/r", size: "large" }, green).interview).toBe("full");
          expect(planWork({ cwd: "/r", size: "large" }, brown).prd).toBe(false);
          expect(planWork({ cwd: "/r", size: "large" }, brown).interview).toBe("short");
        });
        it("defaults an unknown size to medium", () => {
          expect(planWork({ cwd: "/r" }, brown).size).toBe("medium");
          expect(planWork({ cwd: "/r", size: "enormous" }, brown).size).toBe("medium");
        });
        it("carries the classify verdict through untouched", () => {
          const p = planWork({ cwd: "/r", size: "medium" }, brown);
          expect(p.kind).toBe("brownfield");
          expect(p.tool).toBe("openspec");
          expect(typeof p.reason).toBe("string");
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/skills/spec-plan.test.ts` · Expected: FAIL (plan.mjs 없음)
    - [ ] 최소 구현 — `plugins/nereus/skills/spec/scripts/plan.mjs`:
      ```js
      // 규모 × 신규/수정 → 인터뷰·스펙 도구·역스펙·PRD. 결정 지점을 한 곳에 모은다.
      // classify 는 손대지 않는다 — spec/SKILL.md 와 기존 테스트가 그 출력을 쓴다.
      import { classify } from "./classify.mjs";

      const SIZES = new Set(["small", "medium", "large"]);

      const MATRIX = {
        "small:greenfield":  { interview: "none",  specTool: "tasks-only", reverseSpec: false, prd: false },
        "small:brownfield":  { interview: "none",  specTool: "tasks-only", reverseSpec: false, prd: false },
        "medium:greenfield": { interview: "short", specTool: "spec-kit",   reverseSpec: false, prd: false },
        // 기존 코드의 요구는 코드에 있다. 역스펙이 답하므로 인터뷰가 되묻지 않게 한다.
        "medium:brownfield": { interview: "none",  specTool: "openspec",   reverseSpec: true,  prd: false },
        "large:greenfield":  { interview: "full",  specTool: "spec-kit",   reverseSpec: false, prd: true  },
        // 여러 시스템에 걸치면 "무엇을 하지 않을 것인가"는 코드에 없다. 짧게 남긴다.
        "large:brownfield":  { interview: "short", specTool: "openspec",   reverseSpec: true,  prd: false },
      };

      export function planWork({ cwd, size } = {}, deps = {}) {
        const s = SIZES.has(size) ? size : "medium";   // 모르면 중간이 가장 덜 틀린다
        const c = classify(cwd, deps);
        return { size: s, ...c, ...MATRIX[`${s}:${c.kind}`] };
      }

      if (process.argv[1] && /plan\.mjs$/.test(process.argv[1])) {
        const i = process.argv.indexOf("--size");
        process.stdout.write(JSON.stringify(planWork({ cwd: process.argv[2] || process.cwd(), size: i > -1 ? process.argv[i + 1] : undefined })) + "\n");
      }
      ```
    - [ ] 통과 확인: Run `npx vitest run tests/skills/spec-plan.test.ts` · Expected: PASS
    - [ ] CLI 확인: Run `node plugins/nereus/skills/spec/scripts/plan.mjs "$PWD" --size medium` · Expected: `"interview":"none"` 이 들어간 JSON 한 줄
    - [ ] 커밋: `git add plugins/nereus/skills/spec/scripts/plan.mjs tests/skills/spec-plan.test.ts && git commit -m "feat(spec): planWork — 규모 × 신규/수정 매트릭스"`
  - Done when: 6개 테스트 통과, CLI 가 JSON 한 줄을 낸다, `classify` 테스트가 그대로 통과

- [x] T2. 되묻지 않는 규칙을 세션마다 주입한다
  - Files: Modify `plugins/nereus/hooks/scripts/session-start.mjs` · Test `tests/hooks/session-start.test.ts`
  - Interfaces: Produces `ASK_POLICY` (export 상수) · `handle()` 의 주입 내용에 추가. 새 deps 없음.
  - Steps:
    - [ ] 실패 테스트 작성 — `tests/hooks/session-start.test.ts` 에 추가:
      ```ts
      it("injects the standing rule that ordering is never handed back to the user", () => {
        const out = handle({ session_id: "s1", cwd: "/r", source: "startup" }, deps({}));
        const ctx = out!.hookSpecificOutput.additionalContext;
        expect(ctx).toContain("순서");
        expect(ctx).toContain("묻지 않는다");
      });
      it("does not repeat the rule on compact", () => {
        const out = handle({ session_id: "s1", cwd: "/r", source: "compact" }, deps({}));
        const ctx = out?.hookSpecificOutput?.additionalContext ?? "";
        expect(ctx).not.toContain("묻지 않는다");
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/hooks/session-start.test.ts` · Expected: FAIL (문구 없음)
    - [ ] 최소 구현 — `session-start.mjs` 에 상수를 더하고 스킬 맵과 같은 자리(`source !== "compact"` 블록)에서 push 한다:
      ```js
      // 스킬 문서에만 두면 그 스킬을 부르지 않은 턴에는 적용되지 않는다. 매 컨텍스트에 한 줄 심는다.
      export const ASK_POLICY =
        "순서·우선순위·착수 승인은 묻지 않는다. 할 일이 정해져 있으면 스스로 순서를 정해 하나씩 전부 끝낸다. "
        + "질문은 (a) 하네스가 알 수 없는 정보와 (b) 외부로 나가는·되돌리기 어려운 행동에만 쓴다.";
      ```
      주입은 `parts.push(\`## 작업 방식\n${ASK_POLICY}\`)` 한 줄로 한다.
    - [ ] 통과 확인: Run `npx vitest run tests/hooks/session-start.test.ts` · Expected: PASS
    - [ ] 회귀 확인: Run `npx vitest run tests/hooks/` · Expected: 전부 통과
    - [ ] 커밋: `git add plugins/nereus/hooks/scripts/session-start.mjs tests/hooks/session-start.test.ts && git commit -m "feat(harness): 되묻지 않는 규칙을 세션마다 주입"`
  - Done when: 새 테스트 2개 통과, 기존 훅 테스트 전부 통과, compact 에는 안 들어간다

- [ ] T3. intake·spec·common 문서에서 되묻는 지점을 없앤다
  - Files: Modify `plugins/nereus/skills/intake/SKILL.md` · Modify `plugins/nereus/skills/common/SKILL.md` · Modify `plugins/nereus/skills/spec/SKILL.md`
  - Interfaces: 없음(문서). 계약은 T1·T2 가 정한다.
  - Steps:
    - [ ] `intake/SKILL.md` §0 을 `plan.mjs` 호출로 바꾼다. 규모를 판정해 `--size` 로 넘기고, 결과를 한 줄로 **알리고 그대로 진행**한다. "제안하고 동의하면"을 지운다.
    - [ ] `intake/SKILL.md` HARD-GATE 를 고친다: "승인 전 코드 금지"는 유지하고, 승인의 정의를 "사용자가 그 작업을 요청한 시점"으로 적는다. "intake.md 사용자 승인"이라는 별도 확인 단계를 지운다.
    - [ ] `intake/SKILL.md` §2·§3 을 고친다: 인터뷰 여부는 `plan.interview` 를 따른다(`none` 이면 인터뷰를 돌리지 않는다). 게이트의 "가정 표를 사용자가 승인"을 "가정 표를 알리고 진행"으로 바꾼다.
    - [ ] `spec/SKILL.md` §1 을 `classify.mjs` 대신 `plan.mjs` 를 돌리게 바꾸고, `plan.reverseSpec` 이 true 일 때만 역스펙 절차를 밟는다고 적는다.
    - [ ] `common/SKILL.md` 에 규칙 한 줄을 더한다: 순서·우선순위·착수 승인은 묻지 않는다. 남기는 질문 두 가지를 명시한다.
    - [ ] 확인: Run `grep -n "동의하면\|승인\|확인받는다" plugins/nereus/skills/intake/SKILL.md` · Expected: 착수 승인을 요구하는 줄이 남아 있지 않다(승인의 정의를 설명하는 줄은 허용)
    - [ ] 커밋: `git add plugins/nereus/skills && git commit -m "docs(harness): 순서·착수를 되묻지 않는다"`
  - Done when: intake 가 규모를 판정→알림→진행으로 이어지고, 인터뷰 여부가 `plan.interview` 로 결정되며, build 의 테스트 환경 질문과 finish 의 푸시 질문은 그대로 남아 있다

## Global Constraints

- Node 20+ 표준 라이브러리만. 새 의존성 없음.
- vitest (`npm test`). TDD 강제 — RED 를 실제로 확인한 뒤 구현한다.
- `classify()` 의 시그니처와 출력은 바꾸지 않는다. `planWork` 가 감싼다.
- 순수 함수와 I/O 분리. fs·git 은 deps 로 주입한다.
- 훅은 fail-open. 어떤 실패도 세션 시작을 막지 않는다.
- build 의 "테스트 환경 세팅할까요"와 finish 의 "푸시할까요"는 **제거 대상이 아니다**.
