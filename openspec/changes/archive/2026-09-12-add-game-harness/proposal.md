# add-game-harness

## Why

게임 개발을 이 하네스로 하려면 세 가지가 없다.

1. **스택을 모른다.** `lib/stack.mjs:14` 의 `detectStack` 은 flutter·spring·node 셋만 안다.
   로블록스 프로젝트(`default.project.json` + Luau)는 어디에도 안 걸려 `detectTestRunner` 가 `null` 을 돌려주고,
   `tdd-guard.mjs` 의 TDD 게이트가 **조용히 비활성화**된다. 게이트가 없는 하네스는 하네스가 아니다.
2. **게임 도메인이 없다.** 레벨 디자인·내러티브·에셋 파이프라인·플레이테스트는 기존 10개 에이전트 어디에도 없다.
3. **넣을 자리가 없다.** 역스펙 결과(`openspec/specs/plugin-packaging/spec.md`) — `router.mjs` 의 `ROUTES` 는
   `Object.freeze` 된 하드코딩 배열이고 외부에서 항목을 읽는 경로가 **존재하지 않는다**.
   형제 플러그인이 스킬을 추가해도 프롬프트 라우팅에도 SessionStart 스킬맵에도 나타나지 않는다.

게임 도메인을 `nereus` 본체에 합치면 스킬 23 + 에이전트 10 이 두 배가 되고, 웹·앱 작업 중에도 게임 스킬이
라우팅 후보로 섞인다(`MAX_HITS = 2` 라 경쟁이 실제로 일어난다). 완료의 정의도 다르다 — Nereus 의 단위는
"기능"이고 finish 는 커밋·아카이브인데, 게임은 "빌드 → 플레이테스트 → 튜닝"이고 finish 는 롤아웃·지표다.

## What Changes

**본체(`plugins/nereus`)는 확장점 두 개만 연다. 게임 지식은 한 줄도 넣지 않는다.**

- `lib/extensions.mjs` 신설 — 설치된 형제 플러그인에서 `nereus-extension.json` 을 모은다.
  발견은 기존 `lib/plugin-inventory.mjs` 의 `enabledPlugins` + `installPath` 경로를 재사용한다.
- `lib/router.mjs` — `ROUTES` 에 확장 routes 를 병합한다. 코어 라우트가 항상 앞이다.
- `lib/stack.mjs` — `detectStack` / `detectTestRunner` 가 확장 stacks 를 병합한다. 코어 스택이 항상 앞이다.

**새 플러그인 `plugins/nereus-game`** (마켓플레이스 세 번째 항목)

- 로블록스 어댑터: 스택 탐지(`default.project.json` → rojo), 테스트 러너 2단
  (lune = 로컬 단위테스트 / Open Cloud Luau Execution = 실런타임 통합테스트), selene·StyLua 훅.
- 확장 선언(`nereus-extension.json`)으로 위 두 확장점에 붙는다.

## Impact

- 영향 스펙: `plugin-packaging`(라우팅 소유권 요구사항 교체), `game-harness`(신규)
- 영향 코드: `plugins/nereus/hooks/scripts/lib/{extensions,router,stack}.mjs`(신규 1 · 수정 2), `plugins/nereus-game/**`(신규),
  `.claude-plugin/marketplace.json`(항목 1 추가)
- 범위 밖: Unity·Switch 어댑터 구현, CCGS 내용 채굴(별도 변경), 밸런싱 시뮬레이터, AltTester 도입
