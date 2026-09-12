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

### Requirement: NDA 구역 판정은 순수 함수여야 한다
<!-- id: nda.isNdaPath -->
<!-- entities: Project, Path -->
<!-- enforced: plugins/nereus-game/lib/nda.mjs -->

시스템은 경로가 NDA 구역인지 판정하는 순수 함수를 제공해야 한다.
기본 구역은 `Platform/Switch/**`, `**/NintendoSDK/**`, `**/*.nx.*` 이며 프로젝트가 덧붙일 수 있다.
훅·리뷰·스캔이 같은 함수를 써야 한다 — 판정이 갈리면 한쪽만 막히고 다른 쪽으로 샌다.

#### Scenario: 기본 구역
- **WHEN** `Platform/Switch/Boot.cs` 를 판정한다
- **THEN** NDA 구역으로 판정한다

#### Scenario: 일반 경로
- **WHEN** `Assets/Game/Player.cs` 를 판정한다
- **THEN** NDA 구역이 아니다

#### Scenario: 윈도우 경로 구분자
- **WHEN** `Platform\\Switch\\Boot.cs` 를 판정한다
- **THEN** NDA 구역으로 판정한다

### Requirement: NDA 내용의 외부 전송만 막아야 한다
<!-- id: ndaGuard.check -->
<!-- entities: Hook, Path -->
<!-- enforced: plugins/nereus-game/hooks/scripts/nda-guard.mjs -->

시스템은 NDA 경로를 **외부로 보내는 명령**만 차단해야 한다.
NDA 파일을 읽거나 수정하는 것은 막지 않는다 — 막으면 그 플랫폼 개발 자체가 불가능해진다.
차단은 기본값이며 설정으로 경고로 낮출 수 있으나, 기본은 차단이다. NDA 는 되돌릴 수 없다.

#### Scenario: NDA 경로를 외부 리뷰어에 넘기는 명령
- **WHEN** Bash 명령이 NDA 경로와 외부 도구 이름을 함께 담고 있다
- **THEN** 차단하고 이유를 알린다

#### Scenario: NDA 파일 편집
- **WHEN** NDA 경로의 파일을 Edit 한다
- **THEN** 막지 않는다

#### Scenario: 일반 코드를 외부 리뷰어에 넘기는 명령
- **WHEN** Bash 명령이 외부 도구를 쓰지만 NDA 경로를 담지 않는다
- **THEN** 막지 않는다

### Requirement: Luau Execution 2단 게이트를 배선해야 한다
<!-- id: luauExec.run -->
<!-- entities: Project, TestRunner -->
<!-- enforced: plugins/nereus-game/lib/luau-exec.mjs -->

시스템은 Open Cloud Luau Execution 태스크를 만들고 완료까지 폴링해 통과·실패를 판정해야 한다.
HTTP 호출은 주입 가능해야 한다 — 테스트가 네트워크나 자격증명에 의존하면 게이트를 검증할 수 없다.
태스크 상한(5분)과 플레이스당 동시 상한(10)을 알고 있어야 하고, 넘기면 쪼개라고 알린다.

#### Scenario: 성공한 태스크
- **WHEN** 폴링 결과가 완료이고 스크립트가 통과를 반환한다
- **THEN** 통과로 판정하고 로그를 함께 돌려준다

#### Scenario: 상한 초과 요청
- **WHEN** 요청한 타임아웃이 5분을 넘는다
- **THEN** 거부하고 태스크를 쪼개라고 알린다

#### Scenario: 자격증명 없음
- **WHEN** API 키가 주어지지 않았다
- **THEN** 네트워크를 호출하지 않고 설정이 없다고 알린다

### Requirement: Switch 스택은 플랫폼 추상화를 전제해야 한다
<!-- id: switchStack.detect -->
<!-- entities: Project, Stack -->
<!-- enforced: plugins/nereus-game/lib/switch-stack.mjs -->

