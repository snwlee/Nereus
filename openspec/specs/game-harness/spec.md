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

### Requirement: 오디오 예산과 피드백 커버리지를 수치로 판정해야 한다
<!-- id: sound.budget -->
<!-- entities: Profile, SoundPlan -->
<!-- enforced: plugins/nereus-game/lib/sound-budget.mjs -->
<!-- invariant: 프로파일에 sound 기준이 없으면 통과시키지 않고 "기준 없음"으로 보고한다 -->

시스템은 사운드 계획을 장르 프로파일의 `sound` 기준과 대조해 위반 목록을 돌려주어야 한다.
검사 항목은 넷이다: 동시 발음수 상한, 큐당 변형(variant) 최소 개수, 라우드니스 목표 범위,
피드백 SFX 가 없는 플레이어 동작.

#### Scenario: 동시 발음수 초과
- **WHEN** 계획의 `maxConcurrent` 가 프로파일의 `sound.maxConcurrent` 를 넘는다
- **THEN** 위반에 `concurrency` 가 들어 있다

#### Scenario: 변형 부족
- **WHEN** 한 큐의 variants 가 프로파일의 `sound.minVariants` 미만이다
- **THEN** 위반에 그 큐 이름과 함께 `variants` 가 들어 있다

#### Scenario: 피드백 없는 동작
- **WHEN** 계획의 `actions` 중 어떤 큐에도 매핑되지 않은 동작이 있다
- **THEN** 위반에 그 동작 이름과 함께 `no-feedback` 이 들어 있다

#### Scenario: 프로파일에 기준이 없음
- **WHEN** 장르 프로파일에 `sound` 키가 없다
- **THEN** 통과가 아니라 `no-baseline` 을 돌려준다

### Requirement: 라이브옵스 계획의 내적 정합성을 지표 없이도 판정해야 한다
<!-- id: liveops.plan -->
<!-- entities: Profile, LiveopsPlan, Metrics -->
<!-- enforced: plugins/nereus-game/lib/liveops-plan.mjs -->
<!-- invariant: 실측 지표가 없다고 게이트가 꺼지지 않는다. 지표가 필요한 항목만 unmeasured 로 보고한다 -->

시스템은 라이브옵스 계획에서 이벤트 구간 겹침, 경제 싱크/소스 비율, 리텐션 곡선 형태,
이벤트별 롤백 경로 선언을 검사해야 한다. 실측 지표는 선택 인자로 받고,
주어지지 않으면 지표가 필요한 항목만 `unmeasured` 로 남긴다.

#### Scenario: 이벤트 구간 겹침
- **WHEN** 두 이벤트의 `[start, end)` 구간이 겹친다
- **THEN** 위반에 두 이벤트 이름과 함께 `overlap` 이 들어 있다

#### Scenario: 경제가 싱크 없이 소스만 있다
- **WHEN** 선언된 sink 합이 0 이고 source 합이 0 보다 크다
- **THEN** 위반에 `no-sink` 가 들어 있다

#### Scenario: 리텐션 가정이 단조 감소가 아니다
- **WHEN** 선언된 리텐션이 D1 < D7 처럼 뒤로 갈수록 올라간다
- **THEN** 위반에 `retention-shape` 가 들어 있다

#### Scenario: 롤백 경로 없음
- **WHEN** 어떤 이벤트에 `rollback` 선언이 없다
- **THEN** 위반에 그 이벤트 이름과 함께 `no-rollback` 이 들어 있다

#### Scenario: 지표 미주입
- **WHEN** `metrics` 인자가 주어지지 않았다
- **THEN** 결과의 `unmeasured` 에 `retention-actual` 이 들어 있고, 나머지 항목은 정상 판정된다

#### Scenario: 지표 주입
- **WHEN** `metrics` 에 실측 리텐션이 주어지고 가정과의 편차가 프로파일의 허용치를 넘는다
- **THEN** 위반에 `retention-drift` 가 들어 있고 `unmeasured` 는 비어 있다

### Requirement: 현지화 위험을 번역 전에 판정해야 한다
<!-- id: l10n.scan -->
<!-- entities: Locale, StringTable, Source -->
<!-- enforced: plugins/nereus-game/lib/l10n-scan.mjs -->
<!-- invariant: 알 수 없는 로케일은 기본값으로 떨어지지 않고 던진다 -->

