# add-switch-nda

## Why

세 가지가 하네스를 실제로 못 쓰게 만든다.

1. **Switch 개발을 이 하네스로 할 수 없다.** Nereus 의 review 스테이지는 코드를 Codex·Gemini 같은
   외부 모델에 보낸다. Nintendo SDK 는 NDA 강도가 가장 센 축이라, Switch 관련 코드가 그 경로를 타면
   위반이다. 경계가 없으면 Switch 어댑터를 만들어도 쓸 수 없다.
   **이것은 Nintendo 승인과 무관하게 지금 만들 수 있다** — 막히는 것은 실기기 검증이지 경계 로직이 아니다.
2. **로블록스 2단 테스트가 문서에만 있다.** `roblox` 스킬이 Open Cloud Luau Execution 을 2단 게이트로
   설명하지만 배선이 없다. DataModel 의존 코드는 여전히 검증되지 않는다.
3. **두 사이클 연속 2차 의견 없이 리뷰를 종결했다.** `review.mjs` 가 "PATH 에 있으면 가용"으로 보기
   때문이다. `agy` 는 무응답 후 exit 0 이고 `ocr delegate` 는 커밋된 diff 를 못 본다. 계획은 초록인데
   실제로는 아무도 리뷰하지 않는다 — 이번 사이클에서 세 번째로 같은 부류의 결함이다.

## What Changes

**NDA 경계 (`plugins/nereus-game`)**

- `lib/nda.mjs` — 경로가 NDA 구역인지 판정하는 **순수 함수**. 훅·리뷰·스캔이 같은 함수를 쓴다.
  기본 구역 `Platform/Switch/**` · `**/NintendoSDK/**` · `**/*.nx.*`, 프로젝트 설정으로 덧붙인다.
- `hooks/scripts/nda-guard.mjs` — PreToolUse. **NDA 경로 + 외부 전송**의 조합만 막는다.
  NDA 파일을 읽거나 고치는 것은 막지 않는다 — 막으면 개발 자체가 안 된다.
- `lib/switch-stack.mjs` · `skills/switch/SKILL.md` — 플랫폼 추상화 강제, Lotcheck 절차.
  Lotcheck 체크리스트 **본문은 저장소에 넣지 않는다**(항목 자체가 NDA). `.nereus/lotcheck/` 에서 읽는다.

**Luau Execution 2단 게이트 (`plugins/nereus-game`)**

- `lib/luau-exec.mjs` — 태스크 생성·폴링·결과 판정. HTTP 는 주입 가능해 **키 없이 테스트한다.**
  태스크 상한 5분·동시 10개를 알고 있고 넘기면 쪼개라고 알린다.

**리뷰어 헬스체크 (`plugins/nereus` 코어)**

- `review.mjs` 가 PATH 존재가 아니라 **짧은 프로브 응답**으로 가용을 판정한다. 무응답은 불가다.
  게임 플러그인 문제가 아니라 하네스 공통 결함이므로 코어가 맞다.

## Impact

- 영향 스펙: `game-harness`(NDA·Switch·Luau Execution), `plugin-packaging`(리뷰어 가용 판정)
- 영향 코드: `plugins/nereus-game/{lib,hooks,skills}/**`(신규),
  `plugins/nereus/skills/review/scripts/review.mjs`(수정)
- 범위 밖: 실기기 검증, Lotcheck 실제 제출, NintendoSDK 고유 빌드 명령(설정에서 읽는다),
  에셋 모델 실행 연결, AltTester
