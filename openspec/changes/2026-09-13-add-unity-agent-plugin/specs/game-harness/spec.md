## ADDED Requirements

### Requirement: Unity 공식 플러그인 판정은 미설치와 확인 불가를 구분해야 한다
<!-- id: unity.agentPluginDetect -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/unity-stack.test.ts -->

`detectUnityAgentPlugin` 은 설치 인벤토리와 활성 설정을 읽어 `unity@unity-agent-plugin` 의
상태를 `ready` · `disabled` · `absent` · `unknown` 중 하나로 내야 하며,
위임 가능 여부를 `delegate` 불리언으로 함께 내야 한다.

인벤토리를 읽을 수 없을 때 `absent` 를 돌려주어서는 안 된다.
설치돼 있는데도 위임하지 않게 되고, 그 사실이 어디에도 남지 않는다 —
디스크에 파일이 있느냐가 아니라 **설정의 활성 상태**가 진실이라는 것도 같은 이유다.

#### Scenario: 설치되어 활성
- **WHEN** 인벤토리에 `unity@unity-agent-plugin` 이 있고 설정에서 꺼져 있지 않다
- **THEN** `status` 가 `"ready"` 이고 `delegate` 가 `true` 이며 `version` 을 함께 낸다

#### Scenario: 설치되었으나 비활성
- **WHEN** 설정의 `enabledPlugins` 에서 해당 플러그인이 `false` 다
- **THEN** `status` 가 `"disabled"` 이고 `delegate` 가 `false` 다

#### Scenario: 미설치
- **WHEN** 인벤토리에 해당 플러그인이 없다
- **THEN** `status` 가 `"absent"` 이고 `delegate` 가 `false` 다

#### Scenario: 확인 불가
- **WHEN** 인벤토리 파일을 읽을 수 없다
- **THEN** `status` 가 `"unknown"` 이고 `delegate` 가 `false` 이며 `why` 에 사유가 있다

#### Scenario: 전역 스코프 경고
- **WHEN** 활성 상태이고 설치 스코프가 `user` 다
- **THEN** `advice` 에 `"scope-user"` 가 있다

### Requirement: Unity 엔진 도메인 작업은 공식 플러그인에 위임하고 게이트는 하네스가 쥐어야 한다
<!-- id: unity.delegation -->
<!-- entities: Skill -->
<!-- enforced: tests/smoke/game-domain.test.ts -->

`unity` 스킬은 플러그인이 `ready` 일 때 엔진 API 절차(UI·2D·타일맵·오디오·URP·IAP·현지화)를
Unity 스킬로 넘기고, TDD 게이트 · design 게이트 · review · compliance 판정 · finish 는
넘기지 않는다고 적어야 한다.

엔진 API 절차를 하네스가 들고 있으면 엔진 업데이트마다 낡는다. 반대로 게이트를 넘기면
하네스가 남는 게 없다. **위임 경계는 "남이 바꾸는 값이냐"로 긋는다.**

#### Scenario: 위임 경계가 문서에 있다
- **WHEN** `skills/unity/SKILL.md` 를 읽는다
- **THEN** 위임하는 것과 위임하지 않는 것이 각각 적혀 있고 `detectUnityAgentPlugin` 호출이 있다

### Requirement: 확장은 동반 플러그인을 선언하고 setup 은 상태에 맞는 명령을 내야 한다
<!-- id: ext.companions -->
<!-- entities: Extension, Checker -->
<!-- enforced: tests/lib/companions.test.ts, tests/lib/extensions.test.ts -->

확장의 `nereus-extension.json` 은 `companions` 로 동반 플러그인을 선언할 수 있어야 하고,
`loadExtensions` 는 이를 `routes`·`stacks` 와 같은 방식으로 모아야 한다.
설치 명령은 **선언에서 유도해야** 하며 확장이 명령 문자열을 직접 적어서는 안 된다 —
id 와 명령이 어긋나도 실행 전까지 아무도 모른다.

`/nereus:setup` 은 현재 프로젝트 스택과 관련 있는 동반 플러그인만 보여야 하고,
미설치·설치됨·비활성에 따라 **서로 다른 다음 명령**을 내야 한다.
설치만 안내하고 업데이트를 안 하면 낡은 채로 남는다.

코어가 특정 도메인 플러그인(예: Unity)을 직접 알아서는 안 된다.

#### Scenario: 미설치
- **WHEN** 선언된 동반 플러그인이 인벤토리에 없고 해당 스택 프로젝트다
- **THEN** `marketplace add` 와 `plugin install --scope <scope>` 를 순서대로 낸다

#### Scenario: 이미 설치됨
- **WHEN** 인벤토리에 있고 활성이다
- **THEN** `marketplace update` 와 `plugin update` 를 낸다 — 마켓을 먼저 갱신한다

#### Scenario: 비활성
- **WHEN** 설정에서 꺼져 있다
- **THEN** 설치가 아니라 `plugin enable` 을 낸다

#### Scenario: 관련 없는 프로젝트
- **WHEN** 선언한 스택의 marker 가 현재 프로젝트에 없다
- **THEN** `relevant` 가 `false` 이고 표에 나오지 않는다

#### Scenario: 스택 선언을 못 찾음
- **WHEN** `when.stack` 이 가리키는 스택 선언이 없다
- **THEN** 무관으로 단정하지 않고 사유를 `note` 로 함께 낸다

#### Scenario: 유도할 수 없는 선언
- **WHEN** `id` 나 `marketplace` 가 빠진 companion 이 선언됐다
- **THEN** 버린다
