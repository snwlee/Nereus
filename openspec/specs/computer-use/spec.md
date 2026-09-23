# computer-use Specification

## Purpose
네이티브 데스크톱 창(Studio 대화상자·앱 설정 등)을 조작할 때 통로(Cua Driver·Orca·비전·Lume)를 실측으로 고르고, 대상 확인·사람 부재·원격 아님이 모두 참일 때만 입력하게 판정한다.

## Requirements

### Requirement: 통로는 가장 정확한 것부터 고르고 고른 이유를 내야 한다
<!-- id: computerUse.layer -->
<!-- entities: Judge -->
<!-- enforced: tests/skills/computer-use.test.ts -->

`judge` 는 Cua Driver 가 설치되고 두 권한(손쉬운 사용·화면 기록)이 모두 `granted` 면 `cua` 를,
아니면 Orca computer-use 가 클릭을 지원할 때 `orca` 를, 둘 다 없고 스크린샷만 가능하면 `vision` 을 골라야 한다.
격리가 요구되면 `lume` 이 설치돼 있을 때만 `lume` 이다. 고르지 못하면 `none` 이다.
건너뛴 통로마다 `reasons` 에 사유 코드를 실어야 한다 — 조용히 한 단계 내려가면 권한 미부여가 영구히 묻힌다.

#### Scenario: Cua 권한 완비
- **WHEN** cua 설치, 권한 둘 다 granted
- **THEN** `layer` 가 `"cua"` 다

#### Scenario: Cua 권한 미확인이면 Orca 로 내려가고 사유를 싣는다
- **WHEN** cua 설치, 권한 status `unknown`, orca click 지원
- **THEN** `layer` 가 `"orca"` 이고 `reasons` 에 `cua-permission-unconfirmed` 가 있다

#### Scenario: 격리 요구인데 Lume 없음
- **WHEN** `needsIsolation` 이 true 이고 lume 미설치
- **THEN** `layer` 가 `"none"`, `verdict` 가 `"ask"`, `reasons` 에 `lume-missing` 이 있다

### Requirement: 입력 전에 대상과 사람을 확인하고 아니면 막아야 한다
<!-- id: computerUse.safety -->
<!-- entities: Judge -->
<!-- enforced: tests/skills/computer-use.test.ts -->

입력(`input`)이나 되돌리기 어려운 행동(`irreversible`)은 대상 창이 확인되지 않았거나(`targetConfirmed` false),
원격 제어 중이거나, 사람이 최근 `HUMAN_ACTIVE_SECONDS` 안에 입력했으면 `block` 이어야 한다.
읽기(`read`)는 막지 않는다. 되돌리기 어려운 행동은 승인(`approved`)이 없으면 `ask` 다.

#### Scenario: 원격 제어 중 입력
- **WHEN** `risk` `input`, `remoteControl` true
- **THEN** `verdict` 가 `"block"`, `reasons` 에 `remote-control-active`

#### Scenario: 사람이 방금 입력함
- **WHEN** `risk` `input`, `humanIdleSeconds` 가 5
- **THEN** `verdict` 가 `"block"`, `reasons` 에 `human-active`

#### Scenario: 사람 유휴 시간을 못 잼
- **WHEN** `risk` `input`, 대상 확인, `humanIdleSeconds` 가 null, 승인 없음
- **THEN** `verdict` 가 `"ask"`, `reasons` 에 `human-idle-unknown`

#### Scenario: 저장·전송 같은 행동은 승인 필요
- **WHEN** `risk` `irreversible`, 대상 확인, 원격 아님, 승인 없음
- **THEN** `verdict` 가 `"ask"`, `reasons` 에 `needs-approval`

#### Scenario: 읽기는 막지 않는다
- **WHEN** `risk` `read`, `remoteControl` true
- **THEN** `verdict` 가 `"go"`

### Requirement: 실측 출력을 그대로 파싱해야 한다
<!-- id: computerUse.probeParse -->
<!-- entities: Probe -->
<!-- enforced: tests/skills/computer-use.test.ts -->

`parseCuaPermissions` 와 `parseOrcaCapabilities` 는 실제 명령 출력(픽스처는 실측 캡처)을 읽어야 한다.
데몬이 없어 `status: "unknown"` 이면 권한을 `granted` 로도 `denied` 로도 단정하지 않고 `unknown` 으로 내야 한다.

#### Scenario: Cua 데몬 없음
- **WHEN** `cua-driver permissions status --json` 가 `{"daemon_running": false, "status": "unknown"}` 를 냈다
- **THEN** 두 권한이 모두 `"unknown"` 이다

#### Scenario: Orca 대화상자 미지원
- **WHEN** orca capabilities 의 `surfaces.dialogs` 가 false
- **THEN** 파싱 결과 `dialogs` 가 false 이고 `click` 이 true 다
