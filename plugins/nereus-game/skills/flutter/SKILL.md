---
name: flutter
description: Flutter 게임 개발 절차 — 순수 코어, 위젯·골든 테스트, 플레이버 다작, Flame(쓸 때와 안 쓸 때), 폰게임 축. 트리거 "플러터", "Flutter", "Dart 게임", "Flame", "플레이버", "폰 게임".
---

# flutter

nereus:common 규칙을 따른다. 워크플로는 **nereus 코어가 소유한다**.
제작 층 판단(코어 루프 · 계층 경계 · 수직 슬라이스 · 서버 권위)은 `nereus-game:craft` 가 하고
여기서 되풀이하지 않는다. 이 스킬은 **Flutter 고유 절차**만 담는다.

## 1. 스택 판정은 코어 것을 쓴다

코어가 이미 `pubspec.yaml` → `flutter`, `dev_dependencies` 의 `flutter_test` → `flutter test`
를 판정한다. **`nereus-extension.json` 의 `stacks` 에 flutter 를 넣지 않는다** —
같은 것을 두 곳이 정하면 어긋날 때 어느 쪽이 진실인지 알 수 없다.

여기는 **게임에 필요한 사실**을 얹는다:

```bash
echo '{"root":"."}' | node "${CLAUDE_PLUGIN_ROOT}/lib/flutter-stack.mjs"
```

`detectFlutterGame` 한 번이면 다른 검사기의 입력이 전부 나온다:

```
detectFlutterGame → { runner, flame, flavors, layers, notes }
                                     ↓        ↓
                            parity-check   purity-check
```

**`flavors` 가 `null` 이면 "없다"가 아니라 "못 찾았다"** 이고 이유가 `notes` 에 실린다.
빈 배열을 넘기면 `parity-check` 가 플레이버 없는 프로젝트로 읽어 검사 대상이 아니라고 판정한다.

## 2. 순수 코어 — Flutter 에서 무엇이 순수인가

`craft` 의 판정 질문을 그대로 쓴다: **위젯 트리와 기기 없이 호출해 결과를 단언할 수 있는가.**

순수 층에 들어오면 안 되는 것: `package:flutter/` · `dart:ui` · `dart:io` ·
플러그인 패키지(저장·광고·Firebase·경로) · 상태 관리 패키지.
`layers.json` 의 flutter 경계가 이것을 데이터로 들고 있고 `purity-check` 가 집행한다.

**`dart:ui` 가 특히 새기 쉽다.** `Color` · `Offset` · `Size` 가 거기 있어서
"이 정도는 값 타입인데" 하고 들이게 된다. 들이는 순간 그 파일은 순수가 아니고,
색·좌표 계산을 위젯 없이 골든으로 고정할 수 없게 된다. 자기 값 타입을 쓰고 표현 층에서 변환한다.

**설정과 규칙을 같은 층에 두지 않는다.** 원격 설정이 규칙 층에 스며들면 플래그 하나가
규칙을 바꾸는 경로가 숨는다. 규칙은 값을 인자로 받고, 어디서 읽는지는 몰라야 한다.

## 3. 테스트 — 층마다 도구가 다르다

| 층 | 도구 | 특징 |
|---|---|---|
| 순수 규칙 | `test` (순수 Dart) | 밀리초. 여기로 최대한 민다 |
| 위젯 | `testWidgets` + `tester.pump(duration)` | 느리다. 상호작용만 남긴다 |
| 시각 | `matchesGoldenFile` | 의도치 않은 변화를 잡는다. 폰트 렌더 차이에 약하다 |
| 흐름 | `integration_test` (+ Patrol) | 가장 느리다. 핵심 흐름만 |

**애니메이션이 있는 위젯에서 `pumpAndSettle` 을 무한 애니메이션에 쓰지 않는다** —
끝나지 않아 타임아웃으로 죽는다. 게임 화면에는 상시 도는 애니메이션이 흔하다.
`pump(duration)` 으로 정확한 프레임만 진행한다.

골든은 **결정론이 전제**다. 시간·난수·기기 픽셀비가 들어가면 CI 에서만 깨진다.
시드를 고정하고 `TestWidgetsFlutterBinding` 의 화면 크기를 명시한다.

## 4. Flame — 쓸 때와 안 쓸 때

Flame 은 Flutter 위의 2D 게임 엔진이다. **없다고 결함이 아니다** — 퀴즈·퍼즐·보드처럼
위젯으로 충분한 장르는 순수 Flutter 가 맞는 선택이고, 엔진을 들이면 층만 하나 는다.

