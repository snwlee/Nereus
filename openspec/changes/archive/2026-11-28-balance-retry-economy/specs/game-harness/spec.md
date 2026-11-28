# game-harness

## ADDED Requirements

### Requirement: 캐주얼 퍼즐 재시도 경제를 시드 고정으로 재야 한다
<!-- id: balanceSim.retry -->
<!-- entities: Profile, Economy, Level -->
<!-- enforced: plugins/nereus-game/lib/retry-economy.mjs, plugins/nereus-game/lib/seeded-random.mjs -->

시스템은 이동 수 제한 레벨 배열(`name`·`id?`·`moves`·`goal`·`progress`·`tier?`)과 선택 입력 `lives`·`continueOffer`·`seed`(기본 1)를 받아
레벨마다 판 `trials` 개를 시드 고정으로 돌리고 레벨마다 다음 지표를 내야 한다.
판 하나는 레벨의 기본 난수열에서 정확히 `moves` 개의 진척을 `[min,max]` 균등분포로 뽑아 더하고, 합이 `goal − 1e-9` 이상이면 클리어다.
실패한 판은 `continueOffer` 가 있으면 별도 이어하기 난수열에서 `continueOffer.moves` 개를 더 뽑아 이어 간다(판당 한 번).
p 는 이어하기 없이 클리어한 판의 비율, q 는 실패한 판 중 이어하기로 클리어한 비율, σ = √(p(1−p)/trials) 다.

- `firstTryWinRate` = p
- `cumulativeWinRate` = 1 − (1−p)^n, n = 1..`attempts`
- `expectedLivesPerClear` = (1−p)/p, p = 0 이면 `null`
- `livesOutRate` = (1−p)^cap, 목숨 없으면 `null`
- `continueSaveRate` = q, 이어하기가 없거나 실패 판이 `minContinueFailures` 미만이면 `null`
- `continueCostPerClear` = price × (1−p) / (p + (1−p)q), `continueSaveRate` 가 `null` 이거나 분모가 0 이면 `null`
- `borderline` — 티어 범위의 하한·상한(0 과 1 제외) 중 하나와 p 의 차이가 2σ 이하면 `true`(정보 필드, 기준이 없으면 `false`)

레벨의 기본 판 난수열은 입력 `seed` 와 레벨 키 `id ?? name` 으로, 이어하기 난수열은 그와 별도로 정한다.
티어는 레벨 `tier` 가 우선이고, 없으면 목록 위치(`tier` 를 적은 레벨도 센다)가 앞 `earlyLevels` 개면 `early`, 나머지는 `mid` 다.
시드는 `simulate()` 와 같이 `(Number(seed) || 1) >>> 0` 으로 읽는다.
`lives.cap` 이 유한한 양수가 아니면 목숨 없음으로 읽는다(`simulate()` 와 같은 해석).
프로파일 `retry` 기준으로 다음 위반을 보고한다(범위는 양 끝 포함). 레벨 위반은 `{ code, level, value, range | limit, why }` 다.

- `retry-cliff` — p 가 티어 범위 하한 미만(난이도 절벽)
- `retry-too-easy` — p 가 티어 범위 상한 초과(난이도 인플레)
- `lives-wall` — `livesOutRate` 가 티어 `maxLivesOut` 초과
- `continue-weak` — `continueSaveRate` 가 `minContinueSave` 미만(`null` 이면 판정하지 않음)
- `no-baseline` — 프로파일에 `retry` 가 없음. 레벨과 무관한 한 항목 `{ code, why }`. 지표는 trials 2000·attempts 5·minContinueFailures 50·`borderline: false` 로 낸다

출력은 `{ levels: [{ name, tier, …지표 }], violations, unmeasured }` 이고, `unmeasured` 는 재지 않은 축(빈 `levels` 면 `"levels"`, 입력이 없으면 `"lives"`·`"continue"`)이다.
`profile.retry` 의 키(`trials`·`attempts`·`earlyLevels`·`minContinueFailures`·`tiers`·`minContinueSave`)는 모두 필수다.
잘못된 입력은 사유를 포함한 오류를 발생시킨다.
CLI(`retry-economy.mjs`)는 stdin JSON(`retry` 를 주면 프로파일의 `retry` 를 대신한다)을 받아 결과를 stdout 에 내고, 입력 오류는 종료 코드 1, 위반이 있어도 종료 코드 0 이다.

#### Scenario: 같은 시드는 같은 결과
- **WHEN** 같은 레벨 목록과 시드로 두 번 잰다
- **THEN** 두 결과가 완전히 같다

#### Scenario: 레벨을 끼워 넣어도 다른 레벨의 지표는 그대로
- **WHEN** 레벨 목록 앞에 새 레벨을 하나 끼워 넣고 다시 잰다
- **THEN** 기존 레벨들의 지표가 끼워 넣기 전과 같다

