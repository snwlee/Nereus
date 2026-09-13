# game-harness Specification (delta: add-game-compliance)

## ADDED Requirements

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
