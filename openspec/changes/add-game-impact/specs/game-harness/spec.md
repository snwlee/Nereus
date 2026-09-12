# game-harness Specification (delta: add-game-impact)

## ADDED Requirements

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
