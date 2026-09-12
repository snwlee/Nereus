# game-harness (델타)

## ADDED Requirements

### Requirement: 장르는 데이터 프로파일로 다뤄야 한다
<!-- id: profiles.load -->
<!-- entities: Profile, Skill -->
<!-- enforced: plugins/nereus-game/lib/profiles.mjs -->

시스템은 장르별 동작을 스킬 분기가 아니라 `profiles/<genre>.json` 데이터로 다뤄야 한다.
프로파일은 `genre`, `loop`(핵심 루프 단계), `metrics`(관측 지표), `balance`(시뮬레이터 입력 기본값)를 가진다.
알 수 없는 장르 이름을 요청하면 기본값으로 떨어지지 않고 거부해야 한다 — 조용히 다른 장르로 밸런싱하면
수치가 그럴듯한 채로 틀린다.

#### Scenario: 알려진 장르
- **WHEN** `sim-tycoon` 프로파일을 요청한다
- **THEN** `genre`·`loop`·`metrics`·`balance` 를 가진 객체를 돌려준다

#### Scenario: 알 수 없는 장르
- **WHEN** 프로파일에 없는 장르 이름을 요청한다
- **THEN** 에러를 던지고 기본 프로파일을 돌려주지 않는다

#### Scenario: 깨진 프로파일
- **WHEN** 프로파일 JSON 에 `loop` 가 없다
- **THEN** 검증 실패로 거부한다

### Requirement: 밸런싱은 결정론적 시뮬레이터로 수치를 내야 한다
<!-- id: balanceSim.run -->
<!-- entities: Profile, Economy -->
<!-- enforced: plugins/nereus-game/lib/balance-sim.mjs -->

시스템은 경제 정의(수입원·비용·성장 계수)와 장르 프로파일을 입력받아 N턴을 돌리고,
턴별 보유 자원과 **인플레율 · 병목 단계 · 이탈 예상 구간**을 수치로 돌려주어야 한다.
같은 입력에 같은 출력이어야 한다(난수를 쓰면 시드를 입력으로 받는다) — 그래야 게이트로 쓸 수 있다.

#### Scenario: 같은 입력은 같은 출력
- **WHEN** 동일한 경제 정의와 시드로 두 번 돌린다
- **THEN** 두 결과가 완전히 같다

#### Scenario: 병목 탐지
- **WHEN** 어떤 단계의 비용이 그 시점 수입으로 도달 불가능하다
- **THEN** 그 단계를 병목으로 보고한다

#### Scenario: 인플레 탐지
- **WHEN** 턴당 수입 증가율이 비용 증가율을 지속적으로 앞지른다
- **THEN** 인플레율을 양수로 보고한다

### Requirement: 도메인 스킬은 엔진 고유 문법을 담지 않아야 한다
<!-- id: domainSkills.engineAgnostic -->
<!-- entities: Skill -->
<!-- enforced: tests/smoke/game-domain.test.ts -->

`level` · `narrative` · `gameux` · `asset` · `balance` 스킬 본문은 특정 엔진의 문법·API 를 담지 않아야 한다.
엔진 의존은 어댑터(`lib/*-stack.mjs`)와 엔진 스킬(`roblox` 등)이 흡수한다.
메인 플랫폼이 없고 로블록스와 2D 폰게임을 동시에 대응해야 하므로, 도메인 지식이 엔진에 묶이면 두 벌이 된다.

#### Scenario: 도메인 스킬 본문
- **WHEN** 도메인 스킬 5종의 SKILL.md 를 검사한다
- **THEN** Luau·C# 고유 토큰(`game.Players`, `MonoBehaviour`, `UnityEngine`, `:GetService`)이 없다

### Requirement: 선언한 자산은 실재해야 한다
<!-- id: declarations.exist -->
<!-- entities: Plugin, Skill, Profile -->
<!-- enforced: tests/smoke/game-domain.test.ts -->

확장이 선언한 라우트의 스킬, 스킬이 참조하는 프로파일, 플러그인이 선언한 에이전트는 모두 파일로 실재해야 한다.
1차에서 "선언했는데 실재하지 않음" 결함이 세 번 났다(미배선 확장점 · 존재하지 않는 계약을 가정한 픽스처 ·
없는 스킬을 가리키는 라우트). 단위 테스트는 셋 다 초록이었다.

#### Scenario: 라우트가 가리키는 스킬
- **WHEN** `nereus-extension.json` 의 모든 route 를 검사한다
- **THEN** 각 `skill` 에 대응하는 `skills/<name>/SKILL.md` 가 존재한다

#### Scenario: 프로파일 참조
- **WHEN** 프로파일 디렉터리의 모든 JSON 을 로드한다
- **THEN** 전부 검증을 통과한다

### Requirement: Unity 스택을 인식하고 러너를 판정해야 한다
<!-- id: unityStack.detect -->
<!-- entities: Project, Stack, TestRunner -->
<!-- enforced: plugins/nereus-game/lib/unity-stack.mjs -->

시스템은 `ProjectSettings/ProjectVersion.txt` 가 있으면 Unity 프로젝트로 인식하고,
`Packages/manifest.json` 에 테스트 프레임워크가 선언돼 있으면 batchmode 러너를 돌려주어야 한다.
없으면 `null` 을 돌려 TDD 게이트를 켜지 않는다. 코어는 수정하지 않고 1차의 확장점을 쓴다.

#### Scenario: 테스트 프레임워크가 있는 Unity 프로젝트
- **WHEN** `ProjectSettings/ProjectVersion.txt` 와 `com.unity.test-framework` 를 담은 매니페스트가 있다
- **THEN** `runner` 가 `unity-test-framework` 인 결과를 돌려준다

#### Scenario: 테스트 프레임워크 없음
- **WHEN** Unity 프로젝트지만 매니페스트에 테스트 프레임워크가 없다
- **THEN** `null` 을 돌려준다
