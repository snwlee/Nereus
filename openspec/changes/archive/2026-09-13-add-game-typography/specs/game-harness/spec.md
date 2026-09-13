# game-harness Specification (delta: add-game-typography)

## ADDED Requirements

### Requirement: 폰트를 라이선스·글리프·용량·가독성으로 판정해야 한다
<!-- id: font.check -->
<!-- entities: Font, Locale, Profile -->
<!-- enforced: plugins/nereus-game/lib/font-check.mjs -->
<!-- invariant: 게임 임베딩 허용을 선언하지 않은 폰트는 통과시키지 않는다 -->

시스템은 선언된 폰트 목록을 대상 로케일과 대조해 위반 목록을 돌려주어야 한다.
검사 항목은 다섯이다: 게임 임베딩 라이선스, 로케일이 요구하는 스크립트 커버리지,
유저 생성 텍스트가 있을 때의 서브셋 금지, 파일 크기 예산, 최소 표시 크기.

#### Scenario: 임베딩이 허용되지 않은 폰트
- **WHEN** 폰트의 `embedding` 이 `"game"` 을 포함하지 않는다
- **THEN** 위반에 그 폰트 이름과 함께 `license-embedding` 이 들어 있다

#### Scenario: 임베딩 선언 자체가 없음
- **WHEN** 폰트에 `embedding` 선언이 없다
- **THEN** 위반에 `license-embedding` 이 들어 있다

#### Scenario: 로케일 스크립트 미커버
- **WHEN** 대상 로케일이 요구하는 `script` 를 어떤 폰트도 `scripts` 에 선언하지 않았다
- **THEN** 위반에 그 로케일과 함께 `script-uncovered` 가 들어 있다

#### Scenario: 유저 생성 텍스트가 있는데 서브셋
- **WHEN** `userGeneratedText` 가 참인데 어떤 폰트의 `subset` 이 참이다
- **THEN** 위반에 그 폰트 이름과 함께 `subset-unsafe` 가 들어 있다

#### Scenario: 폰트 용량 초과
- **WHEN** 폰트 파일 크기 합이 프로파일의 `typography.maxFontKb` 를 넘는다
- **THEN** 위반에 `font-size-budget` 이 들어 있다

#### Scenario: 최소 표시 크기 미만
- **WHEN** 폰트의 `minSizePx` 가 프로파일의 `typography.minSizePx` 미만이다
- **THEN** 위반에 그 폰트 이름과 함께 `min-size` 가 들어 있다

#### Scenario: 프로파일에 기준이 없음
- **WHEN** 장르 프로파일에 `typography` 키가 없다
- **THEN** 예산·크기 항목을 판정하지 않고 `unmeasured` 에 `typography-baseline` 이 들어 있다

### Requirement: 문자열 폭 판정은 근사 여부를 표시해야 한다
<!-- id: l10n.approxWidth -->
<!-- entities: Locale, Font, StringTable -->
<!-- enforced: plugins/nereus-game/lib/l10n-scan.mjs -->
<!-- invariant: 폰트 메트릭 없이 낸 폭 판정은 approx 로 표시한다. 조용한 근사는 틀린 확신을 만든다 -->

시스템은 폰트 메트릭이 주어지면 그것으로 문자열 폭을 계산하고, 주어지지 않으면
언어 확장률로 근사하되 그 위반에 근사임을 표시해야 한다. 기존 반환 형태는 유지한다.

#### Scenario: 폰트 메트릭 없이 폭 판정
- **WHEN** `fonts` 인자 없이 `maxWidth` 를 넘는 문자열을 검사한다
- **THEN** `overflow` 위반이 나오고 그 위반의 `approx` 가 참이다

#### Scenario: 폰트 메트릭으로 폭 판정
- **WHEN** 그 로케일의 폰트 `avgCharWidth` 가 주어진다
- **THEN** `overflow` 판정에 그 값이 쓰이고 위반의 `approx` 가 거짓이다

#### Scenario: 기존 반환 형태 유지
- **WHEN** `fonts` 를 주지 않고 기존처럼 호출한다
- **THEN** `violations` 배열이 기존과 같은 코드 집합으로 나온다
