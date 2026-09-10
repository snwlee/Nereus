# harness-setup

외부 도구·동반 플러그인의 설치 상태를 감지하고 설치를 안내하는 능력.
진입점: `plugins/nereus/skills/setup/SKILL.md`, `scripts/detect.mjs`, `scripts/mcp-doctor.mjs`.

Last verified: 2026-09-10 (commit ddda30f)

## Purpose

외부 도구와 동반 플러그인의 설치 상태를 감지하고, MCP 상주 비용을 보고하고, 설치를 사용자 승인 아래 안내한다.

## Requirements

### Requirement: 플랫폼별 설치 명령으로 CLI 도구 존재를 보고한다
<!-- id: detect.detect -->
<!-- entities: Tool, DetectionRow -->
<!-- enforced: detect.mjs detect() -->

시스템은 `TOOLS` 목록의 각 도구에 대해 PATH 존재 여부를 조사하고, 실행 중인 플랫폼
(`darwin`/`win32`/그 외는 `linux`)에 해당하는 설치 명령을 함께 반환해야 한다.

#### Scenario: 미설치 도구
<!-- test: tests/skills/setup-detect.test.ts -->
- **WHEN** 도구 바이너리가 PATH 에 없다
- **THEN** 해당 행의 `present` 가 false 이고 `installCmd` 에 현재 플랫폼용 명령이 담긴다

### Requirement: 디렉터리로만 존재하는 도구는 진입 파일로 판정한다
<!-- id: detect.detectDirs -->
<!-- enforced: detect.mjs detectDirs() -->

PATH 에 바이너리를 남기지 않는 도구(`DIR_TOOLS`)는 후보 디렉터리들 중 하나에
`entry` 파일이 실재하는지로 설치 여부를 판정해야 한다.

#### Scenario: ui-ux-pro-max 데이터 엔진
- **WHEN** 후보 디렉터리 중 하나에 `scripts/search.py` 가 있다
- **THEN** `present` 가 true 이다

### Requirement: detect 계열은 읽기 전용이다
<!-- invariant: 항상 참. 트리거가 없다 -->
<!-- enforced: detect.mjs -->
<!-- verified_by: tests/skills/setup-detect.test.ts -->

감지 함수는 도구를 설치하거나 설정 파일을 쓰지 않는다. 설치는 SKILL.md 절차가
사용자 승인을 받은 뒤에만 실행한다.

#### Scenario: 감지 실행
- **WHEN** 감지 함수를 실행한다
- **THEN** 도구가 설치되지 않고 설정 파일도 쓰이지 않는다

### Requirement: 트리거가 겹치는 상류 번들은 스킬로 설치하지 않는다
<!-- invariant: 항상 참. 트리거가 없다 -->
<!-- enforced: detect.mjs DIR_TOOLS[ui-ux-pro-max].note, setup/SKILL.md -->

`ui-ux-pro-max` 는 데이터 엔진으로만 설치한다. 상류 번들의 `design` 스킬이
`nereus:design` 과 트리거가 겹치기 때문이다. 이 저장소가 이미 인지하고 있는
유일한 플러그인 충돌 사례다.

<!-- uncertainty: 이 규칙은 SKILL.md 산문과 DIR_TOOLS.note 두 곳에 흩어져 있고
     기계 게이트가 없다. 사람이 절차를 어기면 막히지 않는다. -->

#### Scenario: ui-ux-pro-max 설치
- **WHEN** ui-ux-pro-max 를 설치한다
- **THEN** sparse-checkout 으로 데이터 엔진만 놓이고 상류 design 스킬은 설치되지 않는다

### Requirement: MCP 상주 비용을 보고한다
<!-- id: mcp-doctor -->
<!-- enforced: mcp-doctor.mjs -->

시스템은 MCP 서버 계열별 RSS·프로세스 수, 부모가 죽어 재부모된 유령 프로세스,
`~/.npm/_npx` 캐시 크기, 설정 문제(버전 미고정·텔레메트리 on)를 보고해야 한다.

#### Scenario: --check
- **WHEN** `/nereus:setup --check` 로 호출된다
- **THEN** 감지·비용 보고까지만 하고 설치 단계로 넘어가지 않는다

<!-- deferred: mcp-doctor.mjs 내부 판정 로직 상세 -->
