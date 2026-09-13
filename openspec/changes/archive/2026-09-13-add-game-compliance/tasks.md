# tasks — add-game-compliance

- [x] T1. 정책 수치를 출처·확인일과 함께 데이터로 선언한다
  - Files: Create `plugins/nereus-game/policy.json` · Create `plugins/nereus-game/lib/policy.mjs` · Test `tests/lib/policy.test.ts`
  - Interfaces: Produces `loadPolicy(deps): Policy` · `surfacesFor(policy, markets): string[]`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/policy.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { loadPolicy, surfacesFor } from "../../plugins/nereus-game/lib/policy.mjs";

      describe("policy", () => {
        it("정책마다 출처와 확인일이 붙어 있다 — 남이 정한 값이라 언제 확인했는지가 중요하다", () => {
          const p = loadPolicy();
          expect(p.source).toMatch(/^https:\/\//);
          expect(p.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
        it("기본 공개 표면은 게임 안이다", () => {
          expect(surfacesFor(loadPolicy(), [])).toEqual(["game"]);
        });
        it("한국 시장은 게임·웹사이트·광고 세 곳을 요구한다", () => {
          const s = surfacesFor(loadPolicy(), ["KR"]);
          expect(s).toEqual(expect.arrayContaining(["game", "website", "ad"]));
        });
        it("모르는 시장은 기본 표면만 요구한다 — 없는 규제를 지어내지 않는다", () => {
          expect(surfacesFor(loadPolicy(), ["ZZ"])).toEqual(["game"]);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/policy.test.ts` · Expected: FAIL (policy.mjs 없음)
    - [x] `policy.json` 작성. `paidRandom` 아래 `oddsDecimalsForDisclaimer: 4`,
      `baseSurfaces: ["game"]`, `markets: { KR: { surfaces: ["game","website","ad"], law: "게임산업진흥에 관한 법률", effective: "2024-03-22" } }`,
      그리고 `source`·`checkedAt` 을 최상위에 둔다.
    - [x] `lib/policy.mjs` 작성. `loadPolicy` 는 `source`·`checkedAt` 이 없으면 던진다 —
      출처 없는 정책 수치는 다음 사람이 검증할 수 없다. `surfacesFor` 는 기본 표면에
      해당 시장의 표면을 합집합한다. 모르는 시장은 무시한다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/policy.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/policy.json plugins/nereus-game/lib/policy.mjs tests/lib/policy.test.ts && git commit -m "feat(game): 플랫폼 정책 수치를 출처·확인일과 함께 데이터로 선언한다"`
  - Done when: `loadPolicy` 가 출처 없는 정책을 거부하고, `surfacesFor` 가 KR 에 세 표면을 돌려주며 모르는 시장에 기본값만 준다

- [x] T2. 유료 확률 아이템 검사기를 만든다
  - Files: Create `plugins/nereus-game/lib/compliance-check.mjs` · Test `tests/lib/compliance-check.test.ts`
  - Interfaces: Consumes `loadPolicy(deps): Policy` · `surfacesFor(policy, markets): string[]` (T1) · Produces `checkPaidRandom({ policy, plan }): { violations: Array }`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/compliance-check.test.ts` — 스펙의 13개 시나리오를 옮긴다.
      확률 합 불일치, 부동소수점 정상, 4자리+면책 문구, 결과 미선언, 구매 전 공개 없음,
      KR 표면 부족, 무료는 제외, 럭 수치 설명 없음, 럭 동적 갱신 없음, 럭 대상 없음,
      1회성 남은 확률 없음, 대체 경로 없음, 유료 없으면 대체 경로 불필요.
    - [x] 실패 확인: Run `npx vitest run tests/lib/compliance-check.test.ts` · Expected: FAIL (compliance-check.mjs 없음)
    - [x] `lib/compliance-check.mjs` 작성. **장르 프로파일을 받지 않는다.** 판정 규칙:
      - `paid` 가 거짓인 상자는 확률 관련 검사를 통째로 건너뛴다
      - `no-outcomes`: 유료 상자의 `outcomes` 가 비어 있음
      - `odds-sum`: 확률 합을 소수 6자리로 반올림해 100 과 비교. 다르면 위반.
        단 어떤 확률이든 소수 4자리 이상이고 `roundingDisclaimer` 가 참이면 통과
      - `odds-undisclosed`: `disclosedBeforePurchase` 가 참이 아님
      - `disclosure-surface`: `surfacesFor(policy, plan.markets)` 가 요구하는 표면이
        `disclosureSurfaces` 에 빠져 있음
      - `unique-no-remaining-odds`: `hasUniqueOutcomes` 가 참인데 `dynamicRemainingOdds` 가 거짓
      - `luck-effect-unexplained`: 럭 아이템의 `numericEffect` 가 빈 문자열
      - `luck-no-dynamic-update`: 럭 아이템의 `dynamicUpdate` 가 거짓
      - `luck-target-missing`: 럭 아이템의 `affects` 에 선언되지 않은 상자 이름이 있음
      - `no-restricted-fallback`: 유료 상자가 하나라도 있는데 `restrictedFallback` 이 빈 문자열
    - [x] 통과 확인: Run `npx vitest run tests/lib/compliance-check.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/compliance-check.mjs tests/lib/compliance-check.test.ts && git commit -m "feat(game): 유료 확률 아이템 규정 검사기"`
  - Done when: 13개 시나리오가 전부 통과하고, 무료 상자가 확률 검사를 건너뛴다

- [x] T3. 스킬·라우트·실행 진입점을 배선한다
  - Files: Create `plugins/nereus-game/skills/compliance/SKILL.md` · Modify `plugins/nereus-game/nereus-extension.json` · Modify `plugins/nereus-game/lib/compliance-check.mjs`
  - Interfaces: Consumes `checkPaidRandom` (T2) · `loadPolicy` (T1) · Produces route `nereus-game:compliance`, 실행 진입점 `node lib/compliance-check.mjs`
  - Steps:
    - [x] 실패 테스트를 `tests/smoke/game-domain-liveops.test.ts` 에 덧붙인다:
      ```ts
      it("compliance 스킬이 배선돼 있고 자기 검사기를 부른다", () => {
        const skills = ext.routes.map((r: any) => r.skill);
        expect(skills).toContain("nereus-game:compliance");
        const md = fs.readFileSync("plugins/nereus-game/skills/compliance/SKILL.md", "utf8");
        expect(md).toContain("compliance-check.mjs");
      });
      it("compliance SKILL 이 출처를 밝힌다 — 법적 요건은 근거 없이 적지 않는다", () => {
        const md = fs.readFileSync("plugins/nereus-game/skills/compliance/SKILL.md", "utf8");
        expect(md).toContain("create.roblox.com");
      });
      it("balance 가 확률 아이템을 compliance 로 넘긴다", () => {
        const md = fs.readFileSync("plugins/nereus-game/skills/balance/SKILL.md", "utf8");
        expect(md).toContain("nereus-game:compliance");
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain-liveops.test.ts` · Expected: FAIL
    - [x] `skills/compliance/SKILL.md` 작성. frontmatter `name: compliance`,
      트리거 "확률형 아이템", "뽑기", "루트박스", "가챠", "규정", "심의".
      본문에 계획 JSON 예시, 위반 코드 표, 사용법, **출처 URL 과 확인일**,
      그리고 "장르 프로파일을 받지 않는 이유"를 적는다.
      한국법은 **의무 주체가 미확정**이라는 점을 조사 결과대로 명시하고, 법률 자문 영역임을 적는다.
    - [x] `nereus-extension.json` routes 끝에 추가:
      ```json
      { "skill": "nereus-game:compliance", "why": "확률형 아이템·규정 준수", "re": "확률형|뽑기|가챠|루트\\s?박스|lootbox|랜덤\\s?상자|확률\\s?공개|규정|심의|연령\\s?등급" }
      ```
    - [x] `skills/balance/SKILL.md` 에 포인터 한 줄을 넣는다:
      "경제 설계가 **유료 확률 아이템**(알·펫 뽑기, 상자)을 만들면 `nereus-game:compliance` 로 넘긴다. 확률 공개는 법적 요건이라 밸런스 판단과 분리한다."
    - [x] `lib/compliance-check.mjs` 끝에 실행 진입점을 붙인다.
      `import { readCliInput, runCli } from "./cli-input.mjs";` 를 쓰고,
      stdin 의 `{ plan }` 을 받아 `loadPolicy()` 와 함께 판정해 JSON 을 낸다.
      **`process.exit(0)` 를 부르지 않는다** — 파이프 stdout 이 64KiB 에서 잘린다.
    - [x] 리그 테스트를 `tests/smoke/liveops-rig.test.ts` 에 덧붙인다:
      ```ts
      it("compliance 검사기를 프로세스로 돌려 확률 합 위반을 받는다", () => {
        const plan = { markets: ["KR"], restrictedFallback: "", boxes: [{ name: "egg", paid: true, disclosedBeforePurchase: true, disclosureSurfaces: ["game"], outcomes: [{ item: "a", odds: 50 }, { item: "b", odds: 30 }] }] };
        const out = runNode("plugins/nereus-game/lib/compliance-check.mjs", JSON.stringify({ plan }));
        const codes = JSON.parse(out).violations.map((v: any) => v.code);
        expect(codes).toContain("odds-sum");
        expect(codes).toContain("no-restricted-fallback");
        expect(codes).toContain("disclosure-surface");
      });
      ```
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-domain-liveops.test.ts tests/smoke/liveops-rig.test.ts` · Expected: PASS
    - [x] 역검증: `nereus-extension.json` 에서 `nereus-game:compliance` route 를 임시로 지우고
      Run `npx vitest run tests/smoke/game-domain-liveops.test.ts` · Expected: FAIL. 확인 후 되돌린다.
    - [x] 전체 확인: Run `node plugins/nereus/skills/build/scripts/run-tests.mjs` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game tests && git commit -m "feat(game): compliance 스킬·라우트·실행 진입점을 배선한다"`
  - Done when: route 가 선언되고 SKILL.md 가 출처를 밝히며, 검사기가 자식 프로세스로 돌아 세 위반을 내고, route 를 지우면 테스트가 실패하는 것을 역검증으로 확인했다

## Global Constraints

- 스택: Node.js ESM (`.mjs`), 테스트는 vitest + TypeScript.
- **코어 `plugins/nereus` 를 수정하지 않는다.**
- **`compliance-check` 는 장르 프로파일을 받지 않는다.** 법적 요건을 장르 설정으로 두면
  설정으로 규정을 끌 수 있다.
- 실행 진입점에서 `process.exit(0)` 를 부르지 않는다 — 파이프 stdout 이 64KiB 에서 잘린다.
  `lib/cli-input.mjs` 의 `readCliInput` · `runCli` 를 쓴다.
- 정책 수치는 출처 URL 과 확인일을 함께 남긴다. 남이 정한 값이기 때문이다.
- 모든 새 `export` 는 자기 파일 밖에서 참조되거나 실행 진입점에서 쓰여야 한다.
- 법적 귀속(한국법 의무 주체)은 판정하지 않는다. 조사의 미확인 항목이다.
- 문서를 테스트보다 먼저 쓴다. 테스트를 마지막에 돌려야 evidence 가 FRESH 로 남는다.