들일 이유는 하나다: **매 프레임 도는 루프와 다수 개체가 필요한가.**
스프라이트가 수십 개 움직이고 충돌을 봐야 하면 위젯 트리로는 안 된다.

| | 순수 Flutter | Flame |
|---|---|---|
| 규칙 테스트 | 순수 Dart | **같다** — 순수 층은 Flame 도 모른다 |
| 화면·컴포넌트 | `testWidgets` | `flame_test` 의 `testWithFlameGame` / `testWithGame<T>` |
| 시간 진행 | `tester.pump(duration)` | `game.update(dt)` |
| 골든 | `matchesGoldenFile` | `testGolden(..., size:, goldenFile:)` |

**Flame 도입이 계층 경계를 바꾸지 않는다.** 순수 층은 어느 쪽에서도 같아서
`layers.json` 의 flutter 경계를 그대로 쓴다.

Flame 골든에는 **텍스트를 넣지 않는다**(공식 테스트 가이드). 렌더가 환경마다 달라 깨진다.

`flame` 을 쓰는데 `flame_test` 가 없으면 `detectFlutterGame` 이 `notes` 로 알린다 —
컴포넌트·골든 테스트를 쓸 수 없는 상태다.

**버전·API 는 여기 박지 않는다.** 남이 정하고 남이 바꾼다.
필요할 때 Context7 로 확인한다(pub.dev 버전 기준). 확인 시점: 2026-09-13 —
Flame MIT · 활발히 유지됨. 라이선스가 바뀔 값이 아니지만 도입 전에 다시 본다.

## 5. 플레이버 다작

한 코드베이스로 N개 앱을 내는 구조다. **Dart 소스는 플레이버 간 동일해야 한다.**
플레이버를 정의하는 것은 설정·콘텐츠·에셋뿐이다.

```bash
# 플레이버 목록은 android/app/src/<flavor>/ 에서 읽는다. 손으로 세지 않는다.
echo '{"root":"."}' | node "${CLAUDE_PLUGIN_ROOT}/lib/flutter-stack.mjs"
```

Gradle 이 소스 세트 디렉터리를 스캔해 productFlavor 를 **동적 생성**하는 구조면
`build.gradle` 에는 이름이 하나도 안 적혀 있다. 그래서 디렉터리를 진실로 삼는다.

분기 검사는 `parity-check` 가 한다 — 자세한 규율은 `craft` 스킬 §5.
**플레이버를 하나 늘리는 데 Dart 를 고쳐야 한다면 그건 설정으로 빠져야 하는 값이다.**

## 6. 2D 폰게임에서 봐야 하는 축

| 축 | 기준 |
|---|---|
| 해상도 | 종횡비 범위를 먼저 정한다. 안전영역 밖에 정보를 두지 않는다 |
| 터치 | 최소 타겟 44dp. 손가락이 누른 지점을 가린다는 것을 전제로 피드백 위치를 잡는다 |
| 발열·배터리 | 프레임 상한을 건다. 60 을 항상 쓰는 것보다 30 고정이 나은 구간이 있다 |
| 파편화 | 최저 사양 기기를 먼저 정하고 거기서 측정한다. 최신 기기에서만 재면 출시 후에 안다 |
| 빌드 크기 | 플레이버별 에셋이 전부 들어가지 않는지 본다. 다작 구조에서 가장 흔한 낭비다 |

빌드·릴리스 게이트는 코어 `nereus:finish` 것을 쓴다. 여기서 새로 만들지 않는다.

## 하지 말 것

- `nereus-extension.json` 의 `stacks` 에 flutter 를 선언하지 않는다. 코어가 이미 판정한다.
- 순수 층에 `dart:ui` 를 들이지 않는다. `Color`·`Offset` 때문에 가장 흔히 샌다.
- 무한 애니메이션에 `pumpAndSettle` 을 쓰지 않는다. 타임아웃으로 죽는다.
- 골든에 시간·난수·기기 의존을 남기지 않는다. CI 에서만 깨진다.
- Flame 골든에 텍스트를 넣지 않는다.
- 위젯으로 충분한 장르에 Flame 을 들이지 않는다. 층만 는다.
- 플레이버를 위해 Dart 를 고치지 않는다. 설정으로 올린다.
- 버전·API 를 이 문서에 박지 않는다. Context7 로 그때 확인한다.