시스템은 NDA 구역 디렉터리가 존재하면 Switch 대상 프로젝트로 인식하고,
빌드 명령을 **설정에서 읽어야** 한다. NintendoSDK 고유 명령은 SDK 문서가 NDA 라 저장소에 담을 수 없다.
설정이 없으면 `null` 을 돌려 게이트를 켜지 않는다.

#### Scenario: NDA 구역이 있는 프로젝트
- **WHEN** `Platform/Switch/` 가 존재한다
- **THEN** Switch 대상으로 인식한다

#### Scenario: 빌드 명령 미설정
- **WHEN** Switch 대상이지만 설정에 빌드 명령이 없다
- **THEN** `null` 을 돌려주고 명령을 지어내지 않는다

### Requirement: 로블록스 2단 테스트를 finish 단계가 호출해야 한다
<!-- id: robloxGate.run -->
<!-- entities: Project, TestRunner -->
<!-- enforced: plugins/nereus-game/lib/roblox-gate.mjs -->

시스템은 로블록스 프로젝트에서 Open Cloud Luau Execution 2단 테스트를 시도해야 한다.
로블록스가 아니면 건너뛴다. **자격증명이 없으면 실패가 아니라 미설정으로 알리고 통과시킨다** —
막으면 키 없는 모든 세션에서 finish 가 불가능해진다.
호출은 주입 가능해야 한다. 게이트 검증이 네트워크에 의존하면 게이트를 검증할 수 없다.

#### Scenario: 로블록스가 아닌 프로젝트
- **WHEN** `default.project.json` 이 없다
- **THEN** `skipped` 로 판정하고 2단을 시도하지 않는다

#### Scenario: 자격증명 없음
- **WHEN** 로블록스 프로젝트이지만 API 키가 없다
- **THEN** 통과로 두고 미설정 사유를 알린다

#### Scenario: 2단 실패
- **WHEN** Luau Execution 이 실패를 돌려준다
- **THEN** 통과가 아니라고 판정하고 로그를 함께 돌려준다

### Requirement: 에셋 파이프라인의 전제 도구를 판정해야 한다
<!-- id: assetDoctor.check -->
<!-- entities: Project -->
<!-- enforced: plugins/nereus-game/lib/asset-doctor.mjs -->

시스템은 에셋 파이프라인 단계별 전제(3D 는 Blender, 2D 는 ComfyUI 엔드포인트, 오디오는 API 키)를
확인해 어느 단계가 왜 막히는지 보고해야 한다. 도구 부재를 실패로 만들지 않는다 —
전제가 없는 것은 결함이 아니라 상태다.

#### Scenario: 전부 없음
- **WHEN** 어떤 전제도 충족되지 않는다
- **THEN** 단계별로 막힌 이유를 담은 보고를 돌려주고 예외를 던지지 않는다

#### Scenario: Blender 있음
- **WHEN** Blender 가 가용하다
- **THEN** 3D 단계가 가용으로 표시된다

### Requirement: 지배 전략을 실패 양상으로 판정해야 한다
<!-- id: balanceSim.dominant -->
<!-- entities: Profile, Economy -->
<!-- enforced: plugins/nereus-game/lib/balance-sim.mjs -->

시스템은 프로파일의 실패 양상이 `dominant-strategy` 일 때, 선택지 중 효율이 다른 것들을
압도하는 것이 있으면 보고해야 한다. 지배 전략이 하나라도 있으면 나머지 선택지는 존재하지 않는 것과 같다.
이는 병목·절벽과 다른 축이므로 별도로 판정한다.

#### Scenario: 한 선택지가 압도
- **WHEN** 어떤 선택지의 효율이 다른 것들의 임계 배수를 넘는다
- **THEN** 그 이름을 지배 전략으로 보고한다

#### Scenario: 균형
- **WHEN** 선택지들의 효율이 임계 안에 있다
- **THEN** 지배 전략 보고가 비어 있다

#### Scenario: 선택지 정보 없음
- **WHEN** 경제 정의에 선택지가 없다
- **THEN** 빈 배열을 돌려주고 오류를 내지 않는다