#### Scenario: 이어하기 유무는 기본 판 결과를 바꾸지 않는다
- **WHEN** 같은 레벨을 `continueOffer` 없이 한 번, 있게 한 번 잰다
- **THEN** 두 결과의 `firstTryWinRate` 가 같다

#### Scenario: 이동 수가 클리어율을 움직인다
- **WHEN** `goal` 20·`progress` [0, 2] 에서 이동 수만 18 과 22 인 두 레벨을 잰다
- **THEN** `trials` 2000 에서 이동 수가 많은 쪽의 첫 시도 클리어율이 0.4 이상 높다(기대값 약 0.21 과 0.77)

#### Scenario: 누적 클리어율
- **WHEN** 첫 시도 클리어율이 p 인 레벨을 잰다
- **THEN** `cumulativeWinRate[n-1]` 은 1 − (1−p)^n 이고 길이는 `attempts` 다

#### Scenario: 중반 레벨 클리어율 하한 미만
- **WHEN** 티어 표시 없는 `earlyLevels` 이후 레벨의 첫 시도 클리어율이 중반 범위 하한보다 낮다
- **THEN** 그 레벨을 `retry-cliff` 로 보고한다

#### Scenario: 초반 레벨 기본 티어
- **WHEN** 티어 표시 없는 첫 레벨의 첫 시도 클리어율이 초반 범위 하한보다 낮다
- **THEN** 초반 기준으로 `retry-cliff` 를 보고한다

#### Scenario: 티어를 적은 레벨도 위치에 센다
- **WHEN** `earlyLevels` 가 1 이고 첫 레벨에 `tier: "hard"` 를 적었으며 두 번째 레벨은 티어 표시가 없다
- **THEN** 두 번째 레벨은 `mid` 로 판정한다

#### Scenario: 게임별 기준 덮어쓰기
- **WHEN** CLI 입력에 `retry` 를 주어 `mid` 범위를 바꾼다
- **THEN** 장르 프로파일 대신 그 기준으로 판정한다

#### Scenario: 명시한 티어가 위치 규칙보다 우선
- **WHEN** 첫 레벨에 `tier: "hard"` 를 적고 클리어율이 하드 범위 안이다
- **THEN** 초반 기준을 쓰지 않아 위반이 없다

#### Scenario: 하드 레벨 클리어율 상한 초과
- **WHEN** `tier: "hard"` 레벨의 첫 시도 클리어율이 하드 범위 상한보다 높다
- **THEN** 그 레벨에 대해 `retry-too-easy` 를 보고한다

#### Scenario: 결정적 레벨과 범위 경계
- **WHEN** `progress` 의 min 과 max 가 같아 클리어율이 정확히 1 인 초반 레벨을 잰다
- **THEN** 범위 상한(1.0)을 포함하므로 `retry-too-easy` 를 보고하지 않는다

#### Scenario: 목숨 벽
- **WHEN** `lives.cap` 이 주어지고 `livesOutRate` 가 그 티어의 `maxLivesOut` 을 넘는다
- **THEN** 그 레벨을 `lives-wall` 로 보고한다

#### Scenario: 범위 안 하드 레벨은 `lives.cap` 5 에서 벽이 아니다
- **WHEN** 첫 시도 클리어율이 약 0.25 인 하드 레벨을 `lives.cap` 5 로 잰다
- **THEN** `lives-wall` 이 없다

#### Scenario: 목숨 3개면 중반 하한 근처 레벨이 벽이다
- **WHEN** 첫 시도 클리어율이 약 0.45 인 `mid` 레벨을 `lives.cap` 3 으로 잰다
- **THEN** `lives-wall` 을 보고한다

#### Scenario: 0 이하 목숨은 목숨 없음
- **WHEN** `lives.cap` 이 0 이다
- **THEN** 오류 없이 `livesOutRate` 가 `null` 이고 `unmeasured` 에 `lives` 가 있다

#### Scenario: 약한 이어하기
- **WHEN** `continueOffer` 가 주어지고 실패 판이 50 이상이며 구제율이 `minContinueSave` 미만이다
- **THEN** 그 레벨을 `continue-weak` 로 보고한다

#### Scenario: 실패가 적으면 이어하기를 재지 않는다
- **WHEN** `continueOffer` 가 있고 실패 판이 50 미만이다
- **THEN** `continueSaveRate`·`continueCostPerClear` 가 `null` 이고 `continue-weak` 가 없다

#### Scenario: 경계 레벨 표시
- **WHEN** 중반 레벨의 첫 시도 클리어율이 하한 0.4 에서 2σ 안이다
- **THEN** 그 레벨의 `borderline` 이 `true` 이고, 범위 한가운데 레벨은 `false` 다