시스템은 대상 로케일 집합을 `locales.json` 에서 데이터로 읽고, 소스의 하드코딩 문자열,
로케일별 키 누락, 언어별 확장률을 적용했을 때 `maxWidth` 를 넘길 문자열을 찾아내야 한다.

#### Scenario: 하드코딩 문자열
- **WHEN** 소스에 문자열 테이블을 거치지 않은 사용자 노출 문자열이 있다
- **THEN** 위반에 파일·줄과 함께 `hardcoded` 가 들어 있다

#### Scenario: 로케일 키 누락
- **WHEN** 어떤 로케일의 문자열 테이블에 기준 로케일의 키가 빠져 있다
- **THEN** 위반에 로케일과 키 이름과 함께 `missing-key` 가 들어 있다

#### Scenario: 확장률로 폭 초과
- **WHEN** 기준 문자열 길이에 그 로케일의 확장률을 곱한 값이 `maxWidth` 를 넘는다
- **THEN** 위반에 로케일·키와 함께 `overflow` 가 들어 있다

#### Scenario: 알 수 없는 로케일
- **WHEN** `locales.json` 에 없는 로케일을 대상으로 지정한다
- **THEN** 기본값으로 떨어지지 않고 예외를 던진다

### Requirement: 새 도메인 스킬이 라우터에 실제로 배선되어야 한다
<!-- id: liveops.routes -->
<!-- entities: Plugin, Route -->
<!-- enforced: plugins/nereus-game/nereus-extension.json -->

`sound` · `liveops` · `localization` 세 스킬은 `nereus-extension.json` 의 routes 에 선언되고,
선언된 각 route 의 `skill` 에 대응하는 `SKILL.md` 가 실재해야 한다.

#### Scenario: 라우트와 스킬의 실재 대응
- **WHEN** routes 를 훑는다
- **THEN** 모든 route 의 skill 에 대응하는 `skills/<name>/SKILL.md` 가 존재한다

#### Scenario: 프로세스 수준 확인
- **WHEN** 실제 형태의 설치 기록으로 코어 라우터를 자식 프로세스로 돌린다
- **THEN** 세 스킬이 라우팅 후보에 나타난다

### Requirement: 임팩트 예산을 수치로 판정해야 한다
<!-- id: impact.budget -->
<!-- entities: Profile, ImpactPlan -->
<!-- enforced: plugins/nereus-game/lib/impact-budget.mjs -->
<!-- invariant: 프로파일에 impact 기준이 없으면 통과시키지 않고 no-baseline 으로 보고한다 -->

시스템은 임팩트 계획을 장르 프로파일의 `impact` 기준과 대조해 위반 목록을 돌려주어야 한다.
히트스톱은 개별 길이가 아니라 **초당 누적 정지 시간**으로, 스크린셰이크는 **동시 활성 진폭의 합**으로
판정한다. 파티클 동시 수, 입력 버퍼 하한, 피드백 층 수, 모션 감소 대체 선언도 함께 본다.

#### Scenario: 히트스톱 누적 초과
- **WHEN** 큐들의 `hitstopMs × hitsPerSecond` 합이 프로파일의 `maxFrozenMsPerSec` 를 넘는다
- **THEN** 위반에 `hitstop-budget` 이 들어 있다

#### Scenario: 개별 히트스톱은 짧지만 합이 넘는다
- **WHEN** 각 큐의 히트스톱이 상한 미만이지만 합이 `maxFrozenMsPerSec` 를 넘는다
- **THEN** 위반에 `hitstop-budget` 이 들어 있다

#### Scenario: 동시 셰이크 진폭 합 초과
- **WHEN** 동시에 활성될 수 있는 셰이크의 진폭 합이 프로파일의 `maxShakeAmplitude` 를 넘는다
- **THEN** 위반에 `shake-amplitude` 가 들어 있다

#### Scenario: 파티클 동시 수 초과
- **WHEN** 계획의 `maxParticles` 가 프로파일의 `maxParticles` 를 넘는다
- **THEN** 위반에 `particle-budget` 이 들어 있다

#### Scenario: 피드백 층이 하나뿐
- **WHEN** 어떤 큐가 시각·청각·촉각 중 한 층만 갖는다
- **THEN** 위반에 그 큐 이름과 함께 `single-channel` 이 들어 있다

