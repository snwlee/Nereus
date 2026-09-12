# game-harness Specification

## Purpose
TBD - created by archiving change add-game-harness. Update Purpose after archive.

## Requirements

### Requirement: 로블록스 프로젝트를 스택으로 인식해야 한다
<!-- id: gameStack.detect -->
<!-- entities: Project, Stack -->
<!-- enforced: plugins/nereus-game/lib/roblox-stack.mjs -->

시스템은 프로젝트 루트에 Rojo 프로젝트 파일(`default.project.json`)이 있으면 스택에 `roblox` 를 포함해야 한다.
`package.json` 이 함께 있어도(roblox-ts 프로젝트) `roblox` 판정이 유지되어야 한다 — 이 경우 두 스택이 모두 잡힌다.

#### Scenario: Rojo 프로젝트
- **WHEN** 루트에 `default.project.json` 이 있다
- **THEN** `detectStack` 결과에 `roblox` 가 들어 있다

#### Scenario: roblox-ts 프로젝트
- **WHEN** 루트에 `default.project.json` 과 `package.json` 이 모두 있다
- **THEN** 결과에 `roblox` 와 `node` 가 모두 들어 있다

#### Scenario: 로블록스가 아닌 프로젝트
- **WHEN** 루트에 `default.project.json` 이 없다
- **THEN** 결과에 `roblox` 가 없다

### Requirement: 로블록스 테스트 러너를 판정해야 한다
<!-- id: gameStack.runner -->
<!-- entities: Project, TestRunner -->
<!-- enforced: plugins/nereus-game/lib/roblox-stack.mjs -->
<!-- invariant: 러너를 찾지 못하면 null 을 돌려 TDD 게이트가 꺼진다. 억지로 명령을 지어내지 않는다 -->

시스템은 로블록스 프로젝트에서 테스트 러너를 이 순서로 판정해야 한다.
`lune` 디렉터리 또는 `lune.yaml` 이 있으면 로컬 러너(`lune run tests`),
없고 `.github/workflows` 에 Luau Execution 워크플로가 있으면 클라우드 러너로 본다.
둘 다 없으면 `null` 을 돌려준다.

#### Scenario: lune 로컬 러너
- **WHEN** 프로젝트에 `lune.yaml` 이 있다
- **THEN** `{ runner: "lune", command: "lune run tests" }` 를 돌려준다

#### Scenario: 러너 없음
- **WHEN** lune 설정도 Luau Execution 워크플로도 없다
- **THEN** `null` 을 돌려주고 TDD 게이트는 꺼진 채로 둔다

### Requirement: Luau 파일 편집 직후 포맷·린트를 돌려야 한다
<!-- id: robloxHook.postEdit -->
<!-- entities: Hook, Project -->
<!-- enforced: plugins/nereus-game/hooks/scripts/luau-check.mjs -->

시스템은 `.luau` 또는 `.lua` 파일을 Write·Edit 한 직후 StyLua 포맷과 selene 린트를 그 파일에 적용해야 한다.
두 도구가 PATH 에 없으면 조용히 건너뛰고 훅을 실패시키지 않는다 — 도구 부재는 코드 결함이 아니다.

#### Scenario: Luau 파일 편집
- **WHEN** `.luau` 파일이 Write 되고 StyLua 와 selene 이 PATH 에 있다
- **THEN** 두 명령이 그 파일 경로로 실행된다

#### Scenario: 도구 미설치
- **WHEN** StyLua 가 PATH 에 없다
- **THEN** 훅은 종료 코드 0 으로 끝나고 편집을 막지 않는다

#### Scenario: Luau 가 아닌 파일
- **WHEN** `.ts` 파일이 Write 된다
- **THEN** 아무 명령도 실행하지 않는다

### Requirement: 게임 플러그인은 nereus 코어를 전제로 한다
<!-- id: gamePlugin.manifest -->
<!-- entities: Plugin -->
<!-- enforced: plugins/nereus-game/.claude-plugin/plugin.json -->

게임 플러그인은 마켓플레이스에 등재되고, 자체 스킬 라우트를 `nereus-extension.json` 으로 선언해야 한다.
코어의 워크플로 스킬(intake·spec·build·review·finish)을 복제하지 않는다 — 게임 도메인 스킬만 제공한다.

#### Scenario: 확장 선언
- **WHEN** 플러그인이 설치·활성화된다
- **THEN** `nereus-extension.json` 의 routes 가 코어 라우터에 병합된다

#### Scenario: 워크플로 중복 금지
- **WHEN** 게임 플러그인의 스킬 목록을 본다
- **THEN** `intake`·`spec`·`build`·`review`·`finish` 와 같은 이름의 스킬이 없다

### Requirement: 로블록스 러너가 코어 TDD 게이트에 연결되어야 한다
<!-- id: gameStack.gate -->
<!-- entities: Project, TestRunner, Hook -->
<!-- enforced: plugins/nereus/hooks/scripts/lib/stack.mjs -->

확장이 선언한 러너는 코어 `detectTestRunner` 가 코어 스택에서 러너를 찾지 못했을 때만 반환되어야 한다.
그래야 로블록스 프로젝트에서 `tdd-guard` 가 러너를 얻어 TDD 게이트가 켜진다.
판정만 하고 연결하지 않으면 게이트는 여전히 꺼진 채다.

#### Scenario: 로블록스 단독 프로젝트
- **WHEN** `default.project.json` 과 `lune.yaml` 이 있고 코어 스택 마커가 없다
- **THEN** `detectTestRunner` 가 확장이 선언한 `{ runner, command }` 를 돌려준다

#### Scenario: 코어 스택과 공존
- **WHEN** `pubspec.yaml` 과 `default.project.json` 이 모두 있다
- **THEN** 코어 러너(flutter_test)가 반환되고 확장 러너는 무시된다

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
