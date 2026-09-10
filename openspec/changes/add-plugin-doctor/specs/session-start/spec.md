# session-start

## ADDED Requirements

### Requirement: 새 플러그인 지문이 생겼을 때만 한 줄 알린다
<!-- entities: PluginSnapshot -->

SessionStart 훅은 활성 플러그인 집합의 스냅샷을 `~/.config/nereus/plugin-snapshot.json` 과
비교해, 새로 설치되거나 활성화된 것이 있으면 "## Nereus 상태" 블록에 한 줄을 추가해야 한다.
훅은 어떤 설정도 자동으로 바꾸지 않는다.

#### Scenario: 새 플러그인 설치됨
- **WHEN** 이전 스냅샷에 없던 플러그인이 활성 상태로 발견된다
- **THEN** `새 플러그인 N개 감지 → /nereus:doctor` 한 줄이 상태 블록에 추가되고 스냅샷이 갱신된다

#### Scenario: 변화 없음
- **WHEN** 활성 플러그인 집합이 이전 스냅샷과 같다
- **THEN** 알림 줄을 추가하지 않는다

#### Scenario: 스냅샷 파일 없음 (첫 실행)
- **WHEN** 스냅샷 파일이 없다
- **THEN** 현재 집합을 기준선으로 기록만 하고 알리지 않는다. 첫 실행에 전체를 "새 플러그인"으로 보고하지 않는다

#### Scenario: compact
- **WHEN** `source === "compact"`
- **THEN** 상태 블록 자체를 내지 않는 기존 규칙을 따르며 스냅샷도 갱신하지 않는다
