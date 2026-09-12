# game-harness (델타)

## ADDED Requirements

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