#### Scenario: 모션 감소 대체 미선언
- **WHEN** 셰이크를 쓰는 큐에 `reducedMotion` 대체 선언이 없다
- **THEN** 위반에 그 큐 이름과 함께 `no-reduced-motion` 이 들어 있다

#### Scenario: 입력 버퍼가 하한 미만
- **WHEN** 계획의 `inputBufferMs` 가 프로파일의 `minInputBufferMs` 미만이다
- **THEN** 위반에 `input-buffer` 가 들어 있다

#### Scenario: 프로파일에 기준이 없음
- **WHEN** 장르 프로파일에 `impact` 키가 없다
- **THEN** 통과가 아니라 `no-baseline` 을 돌려준다

### Requirement: 임팩트 큐는 사운드 큐를 참조해야 한다
<!-- id: impact.avSync -->
<!-- entities: ImpactPlan, SoundPlan -->
<!-- enforced: plugins/nereus-game/lib/impact-budget.mjs -->
<!-- invariant: 사운드 큐 목록이 없다고 검사가 통째로 꺼지지 않는다. 그 항목만 unmeasured 로 남긴다 -->

시스템은 임팩트 큐가 참조하는 사운드 큐 이름이 실제 사운드 계획에 있는지 교차 검증해야 한다.
사운드 큐 목록이 주어지지 않으면 그 항목만 `unmeasured` 로 남기고 나머지는 그대로 판정한다.

#### Scenario: 없는 사운드 큐를 참조
- **WHEN** 임팩트 큐의 `sound` 가 주어진 사운드 큐 목록에 없다
- **THEN** 위반에 그 큐 이름과 함께 `sound-missing` 이 들어 있다

#### Scenario: 소리 없는 이펙트
- **WHEN** 임팩트 큐에 `sound` 선언 자체가 없다
- **THEN** 위반에 그 큐 이름과 함께 `sound-missing` 이 들어 있다

#### Scenario: 사운드 계획 미주입
- **WHEN** `soundCues` 인자가 주어지지 않았다
- **THEN** 결과의 `unmeasured` 에 `sound-cross-check` 가 들어 있고, 예산 항목은 정상 판정된다

#### Scenario: 교차 검증 통과
- **WHEN** 모든 임팩트 큐의 `sound` 가 사운드 큐 목록 안에 있다
- **THEN** `sound-missing` 위반이 없고 `unmeasured` 는 비어 있다

### Requirement: 폰트를 라이선스·글리프·용량·가독성으로 판정해야 한다
<!-- id: font.check -->
<!-- entities: Font, Locale, Profile -->
<!-- enforced: plugins/nereus-game/lib/font-check.mjs -->
<!-- invariant: 게임 임베딩 허용을 선언하지 않은 폰트는 통과시키지 않는다 -->

시스템은 선언된 폰트 목록을 대상 로케일과 대조해 위반 목록을 돌려주어야 한다.
검사 항목은 다섯이다: 게임 임베딩 라이선스, 로케일이 요구하는 스크립트 커버리지,
유저 생성 텍스트가 있을 때의 서브셋 금지, 파일 크기 예산, 최소 표시 크기.

#### Scenario: 임베딩이 허용되지 않은 폰트
- **WHEN** 폰트의 `embedding` 이 `"game"` 을 포함하지 않는다
- **THEN** 위반에 그 폰트 이름과 함께 `license-embedding` 이 들어 있다

#### Scenario: 임베딩 선언 자체가 없음
- **WHEN** 폰트에 `embedding` 선언이 없다
- **THEN** 위반에 `license-embedding` 이 들어 있다

#### Scenario: 로케일 스크립트 미커버
- **WHEN** 대상 로케일이 요구하는 `script` 를 어떤 폰트도 `scripts` 에 선언하지 않았다
- **THEN** 위반에 그 로케일과 함께 `script-uncovered` 가 들어 있다

#### Scenario: 유저 생성 텍스트가 있는데 서브셋
- **WHEN** `userGeneratedText` 가 참인데 어떤 폰트의 `subset` 이 참이다
- **THEN** 위반에 그 폰트 이름과 함께 `subset-unsafe` 가 들어 있다

