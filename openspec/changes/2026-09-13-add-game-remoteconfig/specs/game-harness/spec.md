## ADDED Requirements

### Requirement: 원격 설정 키는 전부 분류되어야 한다
<!-- id: remoteConfig.union -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/remote-config-check.test.ts -->

선언한 전체 키는 분류 집합들의 합집합과 정확히 같아야 하며, 어긋나는 방향마다 다른 코드로
보고해야 한다. 분류되지 않은 키는 어떤 폴백이 적용될지 아무도 모르는 키다.

#### Scenario: 분류 누락
- **WHEN** 선언된 키가 어느 분류에도 없다
- **THEN** 위반 코드 `unclassified` 와 그 키가 나온다

#### Scenario: 유령 키
- **WHEN** 분류에 있는 키가 선언에 없다
- **THEN** 위반 코드 `phantom` 과 그 키가 나온다

#### Scenario: 분류가 겹친다
- **WHEN** 한 키가 두 분류에 있다
- **THEN** 위반 코드 `multi-class` 와 겹친 분류들이 나온다

#### Scenario: 일치하면 깨끗하다
- **WHEN** 선언과 합집합이 정확히 같고 겹침이 없다
- **THEN** 이 세 코드의 위반이 없다

### Requirement: 번들 기본값은 하위 폴백을 죽이지 않아야 한다
<!-- id: remoteConfig.bundleSafe -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/remote-config-check.test.ts -->

`bundleSafe` 가 아닌 분류의 키가 번들 기본값에 있으면 위반으로 보고해야 한다.
번들 기본값이 있는 키는 원격에 값이 없어도 "설정됨"으로 판정되어 그 아래 폴백 계층이
조용히 죽는다. 실제로 이 사고로 접이식 배너가 전 등급 영구 OFF 가 된 이력이 있다.
에러도 로그도 없이 몇 주 동안 수익이 새므로, 검사로 잡지 못하면 사람은 못 잡는다.

#### Scenario: 하위 계층이 결정하는 키가 번들에 있다
- **WHEN** `bundleSafe: false` 분류의 키가 `bundleDefaults` 에 있다
- **THEN** 위반 코드 `bundle-unsafe` 와 그 분류의 `why` 가 나온다

#### Scenario: 안전한 키는 번들에 있어도 된다
- **WHEN** `bundleSafe: true` 분류의 키만 `bundleDefaults` 에 있다
- **THEN** `bundle-unsafe` 위반이 없다

#### Scenario: 심각도를 나눈다
- **WHEN** `bundle-unsafe` 와 `unclassified` 가 같이 나온다
- **THEN** `bundle-unsafe` 의 `severity` 가 `incident` 이고 나머지는 `trust` 다

### Requirement: 분류 체계는 데이터여야 한다
<!-- id: remoteConfig.classesAreData -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/remote-config-check.test.ts -->

기본 분류 체계는 `remote-config.json` 에 있어야 하고, 각 분류는 `bundleSafe` 와 `why` 를
가져야 하며, 호출자가 덮어쓸 수 있어야 한다. 분류 이름은 제품마다 다르다 —
검사기가 알면 제품마다 lib 이 하나씩 는다.

#### Scenario: 기본 체계
- **WHEN** `remote-config.json` 의 분류를 로드한다
- **THEN** 분류가 둘 이상이고 각각 `bundleSafe` 와 비어 있지 않은 `why` 를 갖는다

#### Scenario: 이유 없는 분류는 받지 않는다
- **WHEN** `why` 가 없는 분류를 준다
- **THEN** 던진다

#### Scenario: 덮어쓰기
- **WHEN** 호출자가 자기 분류 체계를 준다
- **THEN** 기본 체계 대신 그것으로 판정한다

### Requirement: 키 이름 규칙을 검사해야 한다
<!-- id: remoteConfig.keyPattern -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/remote-config-check.test.ts -->

키 이름이 선언된 패턴에 맞지 않으면 위반으로 보고해야 하며, 패턴은 데이터로 받아야 한다.
키는 원격 콘솔에서 사람이 손으로 치는 문자열이라 오타가 새 키를 만들고,
새 키는 조용히 기본값으로 떨어진다 — 컴파일러도 테스트도 안 잡는다.

#### Scenario: 규칙 위반
- **WHEN** 키가 `adInterstitialFrequency` 처럼 기본 패턴에 안 맞는다
- **THEN** 위반 코드 `key-pattern` 이 나온다

#### Scenario: 패턴은 데이터다
- **WHEN** `keyPattern` 으로 다른 정규식을 준다
- **THEN** 그 패턴으로 판정한다