#### Scenario: 넘을 수 없는 경계는 보지 않는다
- **WHEN** 초반 레벨의 클리어율이 정확히 1 이다(상한 1.0)
- **THEN** `borderline` 이 `false` 다

#### Scenario: 빈 레벨 목록
- **WHEN** `levels` 가 빈 배열이다
- **THEN** 오류 없이 `levels` 가 비고, 위반이 없으며, `unmeasured` 에 `levels` 가 있다

#### Scenario: 재지 않은 축
- **WHEN** `lives`·`continueOffer` 없이 잰다
- **THEN** `unmeasured` 가 `lives`·`continue` 를 담고 해당 지표는 `null` 이다

#### Scenario: 기준 없는 장르
- **WHEN** 프로파일에 `retry` 가 없다
- **THEN** 레벨 지표는 내고 위반에 `level` 없는 `no-baseline` 한 항목을 싣는다

#### Scenario: CLI 종료 코드
- **WHEN** CLI 에 위반이 생기는 레벨을 주고, 따로 깨진 JSON 을 준다
- **THEN** 앞은 결과 JSON 과 종료 코드 0, 뒤는 stderr 사유와 종료 코드 1 이다

#### Scenario: 잘못된 입력
- **WHEN** 다음 중 하나다
  - `levels` 가 배열이 아니다
  - 레벨의 `moves` 가 1~1000 정수가 아니거나, `goal` 이 유한한 양수가 아니거나, `progress` 가 유한한 `0 ≤ min ≤ max` 가 아니다
  - 레벨 키(`id ?? name`)가 비었거나 겹치거나, `tier` 가 `early·mid·hard` 밖이다
  - 목숨이 있는데 `lives.cap` 이 정수가 아니다
  - `continueOffer.moves` 가 1~1000 정수가 아니거나 `price` 가 유한한 0 이상이 아니다
  - 레벨 수 × `trials` × (`moves` + 이어하기 `moves`) 가 2×10^8 을 넘는다
  - 프로파일 `retry` 의 키가 빠졌거나, `trials` 가 1~100000 정수가 아니거나, `attempts`·`minContinueFailures` 가 양의 정수가 아니거나, `earlyLevels` 가 0 이상 정수가 아니거나, `tiers` 에 세 티어가 다 있지 않거나, 범위가 `0 ≤ lo ≤ hi ≤ 1` 이 아니거나, `maxLivesOut`·`minContinueSave` 가 0~1 밖이다
- **THEN** 사유를 포함한 오류를 발생시킨다

#### Scenario: 한글 키의 시드는 고정값이다
- **WHEN** `mixSeed(1, "레벨1")` 을 계산한다
- **THEN** UTF-8 바이트 FNV-1a 와 fmix32 정의로 계산한 고정값과 같다

### Requirement: 1회 한정 첫 구매 상품을 판정해야 한다
<!-- id: balanceSim.starterOffer -->
<!-- entities: Economy, Product -->
<!-- enforced: plugins/nereus-game/lib/starter-offer.mjs -->

시스템은 상점 상품 목록을 받아 다음을 보고해야 한다(유료 = `price > 0`). 상품의 `currency` 기본값은 `"real"` 이고, 가격 비교는 스타터와 같은 `currency` 상품끼리만 한다.

- `starter-missing` — 현금(`currency: "real"`) 유료 상품이 있는데 `starter: true` 가 없음
- `starter-duplicate` — `starter: true` 가 둘 이상
- `starter-not-one-time` — 스타터에 `oneTime: true` 가 없음
- `starter-not-cheapest` — 스타터보다 싼 유료 상품이 있음
- `starter-replaced-pricier` — 스타터의 `replacedBy` 사슬에 스타터보다 비싼 상품이 있음

`valueRatio` = (스타터 value/price) ÷ (스타터와 같은 `currency` 의 다른 유료 상품 value/price 의 중앙값, 짝수 개면 가운데 둘의 평균)를 지표로 낸다
(스타터가 정확히 하나가 아니거나, 무료거나, value·비교 상품이 없으면 `null`).
정적 데이터 검사이며 `simulate()` 에 배선하지 않는다. CLI(`starter-offer.mjs`)의 종료 코드 규칙은 재시도 CLI 와 같다.
sku 중복, 없는 sku 를 가리키는 `replacedBy`, 순환하는 교체 사슬은 사유를 포함한 오류를 발생시킨다.

#### Scenario: 스타터 없음
- **WHEN** 유료 상품은 있는데 `starter: true` 가 없다
- **THEN** `starter-missing` 을 보고한다

#### Scenario: 유료 상품 없음
- **WHEN** 유료 상품이 하나도 없다
- **THEN** 위반이 없다