#### Scenario: 폰트 용량 초과
- **WHEN** 폰트 파일 크기 합이 프로파일의 `typography.maxFontKb` 를 넘는다
- **THEN** 위반에 `font-size-budget` 이 들어 있다

#### Scenario: 최소 표시 크기 미만
- **WHEN** 폰트의 `minSizePx` 가 프로파일의 `typography.minSizePx` 미만이다
- **THEN** 위반에 그 폰트 이름과 함께 `min-size` 가 들어 있다

#### Scenario: 프로파일에 기준이 없음
- **WHEN** 장르 프로파일에 `typography` 키가 없다
- **THEN** 예산·크기 항목을 판정하지 않고 `unmeasured` 에 `typography-baseline` 이 들어 있다

### Requirement: 문자열 폭 판정은 근사 여부를 표시해야 한다
<!-- id: l10n.approxWidth -->
<!-- entities: Locale, Font, StringTable -->
<!-- enforced: plugins/nereus-game/lib/l10n-scan.mjs -->
<!-- invariant: 폰트 메트릭 없이 낸 폭 판정은 approx 로 표시한다. 조용한 근사는 틀린 확신을 만든다 -->

시스템은 폰트 메트릭이 주어지면 그것으로 문자열 폭을 계산하고, 주어지지 않으면
언어 확장률로 근사하되 그 위반에 근사임을 표시해야 한다. 기존 반환 형태는 유지한다.

#### Scenario: 폰트 메트릭 없이 폭 판정
- **WHEN** `fonts` 인자 없이 `maxWidth` 를 넘는 문자열을 검사한다
- **THEN** `overflow` 위반이 나오고 그 위반의 `approx` 가 참이다

#### Scenario: 폰트 메트릭으로 폭 판정
- **WHEN** 그 로케일의 폰트 `avgCharWidth` 가 주어진다
- **THEN** `overflow` 판정에 그 값이 쓰이고 위반의 `approx` 가 거짓이다

#### Scenario: 기존 반환 형태 유지
- **WHEN** `fonts` 를 주지 않고 기존처럼 호출한다
- **THEN** `violations` 배열이 기존과 같은 코드 집합으로 나온다

### Requirement: 유료 확률 아이템의 확률 공개를 판정해야 한다
<!-- id: compliance.paidRandom -->
<!-- entities: Policy, RandomBox, Market -->
<!-- enforced: plugins/nereus-game/lib/compliance-check.mjs -->
<!-- invariant: 이 검사기는 장르 프로파일을 받지 않는다. 법적 요건을 장르 설정으로 두면 설정으로 끌 수 있다 -->

시스템은 유료 확률 아이템의 결과 선언, 확률 합, 구매 전 공개, 시장별 공개 표면을 판정해야 한다.
돈을 쓰지 않고 얻는 랜덤 보상은 검사 대상이 아니다.

#### Scenario: 확률 합이 100이 아님
- **WHEN** 유료 상자 결과들의 확률 합이 100 이 아니고 반올림 면책 문구도 없다
- **THEN** 위반에 그 상자 이름과 함께 `odds-sum` 이 들어 있다

#### Scenario: 부동소수점 오차는 위반이 아니다
- **WHEN** 확률이 `33.33 · 33.33 · 33.34` 처럼 더해서 100 이 되지만 부동소수점 오차가 난다
- **THEN** `odds-sum` 위반이 없다

#### Scenario: 소수 4자리 이상 + 면책 문구
- **WHEN** 확률에 소수 4자리 이상이 쓰이고 합이 정확히 100 이 아니지만 면책 문구가 선언됐다
- **THEN** `odds-sum` 위반이 없다

#### Scenario: 결과 미선언
- **WHEN** 유료 상자에 결과 목록이 비어 있다
- **THEN** 위반에 `no-outcomes` 가 들어 있다

#### Scenario: 구매 전 공개 아님
- **WHEN** 유료 상자의 구매 전 공개 선언이 없다
- **THEN** 위반에 `odds-undisclosed` 가 들어 있다

#### Scenario: 한국 시장의 공개 표면 부족
- **WHEN** 대상 시장에 `KR` 이 있는데 공개 표면에 광고가 빠져 있다
- **THEN** 위반에 그 상자와 함께 `disclosure-surface` 가 들어 있다

