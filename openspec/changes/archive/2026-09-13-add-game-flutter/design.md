# design — add-game-flutter

## 결정 1: 스택 선언은 코어 것을 쓰고, 여기는 **게임에 필요한 사실**만 모은다

코어 `stack.mjs` 가 이미 `pubspec.yaml` → `flutter`, `flutter_test` → `flutter test` 를 판정한다.
`nereus-extension.json` 의 `stacks` 에 flutter 를 또 넣으면 같은 것을 두 곳이 정하고,
어긋나면 어느 쪽이 진실인지 알 수 없다. **넣지 않는다.**

`unity-stack.mjs` 가 코어의 파일 존재 판정 위에 매니페스트 **내용** 판정을 얹은 것과 같은 층이다.

## 결정 2: 한 번 돌리면 다른 검사기의 입력이 나온다

앞 두 사이클에서 ToonTone 에 검사기를 돌릴 때마다 **플레이버 목록과 계층 경계를
손으로 만들어 넣었다.** 손으로 만드는 입력은 프로젝트마다 다시 만들어야 하고,
틀려도 아무도 모른다 — `countScope` 가 규모를 파일에서 읽는 것과 같은 이유로 산출물에서 읽는다.

```
detectFlutterGame(root) → { runner, flame, flavors, layers, notes }
                                       ↓        ↓
                              parity-check   purity-check
```

## 결정 3: 플레이버는 **어디서** 읽는가

Flutter/Android 의 플레이버는 세 곳에 흔적이 있다:

| 출처 | 신뢰도 | 문제 |
|---|---|---|
| `android/app/src/<flavor>/` | 높음 — 디렉터리가 실재한다 | `main`·`debug`·`profile` 은 플레이버가 아니다 |
| `android/app/build.gradle(.kts)` 의 `productFlavors` | 높음 | 동적 생성이면 이름이 안 적혀 있다 |
| `assets/<flavor>/` | 중간 | 에셋 없는 플레이버가 빠진다 |

**소스 세트 디렉터리를 진실로 삼는다.** ToonTone 은 Gradle 이 그 디렉터리를 스캔해
productFlavor 를 **동적 생성**한다 — build.gradle 을 읽으면 이름이 하나도 안 나온다.
빌드 타입(`main`·`debug`·`profile`)은 데이터로 제외한다. 코드에 박으면 다른 프로젝트에서 틀린다.

플레이버를 못 찾으면 **빈 배열이 아니라 `null`** 을 낸다. 빈 배열을 주면 `parity-check` 가
`applicable: false`(플레이버 없는 프로젝트)로 읽는데, "플레이버가 없다"와
"플레이버를 못 찾았다"는 다른 상태다. `countScope` 의 `matched: null` 과 같은 규율이다.

## 결정 4: Flame 은 있으면 쓰고 없으면 없는 대로 본다

`pubspec.yaml` 에 `flame` 의존이 있으면 Flame 프로젝트다. **없다고 결함이 아니다** —
ToonTone 은 순수 Flutter 이고 그게 맞는 선택이었다. `Ruling: 도구 부재는 결함이 아니라 상태다`.

Flame 유무가 바꾸는 것은 **테스트 도구**다:

| | 순수 Flutter | Flame |
|---|---|---|
| 규칙 테스트 | `flutter test` (순수 Dart) | 같다 — 순수 층은 Flame 도 모른다 |
| 화면/컴포넌트 | `testWidgets` · `matchesGoldenFile` | `flame_test` 의 `testWithFlameGame` · `testGolden` |
| 시간 진행 | `tester.pump(duration)` | `game.update(dt)` |

**순수 층은 어느 쪽에서도 같다.** 그래서 Flame 도입이 계층 경계를 바꾸지 않는다 —
`layers.json` 의 flutter 경계를 그대로 쓴다. 이게 경계를 데이터로 둔 덕을 보는 첫 사례다.

## 결정 5: 버전을 스킬 본문에 박지 않는다

Flame 1.38.2 · `flame_test` 2.3.1 은 **오늘 확인한 값**이고 남이 바꾼다.
`policy.json` 과 같은 규율로, 스킬에는 **확인일과 확인 방법**을 적고 수치는 최소로 둔다.
API 는 Context7 로 그때 확인한다 — 우리가 복사해두면 엔진 업데이트마다 낡는다.

## 파일 배치

```
plugins/nereus-game/
├── lib/flutter-stack.mjs      (신규)
├── skills/flutter/SKILL.md    (신규)
└── nereus-extension.json      (라우트 1개. stacks 는 건드리지 않는다)
```

## 측정 결과 (ToonTone, 2026-09-13)

```
감지 → runner: flutter_test | flame: false | 플레이버: 8 | 경계: 3 | notes: []
purity  → 위반 0
parity  → applicable true, 위반 0
```

플레이버 8종(art · brand · flag · metro_fr/jp/kr/uk/us)이 자동으로 나왔고,
앞 두 사이클에서 **손으로 만들어 넣던 값과 같다.** 이제 그 손이 빠졌다 —
하네스가 ToonTone 에 정식으로 붙었다.

`notes` 가 비어 있다: `flutter_test` 가 있고, Flame 을 안 쓰므로 `flame_test` 부재도 지적 대상이 아니다.