#### Scenario: 스타터 둘
- **WHEN** `starter: true` 상품이 둘이다
- **THEN** `starter-duplicate` 를 보고한다

#### Scenario: 1회 한정이 아님
- **WHEN** 스타터에 `oneTime: true` 가 없다
- **THEN** `starter-not-one-time` 을 보고한다

#### Scenario: 스타터가 여럿이면 각각 판정
- **WHEN** 스타터가 둘이고 그중 하나만 `oneTime: true` 가 없다
- **THEN** `starter-duplicate` 와, 그 하나에 대한 `starter-not-one-time` 을 보고한다

#### Scenario: 가장 싸지 않음
- **WHEN** 스타터보다 싼 유료 상품이 있다
- **THEN** `starter-not-cheapest` 를 보고한다

#### Scenario: 더 비싼 상품으로 교체
- **WHEN** 스타터의 `replacedBy` 가 스타터보다 비싼 상품을 가리킨다
- **THEN** `starter-replaced-pricier` 를 보고한다

#### Scenario: 교체의 교체가 더 비쌈
- **WHEN** 스타터가 같은 가격 상품으로, 그 상품이 더 비싼 상품으로 교체된다
- **THEN** `starter-replaced-pricier` 를 보고한다

#### Scenario: 같은 가격 교체
- **WHEN** 스타터의 `replacedBy` 가 같은 가격 상품을 가리키고 사슬이 거기서 끝난다
- **THEN** `starter-replaced-pricier` 가 없다

#### Scenario: 잘못된 상점 데이터
- **WHEN** sku 가 겹치거나, `replacedBy` 가 없는 sku 이거나, 교체 사슬이 순환한다
- **THEN** 사유를 포함한 오류를 발생시킨다

#### Scenario: 다른 재화 상품과는 가격을 비교하지 않는다
- **WHEN** 현금 스타터보다 가격 숫자가 작은 `currency: "gems"` 상품이 있다
- **THEN** `starter-not-cheapest` 를 보고하지 않는다

#### Scenario: 정상 스타터
- **WHEN** 하나뿐인 1회 한정 스타터가 가장 싸고 교체가 없다
- **THEN** 위반이 없고 `valueRatio` 를 낸다

## MODIFIED Requirements

### Requirement: 밸런싱은 결정론적 시뮬레이터로 수치를 내야 한다
<!-- id: balanceSim.run -->
<!-- entities: Profile, Economy -->
<!-- enforced: plugins/nereus-game/lib/balance-sim.mjs -->

시스템은 경제 정의(수입원·비용·성장 계수)와 장르 프로파일을 입력받아 N턴을 돌리고,
턴별 보유 자원과 **인플레율 · 병목 단계 · 이탈 예상 구간**을 수치로 돌려주어야 한다.
같은 입력에 같은 출력이어야 한다(난수를 쓰면 시드를 입력으로 받는다) — 그래야 게이트로 쓸 수 있다.
경제 정의의 `levels` 가 `undefined` 가 아니면(빈 배열 포함, `null` 등 배열이 아닌 값은 오류) `measureRetry`(위 ADDED `balanceSim.retry`)를 `economy.levels`·`economy.lives`·`economy.continueOffer`·시드로 불러 `summary.retry` 로 덧붙인다.
그 호출의 입력 오류는 그대로 던진다. 기존 summary 키와 값은 `levels` 유무와 무관하게 같다.

#### Scenario: 같은 입력은 같은 출력
- **WHEN** 동일한 경제 정의와 시드로 두 번 돌린다
- **THEN** 두 결과가 완전히 같다

#### Scenario: 병목 탐지
- **WHEN** 어떤 단계의 비용이 그 시점 수입으로 도달 불가능하다
- **THEN** 그 단계를 병목으로 보고한다

#### Scenario: 인플레 탐지
- **WHEN** 턴당 수입 증가율이 비용 증가율을 지속적으로 앞지른다
- **THEN** 인플레율을 양수로 보고한다

#### Scenario: 재시도 측정 배선
- **WHEN** 경제 정의에 `levels` 가 있다
- **THEN** `summary.retry` 는 같은 `levels`·`lives`·`continueOffer`·시드로 부른 `measureRetry` 결과와 같고, 나머지 summary 키는 `levels` 를 뺀 실행과 같다

#### Scenario: 레벨 없는 경제
- **WHEN** 경제 정의에 `levels` 키가 없거나 `undefined` 다
- **THEN** `summary` 에 `retry` 키가 없다

#### Scenario: 잘못된 레벨은 시뮬레이터에서도 오류
- **WHEN** 경제 정의의 `levels` 에 `moves` 가 0 인 레벨이 있거나, `levels` 가 `null` 이다
- **THEN** `simulate()` 가 사유를 포함한 오류를 발생시킨다
