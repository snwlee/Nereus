## ADDED Requirements

### Requirement: 계층 경계를 기계적으로 검사할 수 있어야 한다
<!-- id: craft.purity -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/purity-check.test.ts -->

시스템은 계층 선언(`{ layer, forbid, why }`)과 소스를 받아, 각 계층의 파일에
금지 문자열이 나타나면 위반으로 보고해야 한다. 계층 판정은 파일 경로 접두사로 한다.

`roblox` 와 `unity` 스킬이 모두 "로직을 엔진에서 떼어내는 설계가 곧 1단 커버리지"라고
적어놓고 떼는 방법을 비워두었다. 경계는 선언하는 것만으로는 유지되지 않는다 —
당장은 언제나 불편하고 이득은 나중에 오므로 사람의 주의력에 맡기면 무너진다.

#### Scenario: 순수 계층이 엔진을 import 한다
- **WHEN** `core` 계층 파일에 `package:flutter/material.dart` import 가 있다
- **THEN** 위반 코드 `layer-import` 와 파일·줄·금지 문자열이 나온다

#### Scenario: 위반에 이유가 따라온다
- **WHEN** 위반이 하나라도 나온다
- **THEN** 각 위반에 그 계층 선언의 `why` 가 실려 있다

#### Scenario: 이유 없는 경계는 받지 않는다
- **WHEN** `why` 가 없는 계층 선언을 준다
- **THEN** 던진다

#### Scenario: 다른 계층은 검사하지 않는다
- **WHEN** `features` 계층 파일이 `package:flutter/material.dart` 를 import 한다
- **THEN** `core` 선언만 있으면 위반이 없다

#### Scenario: 엔진을 몰라야 한다
- **WHEN** Luau 프로젝트의 선언으로 `game:GetService` 를 금지한다
- **THEN** 같은 검사기가 그 문자열로 위반을 낸다

### Requirement: 계층 경계 기본값은 엔진별 데이터여야 한다
<!-- id: craft.layersAreData -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/purity-check.test.ts -->

엔진별 기본 경계는 `layers.json` 에 데이터로 있어야 하며, 검사기 코드는 계층 이름도
금지 문자열도 알지 않아야 한다. 스택이 늘 때 lib 을 고치게 되면 확장이 코드가 된다.

#### Scenario: 선언된 엔진
- **WHEN** `layers.json` 에서 `flutter` 의 경계를 로드한다
- **THEN** `core` 계층이 있고 `package:flutter/` 를 금지하며 `why` 가 비어 있지 않다

#### Scenario: 알 수 없는 엔진
- **WHEN** `layers.json` 에 없는 엔진의 경계를 요청한다
- **THEN** 기본값으로 떨어지지 않고 던진다

### Requirement: 플레이버 패리티를 검사할 수 있어야 한다
<!-- id: craft.flavorParity -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/parity-check.test.ts -->

시스템은 소스에서 플레이버 식별자로 동작이 갈리는 분기를 찾아 위반으로 보고해야 한다.
다작은 "게임을 여러 개 만든다"가 아니라 한 코드베이스의 한계 비용을 0 에 붙여두는 것이고,
그것을 무너뜨리는 것이 코드 분기다. `track` 스킬은 트랙을 추천만 하고 이 규율이 없었다.

#### Scenario: 플레이버 분기
- **WHEN** 소스에 `if (flavor == "skz")` 가 있다
- **THEN** 위반 코드 `flavor-branch` 와 파일·줄이 나온다

#### Scenario: 식별자를 다루는 것 자체는 위반이 아니다
- **WHEN** 소스에 `final id = config.flavorId;` 가 있다
- **THEN** 위반이 없다

#### Scenario: 식별자 이름은 데이터다
- **WHEN** `identifiers` 로 `["variant"]` 만 준다
- **THEN** `variant == "a"` 는 잡히고 `flavor == "a"` 는 잡히지 않는다

#### Scenario: switch 분기
- **WHEN** 소스에 `switch (flavor) {` 가 있다
- **THEN** 위반으로 보고한다

### Requirement: 패리티 검사는 플레이버가 없으면 해당 없음으로 보고해야 한다
<!-- id: craft.parityNotApplicable -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/parity-check.test.ts -->

`flavors` 가 비어 있으면 위반 없음이 아니라 `applicable: false` 와 이유를 내야 한다.
깊게 트랙에는 플레이버라는 개념이 없다. "검사해서 깨끗함"과 "검사 대상이 아님"은 다른 상태이며,
둘을 같게 보고하면 검사되지 않은 것이 통과로 읽힌다.

#### Scenario: 플레이버 없음
- **WHEN** `flavors` 가 비어 있는 상태로 검사한다
- **THEN** `applicable` 이 `false` 이고 이유가 실려 있으며 위반이 비어 있다

#### Scenario: 플레이버 있음
- **WHEN** `flavors` 에 둘 이상이 있다
- **THEN** `applicable` 이 `true` 다

### Requirement: 제작 층 스킬과 담당 에이전트가 있어야 한다
<!-- id: craft.skillAndAgent -->
<!-- entities: Skill, Agent -->
<!-- enforced: tests/smoke/game-domain.test.ts -->

`craft` 스킬과 `gameplay-engineer` 에이전트가 존재해야 하고, `craft` 스킬 본문은
엔진 고유 토큰을 담지 않아야 한다. 에이전트 5종이 전부 디자인 산출물을 내고
게임플레이 코드를 짜는 주체가 없었다.

#### Scenario: 스킬 실재
- **WHEN** `craft` 라우트를 따라간다
- **THEN** `skills/craft/SKILL.md` 가 존재한다

#### Scenario: 에이전트 실재
- **WHEN** `agents/` 를 본다
- **THEN** `gameplay-engineer.md` 가 존재한다

#### Scenario: 엔진 불가지론
- **WHEN** `craft` 스킬 본문을 검사한다
- **THEN** `MonoBehaviour` · `UnityEngine` · `game.Players` · `:GetService` 가 없다

### Requirement: 새 검사기는 프로세스 진입점으로 돌아야 한다
<!-- id: craft.cliEntry -->
<!-- entities: Checker -->
<!-- enforced: tests/smoke/craft-rig.test.ts -->

`purity-check` 와 `parity-check` 는 stdin 으로 JSON 을 받아 stdout 으로 결과를 내는
프로세스로 동작해야 하며, 깨진 입력에는 스택트레이스 없이 사유만 내고 0 이 아닌 코드로 끝나야 한다.
픽스처 초록으로 4사이클을 보낸 뒤 리그를 만들자마자 치명적 결함이 나왔다.

#### Scenario: purity 진입점
- **WHEN** 계층 위반이 있는 입력을 프로세스로 넣는다
- **THEN** stdout 의 JSON 에 `layer-import` 위반이 있다

#### Scenario: parity 진입점
- **WHEN** 플레이버 분기가 있는 입력을 프로세스로 넣는다
- **THEN** stdout 의 JSON 에 `flavor-branch` 위반이 있다

#### Scenario: 깨진 입력
- **WHEN** JSON 이 아닌 입력을 넣는다
- **THEN** 0 이 아닌 코드로 끝나고 stderr 에 스택트레이스가 없다
