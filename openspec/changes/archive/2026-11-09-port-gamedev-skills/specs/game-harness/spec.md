## ADDED Requirements

### Requirement: 증분·방치형 페이싱을 수치로 판정해야 한다
<!-- id: pacing.check -->
<!-- entities: Profile, Economy -->
<!-- enforced: plugins/nereus-game/lib/economy-curve.mjs -->

시스템은 업그레이드 가격 곡선·환생·오프라인 수익 설정을 받아 장르 프로파일의 `pacing` 기준으로 판정해야 한다.
환생 대기 비율은 수입에 무관하게 `r·m_k/m_{k+1}` 로 정해지므로 수입 없이도 판정할 수 있다.

#### Scenario: 환생이 갈수록 크게 느려진다
- **WHEN** 연속 환생 대기 비율이 기준 상한을 넘는다
- **THEN** `rebirth-ratio` 위반에 그 환생 번호와 비율을 싣는다

#### Scenario: 여러 번 사는 업그레이드의 가파른 성장
- **WHEN** 최대 레벨이 기준 이상인 업그레이드의 성장 계수가 기준을 넘는다
- **THEN** `steep-growth` 위반을 낸다

#### Scenario: 기준 없음
- **WHEN** 프로파일에 `pacing` 이 없다
- **THEN** `no-baseline` 위반을 내고 통과시키지 않는다

#### Scenario: 설정 일부 없음
- **WHEN** 설정에 환생이나 오프라인이 없다
- **THEN** 그 축을 통과로 판정하지 않고 `unmeasured` 에 싣는다

### Requirement: 퍼즐 판을 기계적으로 검증해야 한다
<!-- id: puzzle.board -->
<!-- entities: Board -->
<!-- enforced: plugins/nereus-game/lib/puzzle-board.mjs -->

매치-3 판은 시작 시 매치가 없고 둘 수 있는 수가 있어야 한다. 슬라이딩 퍼즐은 패리티상 풀 수 있어야 한다.

#### Scenario: 시작부터 매치
- **WHEN** 매치-3 판에 같은 조각 3개 연속이 있다
- **THEN** `initial-match` 위반을 낸다

#### Scenario: 데드락
- **WHEN** 인접 교환 어느 것도 매치를 만들지 않는다
- **THEN** `deadlock` 위반을 낸다

#### Scenario: 풀 수 없는 슬라이딩 판
- **WHEN** 슬라이딩 판의 반전 수 패리티가 풀이 불가능하다
- **THEN** `unsolvable-parity` 위반을 낸다

### Requirement: 세이브 설계의 소실 경로를 판정해야 한다
<!-- id: save.check -->
<!-- entities: SavePlan -->
<!-- enforced: plugins/nereus-game/lib/save-check.mjs -->

세이브 계획에 버전 필드·연속된 마이그레이션 체인·원자적 쓰기·백업·분리된 자동저장 슬롯·새 버전 거부·버전별 회귀 표본이 있어야 한다.
소실은 되돌릴 수 없으므로 하나라도 빠지면 위반이다.

#### Scenario: 마이그레이션 구멍
- **WHEN** 현재 버전이 3인데 1→2 마이그레이션만 있다
- **THEN** `migration-gap` 위반에 빠진 버전 2를 싣는다

#### Scenario: 제자리 쓰기
- **WHEN** 쓰기 방식이 원자적 교체가 아니다
- **THEN** `in-place-write` 위반을 낸다

### Requirement: 프레임 예산을 측정치로 판정해야 한다
<!-- id: perf.frameBudget -->
<!-- entities: FrameSamples -->
<!-- enforced: plugins/nereus-game/lib/frame-budget.mjs -->

목표 FPS 와 프레임 시간 표본으로 p95 예산 초과·히치 비율·발열 저하·프레임당 GC 할당을 판정해야 한다.
에디터·디버그 빌드나 대상 기기가 아닌 측정은 위반이 없어도 통과로 내지 않는다.

#### Scenario: 에디터 측정
- **WHEN** 표본이 에디터에서 측정됐다
- **THEN** `evidence` 가 false 이고 `pass` 가 false 다

#### Scenario: 히치
- **WHEN** 예산의 2배를 넘는 프레임이 1%를 넘는다
- **THEN** `hitch-rate` 위반을 낸다

### Requirement: 이식한 자료는 출처와 라이선스를 지켜야 한다
<!-- id: port.attribution -->
<!-- entities: Plugin -->
<!-- enforced: tests/lib/game-packaging.test.ts -->

Apache-2.0 자료를 옮긴 플러그인은 NOTICE 에 출처·원본 NOTICE 문구·수정 사실을 적고 라이선스 전문을 동봉해야 한다.

#### Scenario: NOTICE
- **WHEN** NOTICE 를 읽는다
- **THEN** `awesome-gamedev-agent-skills` 와 `Apache License, Version 2.0` 이 있고 `LICENSES/Apache-2.0.txt` 가 존재한다

## MODIFIED Requirements

### Requirement: 도메인 스킬은 엔진 고유 문법을 담지 않아야 한다
<!-- id: domainSkills.engineAgnostic -->
<!-- entities: Skill -->
<!-- enforced: tests/smoke/game-domain.test.ts -->

`level` · `narrative` · `gameux` · `asset` · `balance` · `save` · `perf` 스킬 본문은 특정 엔진의 문법·API 를 담지 않아야 한다.
엔진 의존은 어댑터(`lib/*-stack.mjs`)와 엔진 스킬(`roblox` 등)이 흡수한다.
메인 플랫폼이 없고 로블록스와 2D 폰게임을 동시에 대응해야 하므로, 도메인 지식이 엔진에 묶이면 두 벌이 된다.

#### Scenario: 도메인 스킬 본문
- **WHEN** 도메인 스킬 7종의 SKILL.md 를 검사한다
- **THEN** Luau·C# 고유 토큰(`game.Players`, `MonoBehaviour`, `UnityEngine`, `:GetService`)이 없다
