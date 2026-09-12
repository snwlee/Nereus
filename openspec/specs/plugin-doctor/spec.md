# plugin-doctor Specification

## Purpose
설치된 Claude Code 플러그인들의 표면을 인벤토리하고, Nereus 와의 충돌을 심각도별로 판정하고,
되돌릴 수 있는 처방을 사용자 승인 아래 적용한다. 스스로 이기지 않고 파괴하지 않는다.

## Requirements

### Requirement: 설치된 플러그인의 충돌 표면을 인벤토리한다
<!-- entities: PluginRecord, Surface -->

시스템은 `~/.claude/plugins/installed_plugins.json` 의 각 플러그인에 대해
`~/.claude/settings.json` 의 `enabledPlugins` 로 활성 여부를 판정하고, `installPath` 아래에서
충돌 가능 표면 — 스킬(`skills/*/SKILL.md`), 훅(`hooks/hooks.json` 의 event+matcher),
MCP 서버(`.mcp.json`), 에이전트(`agents/`), 실행파일(`bin/`), `settings.json` 의 `agent` 키 —
을 수집해야 한다.

#### Scenario: 설치됐지만 비활성
- **WHEN** `enabledPlugins` 에 `"<p>": false` 로 있다
- **THEN** 인벤토리에 `enabled: false` 로 남되 충돌 판정 대상에서 제외한다

#### Scenario: 표면이 없는 플러그인
- **WHEN** `installPath` 에 skills·hooks·mcp·agents·bin 중 아무것도 없다
- **THEN** 빈 표면 목록으로 기록하고 오류를 내지 않는다

### Requirement: 구조적 완전일치를 HIGH 로 판정한다

시스템은 활성 플러그인 둘 이상이 같은 MCP 서버 이름, 같은 에이전트 이름, 또는 같은 `bin/`
실행파일 이름을 제공하면 이를 HIGH(섀도잉)로 판정해야 한다. 하나가 조용히 이기고 다른 하나는
존재하지 않게 되므로 증상이 보이지 않는다.

#### Scenario: MCP 서버명 중복
- **WHEN** 두 활성 플러그인이 `chrome-devtools` 라는 MCP 서버를 각각 정의한다
- **THEN** severity 는 HIGH, 처방에 `permissions.deny: ["mcp__chrome-devtools"]` 가 포함된다

#### Scenario: 한쪽이 비활성
- **WHEN** 같은 이름을 정의하지만 한쪽이 `enabled: false` 다
- **THEN** 충돌로 판정하지 않는다

### Requirement: 알려진 이중 게이트를 MEDIUM 으로 판정한다

시스템은 큐레이션 표에 등재된 조합에 한해 이중 게이트를 MEDIUM 으로 판정해야 한다. 구조적으로
감지할 수 없기 때문이다. 표에 없는 플러그인은 구조적 층만 적용한다.

#### Scenario: superpowers 완료 게이트
- **WHEN** superpowers 와 nereus 가 함께 활성이다
- **THEN** severity MEDIUM, 근거 문장과 함께 처방은 "수동 절차"로 표시되고 파일 수정 명령을 내지 않는다

### Requirement: 무해한 동일 훅 지점은 LOW 로 억제한다

같은 hook event 와 matcher 에 서로 다른 플러그인이 훅을 걸었으나 큐레이션 표가 이중 게이트로
알지 못하면 LOW 로 판정해야 한다. 기본 출력에서 제외하고 `--all` 에서만 보인다.

#### Scenario: 기본 출력
- **WHEN** `--all` 없이 실행한다
- **THEN** HIGH·MEDIUM 만 나오고 LOW 는 건수만 요약된다

### Requirement: 처방을 적용하고 원장에 기록한다

승인된 처방을 적용할 때 시스템은 건드린 JSON 경로, 그 경로의 이전 값(부재 표시 포함), 넣은 값,
적용 후 파일 전체 해시를 append-only 원장에 기록해야 한다. 쓰기는 임시 파일 + rename 으로 한다.

#### Scenario: MCP 섀도잉 처방
- **WHEN** HIGH 처방을 승인한다
- **THEN** `permissions.deny` 에 항목이 추가되고 원장에 위 4가지가 남는다

### Requirement: --undo 는 역편집하고 드리프트에서 중단한다

`--undo` 는 전체 스냅샷을 복원하지 않고 원장에 기록된 항목만 역편집해야 한다. 파일이 그 사이
바뀌었으면 대상 경로만 확인하고, 그 경로까지 바뀌었으면 중단한다.

#### Scenario: 해시 일치
- **WHEN** 현재 파일 해시가 원장의 해시와 같다
- **THEN** 역편집하고 성공한다

#### Scenario: 다른 곳만 수정됨
- **WHEN** 파일 해시는 다르지만 대상 경로의 값이 원장의 "넣은 값" 그대로다
- **THEN** 그 경로만 되돌리고 나머지 수동 편집은 보존한다

#### Scenario: 대상 경로가 수정됨
- **WHEN** 대상 경로의 값이 원장의 "넣은 값"과 다르다
- **THEN** 중단하고 경로·기대값·실제값을 보고한다. 덮어쓰지 않는다

#### Scenario: 경로 부재
- **WHEN** 대상 경로가 이미 없다
- **THEN** 멱등 no-op 으로 성공 처리한다

### Requirement: 수용은 지문에 묶인다

사용자가 수용(ack)한 항목은 (충돌종류, 양쪽 플러그인 이름, 양쪽 버전, 유닛 식별자) 지문으로
기록되어 침묵해야 한다. 지문이 달라지면 다시 보고한다.

#### Scenario: 버전 상승
- **WHEN** 수용된 충돌의 한쪽 플러그인 버전이 올라간다
- **THEN** 지문이 달라져 다시 보고되고 "버전 변경으로 재등장"으로 표시된다

### Requirement: 판정 스코프와 상태 저장이 일치한다

전역(`~/.claude`)은 항상 판정하고, 프로젝트(`<cwd>/.claude`)는 프로젝트 안에서 실행할 때
추가로 판정해야 한다. 전역 원장·스냅샷은 `~/.config/nereus/`, 프로젝트 판정의 수용은
`.nereus/` 에 저장한다.

#### Scenario: 프로젝트 로컬 에이전트 override
- **WHEN** `<cwd>/.claude/agents/` 가 플러그인 에이전트와 같은 이름을 정의한다
- **THEN** 스코프 `project` 로 표시되고, 수용하면 `.nereus/` 에만 기록되어 다른 프로젝트에서는 침묵하지 않는다

### Requirement: doctor 는 파괴하지 않는다
<!-- invariant: 항상 참. 트리거가 없다 -->

시스템은 어떤 경우에도 `/plugin uninstall` 이나 파일 삭제를 실행하지 않아야 한다.
완전 제거는 명령 문자열 출력에 그친다.

#### Scenario: 완전 제거 처방
- **WHEN** 사용자가 완전 제거 단계를 고른다
- **THEN** `/plugin uninstall <p>` 문자열을 출력하고 프로세스를 실행하지 않는다
