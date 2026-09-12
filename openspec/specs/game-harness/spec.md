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
