# add-game-craft

## Why

사용자가 직접 짚었다: **"너무 개발 이외 것들부터 하는 건 김칫국 같다. 게임 자체를 만드는 건 완벽한가?"**

아니다. 실측하면 거기가 제일 얇다.

- 검사기 lib 20개 vs 스택 스킬 `roblox` 81줄 · `unity` 51줄
- 에이전트 5종이 **전부 디자인 쪽**이고 게임플레이 코드를 짜는 주체가 없다
- grep 0건: 코어 루프 설계 · 코드 아키텍처/폴더 구조 · 프로토타입/수직 슬라이스
- `roblox` 와 `unity` 가 똑같이 **"로직을 DataModel/MonoBehaviour 에서 떼어내는 설계가 곧
  1단 커버리지"** 라고 적어놓고 **어떻게 떼는지는 어디에도 없다.** "spec 에서 태스크로 쪼갠다"로
  넘기는데 넘긴 곳에 아무것도 없다.

## 백지에서 쓰지 않는다 — ToonTone 에 이미 있고 기계로 강제되고 있다

앞 사이클에서 하네스를 ToonTone(Flutter 폰게임, 23k줄)에 붙였다. 그 저장소가
**하네스가 비워둔 바로 그 자리를 채워놓고 테스트로 고정하고 있었다.**

`test/architecture_test.dart` — 헌법 원칙 II 를 기계적으로 강제한다:

```
lib/core, lib/content  →  package:flutter/ · dart:ui · dart:io · 플러그인 import 0
lib/core               →  features · shared · design · game import 0
lib/game               →  features · shared · design import 0
```

근거까지 적혀 있다: *"이 경계가 무너지면 게임 규칙을 위젯 없이 테스트할 수 없게 되고,
규칙 변경이 느리고 불안정한 통합 테스트를 통과해야만 하게 된다."*

이것이 `roblox`·`unity` 가 말만 하고 비워둔 **"어떻게 떼는가"** 의 답이다. 그리고
**엔진 불가지론으로 일반화된다** — 금지 대상이 Dart 면 `package:flutter/`, Luau 면
`game.`·`:GetService`, C# 이면 `UnityEngine` 일 뿐 구조는 같다.
`Ruling: CCGS 는 포크하지 않고 채굴한다` 와 같은 방식으로 채굴한다.

## 다작론의 핵심 규율이 하네스에 없다

ToonTone 헌법 원칙 VI (Flavor Parity):

> Dart source MUST be identical across every flavor. 어떤 형태든
> `if flavor == X` 분기는 위반이다. 다른 동작은 **설정으로 올려야** 한다.
>
> *"The business model is app volume. The moment flavors diverge in code,
> the marginal cost of a new app stops being near zero and the model collapses."*

`track` 스킬은 다작/깊게를 **추천**만 한다. 다작을 **가능하게 하는 코드 규율**은 어디에도 없다.
다작은 "게임을 여러 개 만든다"가 아니라 **"한 코드베이스의 한계 비용을 0 에 붙여둔다"** 이고,
그걸 무너뜨리는 것이 코드 분기다. 추천만 하고 규율이 없으면 다작 트랙은 선언으로만 남는다.

ToonTone 자신도 이건 **기계로 강제하지 않는다** — 헌법에 MUST NOT 이라 적혀 있고 실제로
분기가 0건이지만, 검사하는 테스트가 없다. 규율이 사람의 주의력에 걸려 있다.

## What Changes

- `lib/purity-check.mjs` — 계층 경계 검사기. 어느 계층이 무엇을 import 하면 안 되는지를
  받아 위반을 낸다. **엔진 고유 지식은 코드가 아니라 `layers.json` 에 둔다.**
- `layers.json` — 엔진별 기본 경계(flutter · roblox · unity). 데이터라서 스택이 늘어도 lib 을 안 고친다.
- `lib/parity-check.mjs` — 플레이버 패리티 검사기. 소스에서 플레이버 분기를 찾는다.
  **다작 트랙에서만 게이트다** — 깊게 트랙에는 플레이버가 없으므로 해당 없음으로 빠진다.
- `skills/craft/SKILL.md` — 제작 층. 코어 루프 · 계층 경계 · 수직 슬라이스 · 서버 권위.
- `agents/gameplay-engineer.md` — 게임플레이 코드를 짜는 주체. 지금은 없다.
- 라우트 2개 + 프로세스 수준 리그 테스트.

## Impact

- 영향 스펙: `game-harness`
- 영향 코드: `plugins/nereus-game/{lib,skills,agents,layers.json,nereus-extension.json}`
- **코어 `plugins/nereus` 는 바뀌지 않는다.**
- flutter/Flame 스택 스킬은 **다음 사이클**이다. 이번 두 검사기는 엔진 불가지론이라
  스택 스킬 없이도 ToonTone 에 바로 돌릴 수 있고, 그걸로 검증한다.
