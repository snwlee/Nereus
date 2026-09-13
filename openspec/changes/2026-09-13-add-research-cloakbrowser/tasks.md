# tasks — add-research-cloakbrowser

- [x] T1. cloakPlan 이 무료 고정을 판정한다
  - Files: Add `plugins/nereus/skills/research/scripts/cloak.mjs` · Add `tests/lib/cloak.test.ts`
  - Steps:
    - [x] 실패 테스트 7갈래(고정 없음·무료 핀·146 이하·Pro·라이선스 키·파싱 불가·명령 유도)
    - [x] `cloakPlan` · `FREE_PIN` · `exportLine` 을 만든다. 핀 값은 한 곳에만 둔다
    - [x] 쓰이지 않는 상수는 export 하지 않는다 — no-unwired-exports 가 막는다
  - Done when: `npx vitest run tests/lib/cloak.test.ts` 초록

- [x] T2. 조사 절차에 "막혔을 때만" 을 적는다
  - Files: Modify `plugins/nereus/skills/research/SKILL.md`
  - Steps:
    - [x] 2.1 절: 고정 명령, 확인 명령, 위반 4종, 안 쓰는 곳(E2E·design·SEO), ToS 판단 주체
  - Done when: 브라우저 MCP 대체가 아니라는 것이 문서에서 분명하다

- [x] T3. setup 이 선택 도구로 안내한다
  - Files: Modify `plugins/nereus/skills/setup/scripts/detect.mjs` · Modify `tests/skills/setup-detect.test.ts`
  - Steps:
    - [x] 실패 테스트: cloakbrowser 행이 선택이고 note 에 핀이 있다
    - [x] TOOLS 에 추가한다. `.mcp.json` 은 건드리지 않는다
  - Done when: 전체 테스트 초록
