# fix-game-real-project

## Why

하네스를 **실제 게임에 처음 붙였다.** 대상은 `/Volumes/SKHY1TB/workspace/ToonTone` —
Dart 137파일 23,020줄, 테스트 80파일, 광고·IAP·리더보드·상점·업적·크로스프로모·
애널리틱스가 전부 들어 있는 살아 있는 Flutter 폰게임이다. 이미 Nereus 를 쓰고 있고,
`CLAUDE.md` 첫 줄이 "하나의 코드베이스로 N개 앱을 낸다" — **다작론이 코드로 구현돼 있다.**

붙이자마자 **하네스 자기 결함 세 건이 실측으로 나왔다.** 셋 다 단위 테스트는 초록이었다.
픽스처가 하네스 자신의 출력 형식으로 쓰여 있었기 때문이다.
`Ruling: 픽스처 초록을 검증으로 치지 않는다` 가 이번에도 맞았다.

### 결함 1 — `countScope` 가 실제 tasks.md 를 0개로 센다 (HIGH)

ToonTone `specs/001-color-recall-game/tasks.md` 에 태스크 **188개**가 있는데 **0개**로 센다.

```
TASK_LINE = /^- \[[ x]\] T\d+\./gm     ← 번호 뒤 마침표를 요구한다
- [x] T001 Flutter 프로젝트를 ...       ← spec-kit 이 실제로 내는 형식. 마침표가 없다
```

`nereus:spec` 은 "greenfield 는 spec-kit, 기존 코드는 OpenSpec" 이라고 선언해놓고
`countScope` 는 **자기 형식만 읽는다.** 결과: 다작 임계 24개를 7.8배 넘는 프로젝트가
근거 0건의 `"many"` 로 추천된다. 에러가 아니라 **조용히 뒤집힌다** —
`Ruling: 근사 판정은 결과에 근사임을 표시한다` 가 막으려던 것과 같은 양상이다.

### 결함 2 — `scanL10n` 이 l10n 생성물을 스캔한다 (HIGH)

`lib/l10n/generated/app_localizations_en.dart` — **l10n 도구가 만든 번역 테이블 자체**를
"하드코딩 문자열"로 잡는다. 정확히 거꾸로다. 생성물·빌드 산출물 제외 개념이 없다.

### 결함 3 — 신호 대 잡음이 게이트로 못 쓸 수준이다 (HIGH)

실측 461건. 분류하면 개발자용 예외 메시지 53건, 위젯 노출 19건, 나머지 389건.
**진짜 결함은 0건이었다** (`share_service` 의 `'$score점'` 은 ToonTone 이 이미
`formatScore` 주입으로 처리하고 테스트로 문서화해둔 의도적 최후 폴백이다).

461:0 이면 사람이 게이트를 끈다. **끄게 만드는 게이트는 게이트가 아니다** —
`unity` 스킬이 TDD 게이트에 대해 이미 같은 논리를 적어놓았다.

## What Changes

- `lib/track-advisor.mjs` — `countScope` 가 spec-kit 형식(`T001 설명`)과
  nereus:spec 형식(`T1. 설명`)을 **둘 다** 센다. 형식을 못 알아보면 0 을 조용히 돌려주지 않고
  **셀 수 없었다는 사실을 결과에 싣는다.**
- `lib/l10n-scan.mjs` — 생성물 경로와 개발자용 메시지를 **제외가 아니라 분류**로 다룬다.
  `violations` 는 사용자 노출만 남기고, 제외된 것은 `skipped` 로 셈과 이유를 같이 낸다.
  조용히 버리면 검사되지 않은 것과 구분되지 않는다.
- 두 결함 모두 **실제 프로젝트 산출물을 픽스처로 쓰는 테스트**를 같이 넣는다.
  하네스 자신의 형식으로 쓴 픽스처가 이 셋을 전부 놓쳤다.

## Impact

- 영향 스펙: `game-harness` (요구사항 3개 추가)
- 영향 코드: `plugins/nereus-game/lib/{track-advisor,l10n-scan}.mjs`
- **코어 `plugins/nereus` 는 바뀌지 않는다.**
- 제작 층 채굴과 flutter 스택 스킬은 **별도 사이클**이다. 이번엔 실측된 결함만 고친다.
