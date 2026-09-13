# tasks — add-marketing-delegation

새 스킬을 만들지 않는다. 이미 있는 것으로 보낸다.

- [x] T1. delegates lib — 설치 판정 + 라우트
  - Files: Add `plugins/nereus/hooks/scripts/lib/delegates.mjs` · Add `tests/lib/delegates.test.ts`
  - Steps:
    - [x] 실패 테스트 7갈래(설치/미설치·경로 탐색·광고 영상·영상 일반·코어 우선·가로채기 금지·상태표)
    - [x] `DELEGATES` 4종. 정규식은 좁게 — 코어 담당어를 가로채지 않는다
    - [x] 없는 것도 상태표에 남긴다. 설치 명령은 만들어내지 않는다
  - Done when: `npx vitest run tests/lib/delegates.test.ts` 초록

- [x] T2. 훅에 배선한다
  - Files: Modify `plugins/nereus/hooks/scripts/skill-router.mjs` · Modify `plugins/nereus/hooks/scripts/session-start.mjs`
  - Steps:
    - [x] 코어 → 확장 → 위임 순으로 합친다
    - [x] **배선 회귀 테스트**를 넣는다 — lib 만 초록이고 훅이 안 부르면 아무 일도 안 일어난다
    - [x] 실제 프롬프트 4종으로 지목 결과를 확인한다
  - Done when: 전체 테스트 초록이고 실측 라우팅이 맞다

- [x] T3. setup 이 감지 표를 보여준다
  - Files: Modify `plugins/nereus/skills/setup/SKILL.md`
  - Steps:
    - [x] `delegates.mjs` 실행 절차와 "설치 명령을 만들어낼 수 없다"는 사실을 적는다
  - Done when: companions 와 다른 종류라는 것이 문서에서 분명하다
