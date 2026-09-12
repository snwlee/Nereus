# game-harness (델타)

## ADDED Requirements

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
