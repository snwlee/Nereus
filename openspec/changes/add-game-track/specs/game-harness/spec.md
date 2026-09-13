# game-harness Specification (delta: add-game-track)

## ADDED Requirements

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