#### Scenario: 무료 랜덤은 검사하지 않는다
- **WHEN** 상자가 유료가 아니고 확률도 결과도 선언되지 않았다
- **THEN** 그 상자에 대한 위반이 없다

### Requirement: 확률 변동 요소와 금지 지역 대체 경로를 판정해야 한다
<!-- id: compliance.oddsModifiers -->
<!-- entities: Policy, RandomBox, LuckItem -->
<!-- enforced: plugins/nereus-game/lib/compliance-check.mjs -->
<!-- invariant: 유료 확률 아이템이 하나라도 있으면 금지 지역 대체 경로 선언이 필요하다 -->

시스템은 확률을 바꾸는 아이템의 수치 설명과 동적 갱신 선언, 1회성 결과의 남은 확률 갱신,
그리고 `ArePaidRandomItemsRestricted` 대체 경로 선언을 판정해야 한다.

#### Scenario: 럭 아이템의 영향이 수치로 설명되지 않음
- **WHEN** 확률을 올리는 아이템에 수치 설명이 없다
- **THEN** 위반에 그 아이템 이름과 함께 `luck-effect-unexplained` 가 들어 있다

#### Scenario: 럭 아이템의 동적 갱신 미선언
- **WHEN** 확률을 올리는 아이템에 활성 중 동적 갱신 선언이 없다
- **THEN** 위반에 그 아이템 이름과 함께 `luck-no-dynamic-update` 가 들어 있다

#### Scenario: 럭 아이템이 없는 상자를 가리킴
- **WHEN** 확률을 올리는 아이템이 선언되지 않은 상자를 대상으로 삼는다
- **THEN** 위반에 그 아이템 이름과 함께 `luck-target-missing` 이 들어 있다

#### Scenario: 1회성 결과의 남은 확률 갱신 미선언
- **WHEN** 상자에 1회만 얻을 수 있는 결과가 있는데 남은 확률 갱신 선언이 없다
- **THEN** 위반에 그 상자와 함께 `unique-no-remaining-odds` 가 들어 있다

#### Scenario: 금지 지역 대체 경로 없음
- **WHEN** 유료 확률 아이템이 있는데 제한 지역 대체 경로가 선언되지 않았다
- **THEN** 위반에 `no-restricted-fallback` 이 들어 있다

#### Scenario: 유료 확률 아이템이 없으면 대체 경로도 필요 없다
- **WHEN** 유료 확률 아이템이 하나도 없다
- **THEN** `no-restricted-fallback` 위반이 없다

### Requirement: 범위와 모델을 보고 트랙을 추천해야 한다
<!-- id: track.recommend -->
<!-- entities: Tracks, Scope, RevenueModel -->
<!-- enforced: plugins/nereus-game/lib/track-advisor.mjs -->
<!-- invariant: 추천은 게이트가 아니다. 근거를 내고 판단은 사용자가 한다 -->

시스템은 산출물에서 읽은 규모와 선언받은 모델을 받아 `many` 또는 `deep` 을 추천하고
그 근거를 함께 돌려주어야 한다. 깊게를 강제하는 조건이 하나라도 걸리면 `deep` 이고,
아무것도 걸리지 않을 때만 규모로 판정한다.

#### Scenario: 로블록스는 깊게가 강제된다
- **WHEN** 플랫폼이 로블록스다
- **THEN** 추천이 `deep` 이고 근거에 `platform-roblox` 가 들어 있다

#### Scenario: IAP 수익 모델은 깊게가 강제된다
- **WHEN** 수익 모델이 IAP 다
- **THEN** 추천이 `deep` 이고 근거에 `revenue-iap` 가 들어 있다

#### Scenario: 라이브 이벤트 계획은 깊게가 강제된다
- **WHEN** 라이브 이벤트 계획이 있다
- **THEN** 추천이 `deep` 이고 근거에 `live-events` 가 들어 있다

#### Scenario: 상태 유지 멀티플레이어는 깊게가 강제된다
- **WHEN** 상태를 유지하는 멀티플레이어다
- **THEN** 추천이 `deep` 이고 근거에 `persistent-multiplayer` 가 들어 있다

#### Scenario: 강제 조건이 없고 규모가 작으면 다작이다
- **WHEN** 강제 조건이 하나도 없고 태스크 수가 임계 이하다
- **THEN** 추천이 `many` 다

