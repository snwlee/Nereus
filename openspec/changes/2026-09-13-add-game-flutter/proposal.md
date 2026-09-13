# add-game-flutter

## Why

검증 대상(ToonTone)이 **Flutter 폰게임**인데 하네스에 Flutter 스택 스킬이 없다.
스택 스킬은 `roblox` · `unity` · `switch` 셋뿐이고, 앞 두 사이클에서 검사기를
ToonTone 에 돌릴 때마다 **플레이버 목록과 계층 경계를 손으로 만들어 넣었다.**
그래서 검증은 됐지만 하네스가 그 프로젝트에 **정식으로 붙지는 않은 상태**다.

사용자가 Flame(Flutter 게임 엔진)을 "후보로 넣고 스택 스킬을 만든다"로 승인했다.

## Flame 전용이 아니라 Flutter 전체다

사실 확인(2026-09-13): Flame 1.38.2 (pub, 2026-08-27) · `flame_test` 2.3.1 ·
**MIT** · 10,749★ · 아카이브 아님 · 마지막 푸시 2026-09-10. 살아 있고 라이선스도 깨끗하다.

그런데 **ToonTone 은 Flame 이 아니라 순수 Flutter 다.** Flame 전용으로 좁히면
유일한 검증 대상에 안 붙는다. 그래서 스킬은 `flutter` 로 만들고 Flame 은 그 안의
**선택지**로 둔다. 2D 폰게임 비중이 커지면 Flame 쪽이 두꺼워질 자리를 남긴다.

## 스택을 다시 선언하지 않는다

코어 `plugins/nereus/hooks/scripts/lib/stack.mjs` 가 이미 `pubspec.yaml` → `flutter`,
`flutter_test` → `flutter test` 를 판정한다. `nereus-extension.json` 의 `stacks` 에
flutter 를 또 넣으면 **같은 것을 두 곳이 정한다.**

대신 코어가 못 보는 것을 본다 — `unity-stack.mjs` 가 매니페스트 **내용**까지 읽는 것과 같다.
코어는 파일 존재만 보고, 여기는 게임에 필요한 사실을 모은다.

## What Changes

- `lib/flutter-stack.mjs` — `detectFlutterGame`. 한 번 돌리면 **그 프로젝트에 하네스를
  붙이는 데 필요한 사실**이 전부 나온다: 테스트 러너 · Flame 유무와 버전 · 플레이버 목록 ·
  적용할 계층 경계. 앞 두 사이클에서 손으로 만들던 입력이다.
- `skills/flutter/SKILL.md` — Flutter 게임 절차. 순수 코어 · 위젯/골든 테스트 ·
  플레이버 · Flame(쓸 때와 안 쓸 때) · 폰게임 축.
- 라우트 1개 + 가드 + 프로세스 리그.

## Impact

- 영향 스펙: `game-harness`
- 영향 코드: `plugins/nereus-game/{lib,skills,nereus-extension.json}`
- **코어 `plugins/nereus` 는 바뀌지 않는다.** `stacks` 에 flutter 를 넣지 않는다.