#### Scenario: 강제 조건이 없어도 규모가 크면 다작이 아니다
- **WHEN** 강제 조건이 없지만 태스크 수가 임계를 넘는다
- **THEN** 추천이 `deep` 이고 근거에 `scope-exceeds-many` 가 들어 있다

#### Scenario: 규모 판정이 추정임을 표시한다
- **WHEN** 규모로 판정한 근거가 결과에 들어간다
- **THEN** 그 근거에 추정 표시가 붙어 있다

#### Scenario: 알 수 없는 플랫폼은 던진다
- **WHEN** `tracks.json` 에 없는 플랫폼을 준다
- **THEN** 기본값으로 떨어지지 않고 예외를 던진다

#### Scenario: 알 수 없는 수익 모델은 던진다
- **WHEN** `tracks.json` 에 없는 수익 모델을 준다
- **THEN** 기본값으로 떨어지지 않고 예외를 던진다

### Requirement: 모델과 범위의 불일치를 추천과 독립적으로 보고해야 한다
<!-- id: track.mismatch -->
<!-- entities: Tracks, Scope, RevenueModel -->
<!-- enforced: plugins/nereus-game/lib/track-advisor.mjs -->
<!-- invariant: 불일치는 추천과 독립이다. deep 추천이어도 모순은 모순이다 -->

시스템은 수익 모델과 운영 계획이 서로 모순되는 상태, 그리고 규모가 트랙과 어긋나는 상태를
추천과 별도로 보고해야 한다.

#### Scenario: 유료 단품인데 라이브 이벤트가 있다
- **WHEN** 수익 모델이 유료 단품인데 라이브 이벤트 계획이 있다
- **THEN** 불일치에 `premium-with-live-events` 가 들어 있다

#### Scenario: 모순은 deep 추천에서도 보고된다
- **WHEN** 위와 같은 상태이고 추천이 `deep` 으로 나온다
- **THEN** 추천과 무관하게 불일치가 그대로 보고된다

#### Scenario: 규모 초과는 불일치로도 보고된다
- **WHEN** 강제 조건이 없는데 태스크 수가 다작 임계를 넘는다
- **THEN** 불일치에 `scope-over-budget` 이 들어 있고 임계값과 실제값이 함께 나온다

#### Scenario: 정합하면 불일치가 없다
- **WHEN** 유료 단품 · 싱글플레이 · 라이브 이벤트 없음 · 규모가 임계 이하다
- **THEN** 불일치가 비어 있다

### Requirement: 태스크 파일에서 규모를 셀 수 있어야 한다
<!-- id: track.scope -->
<!-- entities: Scope -->
<!-- enforced: plugins/nereus-game/lib/track-advisor.mjs -->

시스템은 tasks 파일 내용에서 태스크 수와 `[flow]` 태스크 수를 세어야 한다.
규모를 사람이 입력하게 하면 추측이 들어간다 — 산출물에 이미 있는 값이다.

#### Scenario: 완료·미완료 태스크를 모두 센다
- **WHEN** tasks 내용에 미완료와 완료 태스크가 섞여 있다
- **THEN** 둘을 합한 수가 태스크 수다

#### Scenario: flow 태스크를 따로 센다
- **WHEN** 일부 태스크에 `[flow]` 태그가 있다
- **THEN** 그 수가 flow 수로 따로 나온다

#### Scenario: 빈 내용
- **WHEN** tasks 내용이 비어 있다
- **THEN** 태스크 수가 0 이다

### Requirement: 규모 계수는 태스크 형식을 못 알아본 것과 태스크가 없는 것을 구분해야 한다
<!-- id: track.scopeMatched -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/track-advisor.test.ts -->

`countScope` 는 spec-kit 형식(`- [x] T001 설명`)과 nereus:spec 형식(`- [ ] T1. 설명`)을
모두 세어야 하며, 어느 형식으로 셌는지를 `matched` 로 함께 내야 한다.
어떤 형식으로도 태스크를 찾지 못하면 `matched` 는 `null` 이어야 한다.

실측: ToonTone 의 spec-kit `tasks.md` 에 태스크 188개가 있었으나 0개로 셌다.
정규식이 번호 뒤 마침표를 요구했기 때문이다. `nereus:spec` 은 greenfield 에 spec-kit 을 쓴다고
선언하면서 계수기는 자기 형식만 읽었다. 결과가 에러가 아니라 조용히 뒤집혔다 —
다작 임계 24개를 7.8배 넘는 프로젝트가 근거 0건의 `many` 로 추천되었다.

#### Scenario: spec-kit 형식
- **WHEN** `- [x] T001 Flutter 프로젝트를 저장소 루트에 생성한다` 를 포함한 tasks 를 센다
- **THEN** `tasks` 가 1 이고 `matched` 가 `"spec-kit"` 이다

#### Scenario: nereus:spec 형식
- **WHEN** `- [ ] T1. 무언가를 한다` 를 포함한 tasks 를 센다
- **THEN** `tasks` 가 1 이고 `matched` 가 `"nereus"` 이다

#### Scenario: 알 수 없는 형식
- **WHEN** 체크박스는 있으나 어떤 태스크 형식과도 맞지 않는 tasks 를 센다
- **THEN** `tasks` 가 0 이고 `matched` 가 `null` 이며 `checkboxes` 가 체크박스 총수다

#### Scenario: 태스크 형식을 못 알아봤을 때의 추천
- **WHEN** `matched` 가 `null` 인 scope 로 트랙을 추천한다
- **THEN** 규모 임계 비교를 하지 않고 `reasons` 에 `scope-unknown` 을 싣는다

### Requirement: 현지화 검사는 생성물과 개발자 메시지를 위반으로 보고하지 않아야 한다
<!-- id: l10n.excludeNonUserFacing -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/l10n-scan.test.ts -->

`scanL10n` 은 l10n 도구 생성물 경로의 줄과 예외·단언·로그 줄을 `violations` 에 넣지 않아야 한다.
대신 분류와 건수를 `skipped` 로 내야 한다. 조용히 버리면 검사되지 않은 것과 통과한 것이 구분되지 않는다.

실측: ToonTone 에서 461건이 나왔고 그중 진짜 결함은 0건이었다.
`lib/l10n/generated/app_localizations_en.dart` — l10n 도구가 만든 번역 테이블 자체가
"하드코딩 문자열"로 잡혔다. 461:0 이면 사람이 게이트를 끈다.

#### Scenario: 생성물
- **WHEN** `lib/l10n/generated/app_localizations_en.dart` 의 번역 리터럴을 스캔한다
- **THEN** `violations` 가 비어 있고 `skipped` 에 `generated` 가 1건 이상이다

#### Scenario: 개발자 메시지
- **WHEN** `throw ContentPackFormatException('최상위가 객체여야 한다');` 를 스캔한다
- **THEN** `violations` 가 비어 있고 `skipped` 에 `dev-message` 가 1건 이상이다

#### Scenario: 사용자 노출 문자열은 계속 잡는다
- **WHEN** 생성물이 아닌 파일의 `Text('색을 맞춰보세요')` 를 스캔한다
- **THEN** `violations` 에 `hardcoded` 가 1건 있다

#### Scenario: 개발자 메시지가 섞인 파일의 사용자 문자열
- **WHEN** 한 파일에 예외 줄과 위젯 줄이 같이 있다
- **THEN** 위젯 줄만 `violations` 에 남는다

### Requirement: 제외 규칙은 데이터로 덮어쓸 수 있어야 한다
<!-- id: l10n.excludeIsData -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/l10n-scan.test.ts -->

생성물 경로 패턴과 개발자 메시지 토큰은 호출자가 `exclude` 로 덮어쓸 수 있어야 하며,
덮어쓰지 않으면 기본값이 적용되어야 한다. 패턴은 언어·프레임워크마다 다르다
(`.g.dart` 는 Dart, `.generated.cs` 는 Unity). 코드에 박으면 스택이 늘 때마다 lib 을 고치게 된다.

#### Scenario: 기본값
- **WHEN** `exclude` 없이 스캔한다
- **THEN** Dart 기본 패턴(`generated/`, `.g.dart`, `.freezed.dart`)이 적용된다

#### Scenario: 덮어쓰기
- **WHEN** `exclude.generated` 에 `"__gen__/"` 만 준다
- **THEN** `__gen__/` 경로만 생성물로 분류되고 `.g.dart` 는 분류되지 않는다
