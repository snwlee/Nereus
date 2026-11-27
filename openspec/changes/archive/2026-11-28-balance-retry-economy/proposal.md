# 캐주얼 퍼즐 재시도 경제와 첫 구매 상품 판정 (balance-retry-economy)

태스크: [tasks.md](tasks.md) · 스펙 델타: [specs/game-harness/spec.md](specs/game-harness/spec.md)

## Problem

`nereus-game:balance` SKILL.md 의 "시뮬레이터가 아직 재지 않는 것" 절은 목숨(수명·에너지라고도 부르는 시도 횟수 자원) 고갈로 세션이 끊기는 실패가
시뮬레이터의 세 축(병목·절벽·지배 전략) 어디에도 없고, 퍼즐은 "수명·재시도 경제를 따로 판정"하라고 적고 있다.
이동 수 제한 레벨의 재시도 경제를 판정하는 데 필요한 다음 지표는 숫자가 없다.

- 첫 시도 클리어율
- 몇 번째 시도까지의 누적 클리어율
- 목숨 한 줄 안에서 클리어하는지
- 이어하기의 구제율

`simulate()` 에는 `economy.lives`(소비·턴 회복·`blocked`) 구조가 이미 있지만 턴 단위 진행 모델이라 레벨 클리어율을 재지 않고, summary 에도 나오지 않는다.
수익화 쪽에는 "1회 한정 첫 구매 상품" 판정이 없다.

근거: GameFactory 저장소 `docs/research/2026-11-27-game-basics-reels.md` 의 후보 B5(레벨별 승률 측정)·B10(1회 한정 첫 구매 상품)과
E절("balance 가 재시도 경제를 재지 않는다"). 이 문서의 B·X 번호는 그 노트의 후보 번호다(B3 동적 난이도, B4 난이도 값의 데이터화, X2 확률 천장, X4 개인화 가격).
그 노트의 원 출처는 사실 확인이 안 된 편집 영상이다. 그래서 특정 게임이 이렇게 한다는 서술은 넣지 않는다.
B10 의 내용 — 첫 결제 문턱을 낮추는 상품은 하나·한 번이고, 산 뒤 그 자리를 더 비싼 상품으로 교체하지 않는다 — 은
측정된 사실이 아니라 채택된 설계 규칙이다. 재시도 판정의 기본 수치도 검증된 기준이 아니라 잠정값이다.

## Goals

- B5: 이동 수 제한 레벨 목록을 시드 고정으로 돌려 레벨별 클리어율·목숨 지표·이어하기 지표를 잰다.
- 장르 프로파일 `retry` 기준으로 판정한다. 범위를 벗어나는 두 방향을 따로 보고한다:
  `retry-cliff`(티어 범위보다 어려움 — 난이도 절벽), `retry-too-easy`(티어 범위보다 쉬움 — 난이도 인플레).
- B10: 상점 데이터에서 1회 한정 스타터 상품을 판정한다.
- `simulate()`(`balanceSim.run`)는 `economy.levels` 가 `undefined` 가 아니면 `summary.retry` 를 덧붙인다. 기존 summary 키·값은 그대로다(가산 변경).

산출물:

- 새 모듈 `lib/seeded-random.mjs`·`lib/retry-economy.mjs`·`lib/starter-offer.mjs`
- `profiles/casual-puzzle.json` 의 `retry` 블록과 `balance.note` 갱신(잠정값임을 적는다)
- balance SKILL.md: "아직 재지 않는 것" 절을 재시도·스타터 절로 교체하고 회복 시간 축만 남긴다. 비통과 세 경우(`no-baseline`, 비어 있지 않은 `unmeasured`, `null` 지표)를 통과로 읽지 않는다고 적는다
- 샘플 레벨 파일 `skills/balance/assets/puzzle-levels.sample.json`
- nereus-game 패치 버전

## Non-Goals

- 동적 난이도·레벨 스키마 설계는 `nereus-game:level`, 사용자별 가격·확률 천장은 `nereus-game:compliance` 가 다룬다.
- 같은 시기 다른 작업이 고치는 스킬(craft·level·gameux·liveops·compliance·adpolicy)의 파일은 건드리지 않는다.
- 플레이어 실력 분포. 한 판의 운(판 배치)만 모델링한다. 실력 분포는 보정할 출처가 없는 입력이다. 실력 차가 있으면 `livesOutRate` 는 실제보다 작게, `cumulativeWinRate` 는 크게 나온다(Risks).
- 목숨 회복 시간. 재시도 판정은 가득 찬 목숨 한 줄(`cap`)만 본다. `lives.regenTurns` 는 재시도 판정에서 무시한다.
- 런타임 상점 동작 증명. 스타터 판정은 정적 데이터 검사다.

## Interface

### 재시도 측정 (`measureRetry`)

#### 입력

`measureRetry({ profile, levels, lives?, continueOffer?, seed = 1 })`. `simulate()` 는 `economy.levels`·`economy.lives`·`economy.continueOffer` 와 자신의 `seed`(기본 1)를 넘긴다.
검증을 어기면 사유를 포함한 오류를 발생시킨다.

| 키 | 형태 | 검증 |
|---|---|---|
| `levels` | 배열 | 배열이 아니면 오류. 빈 배열은 오류가 아니지만 잰 것이 없으므로 `unmeasured` 에 `"levels"` 를 싣는다 |
| `levels[]` | `{ name, id?, moves, goal, progress:[min,max], tier? }` | 키 `id ?? name` 은 비지 않은 고유 문자열. `moves` 1~1000 정수. 레벨 수 × `trials` × (`moves` + 이어하기 `moves`) ≤ 2×10^8. `goal` 유한한 양수. `0 ≤ min ≤ max` 유한(같으면 결정적 레벨). `tier` ∈ `early·mid·hard` |
| `lives` | `{ cap, regenTurns? }` | `simulate()` 와 같은 해석: `cap` 이 유한한 양수면 목숨 있음, 아니면(없음·0 이하) 목숨 없음. 목숨이 있으면 `cap` 은 정수 |
| `continueOffer` | `{ moves, price }` | `moves` 1~1000 정수, `price` 유한한 0 이상(게임 재화 단위 그대로) |
| `seed` | 수 | 검증하지 않고 `simulate()`·`lcg` 와 같이 `(Number(seed) || 1) >>> 0` 으로 읽는다. 1.2 와 1.7 은 같은 시드다 |
| `profile.retry` | 아래 기본값의 모든 키가 필수(빠지면 오류) | `trials` 1~100000 정수, `attempts`·`minContinueFailures` 양의 정수, `earlyLevels` 0 이상 정수(0 = 위치로 정하는 초반 레벨 없음). `tiers` 는 `early`·`mid`·`hard` 셋을 모두 가진다. 각 `firstTry` 는 `0 ≤ lo ≤ hi ≤ 1`, `maxLivesOut`·`minContinueSave` 는 0~1 |

`simulate()` 는 `economy.levels` 가 `undefined` 가 아니면 `measureRetry` 를 부른다 — `null` 을 포함해 배열이 아닌 값을 조용히 무시하지 않고 오류로 던진다.
키가 없거나 `undefined` 인 호출의 동작은 그대로다.
목숨 단위: 재시도 판정에서 목숨 1 = 실패한 시도 1 이다. `simulate()` 의 턴 루프에서 목숨 1 = 시도한 턴 1 이다. 같은 `cap` 을 두 모델이 다른 단위로 쓴다(SKILL.md 에 적는다).

#### 판 모델

레벨의 시드 `s = mixSeed(seed, id ?? name)`. 기본 판 난수열은 `lcg(s)`, 이어하기 난수열은 `lcg(mixSeed(s, "continue"))` 로 따로 둔다.
판 하나는 기본 난수열에서 항상 정확히 `moves` 개를 뽑아(일찍 클리어해도 남은 수를 뽑는다) `[min,max]` 균등분포 진척으로 더하고, 합이 `goal − 1e-9` 이상이면 클리어다(소수 진척의 부동소수 누적 오차 허용).
`continueOffer` 가 있고 실패했으면 이어하기 난수열에서 `continueOffer.moves` 개를 더 뽑아 같은 합 위에 더한다. 판당 이어하기는 최대 한 번.
그래서 `continueOffer` 유무는 기본 판 결과를 바꾸지 않는다. 레벨마다 판 `trials` 개를 돌린다.
이 모델은 판 배치 운이 결과를 좌우하는 장르(무작위 리필 매치-3 등)에 맞는다. 고정 판 퍼즐(라인·물리)은 재시도 결과가 강하게 상관되어 맞지 않는다.

#### 지표

p = 이어하기 없이 클리어한 판 / 전체 판. f = 실패한 판 수. q = 실패한 판 중 이어하기로 클리어한 비율.

| 지표 | 공식 | `null` 조건 · 해석 |
|---|---|---|
| `firstTryWinRate` | p | |
| `cumulativeWinRate[n-1]` | 1 − (1−p)^n, n = 1..`attempts` | 시도를 독립으로 본다 |
| `expectedLivesPerClear` | (1−p)/p | p = 0 이면 `null`. 이어하기를 사지 않는 플레이어 기준 |
| `livesOutRate` | (1−p)^cap | 목숨 없으면 `null`. 목숨을 가득 채우고 이 레벨에 들어와 한 줄을 다 쓰고도 클리어하지 못할 확률. 레벨 사이에 목숨이 이어지는 세션 단위 끊김은 재지 않으므로 세션 벽의 하한으로 읽는다 |
| `continueSaveRate` | q | `continueOffer` 없거나 f < `minContinueFailures`(기본 50) 이면 `null`. f = 50, q ≈ 0.3 의 표준오차가 약 6.5%p 라 그 아래는 재지 않는다. `trials` 2000 이면 p > 0.975 인 레벨이 해당한다 |
| `continueCostPerClear` | price × (1−p) / (p + (1−p)q) | `continueSaveRate` 가 `null` 이거나 분모 0 이면 `null`. 실패마다 이어하기를 사는 플레이어 기준이라 상한 쪽 값이다. 판정에 쓰지 않는 정보 지표다(재화 수입과 비교할 단위가 이 입력에 없다) |
| `borderline` | 티어 `firstTry` 의 하한·상한 각각에 대해 \|p − 경계\| ≤ 2σ 이면 `true`, σ = √(p(1−p)/trials). 하한 0·상한 1 은 보지 않는다 | 정보 필드(위반 아님). 기준 없으면 `false` |

수치는 소수 넷째 자리로 반올림한다.

#### 판정

티어는 레벨의 `tier` 가 우선이고, 없으면 목록 앞 `earlyLevels` 개는 `early`, 나머지는 `mid` 다. 범위는 양 끝을 포함한다.

| 위반 | 조건 |
|---|---|
| `retry-cliff` | p < 티어 `firstTry` 하한 |
| `retry-too-easy` | p > 티어 `firstTry` 상한. 기본값의 `early` 는 상한이 1.0 이라 발생하지 않는다 |
| `lives-wall` | `livesOutRate` > 티어 `maxLivesOut` |
| `continue-weak` | `continueSaveRate` < `minContinueSave`. `null` 이면 판정하지 않는다. 너무 강한 이어하기는 판정하지 않는다 |
| `no-baseline` | 프로파일에 `retry` 가 없다. 레벨과 무관한 한 항목 `{ code, why }`. 지표는 기본 trials 2000·attempts 5·minContinueFailures 50·`borderline: false` 로 낸다 |

레벨 위반은 `{ code, level, value, range | limit, why }` 다(`retry-cliff`·`retry-too-easy` 는 `range`, 나머지는 `limit`).
`no-baseline` 을 위반에 싣는 것은 `economy-curve.mjs` `checkPacing` 을 따른 것이고(거기에 `why` 를 더했다), 기준이 없는 장르가 위반 없음으로 읽히지 않게 하려는 것이다.
`borderline` 은 클리어율 경계만 본다 — 시드·`id` 를 바꾸면 `retry-cliff`·`retry-too-easy` 가 뒤집힐 수 있는 레벨을 드러낸다. `lives-wall`·`continue-weak` 경계는 보지 않는다.
티어 위치 규칙은 `tier` 를 적은 레벨도 목록 위치에 넣어 센다(앞 `earlyLevels` 개는 위치로 정한다).

#### 출력

```
{ levels: [{ name, tier, firstTryWinRate, cumulativeWinRate, expectedLivesPerClear, livesOutRate,
             continueSaveRate, continueCostPerClear, borderline }],
  violations: [...],
  unmeasured: string[] }   // 입력이 없어 재지 않은 축: "levels"(빈 배열) · "lives" · "continue"
```

#### 프로파일 기본값 (`casual-puzzle` 만 선언, 잠정값)

```json
"retry": {
  "trials": 2000, "attempts": 5, "earlyLevels": 10, "minContinueFailures": 50,
  "tiers": {
    "early": { "firstTry": [0.8, 1.0], "maxLivesOut": 0.01 },
    "mid":   { "firstTry": [0.4, 0.6], "maxLivesOut": 0.1 },
    "hard":  { "firstTry": [0.15, 0.35], "maxLivesOut": 0.5 }
  },
  "minContinueSave": 0.3
}
```

티어 하한 클리어율에서 계산한 `livesOutRate`:

| 티어(하한 p) | cap 5 | cap 3 |
|---|---|---|
| early (0.8) | 0.2^5 ≈ 0.0003 ≤ 0.01 | 0.2^3 = 0.008 ≤ 0.01 |
| mid (0.4) | 0.6^5 ≈ 0.078 ≤ 0.1 | 0.6^3 ≈ 0.216 > 0.1 → `lives-wall` |
| hard (0.15) | 0.85^5 ≈ 0.444 ≤ 0.5 | 0.85^3 ≈ 0.614 > 0.5 → `lives-wall` |

cap 5 에서 `lives-wall` 이 나는 클리어율(mid p < 0.369, hard p < 0.129)은 이미 `retry-cliff` 영역이다. 그래서 기본값에서 `lives-wall` 은
cap 이 4 이하이거나 게임이 티어 기준을 덮어쓸 때 따로 의미가 생긴다. cap 3 이면 mid p < 0.536, hard p < 0.206 이 `lives-wall` 이다(mid 범위의 약 68%, hard 범위의 약 28%).
그때는 해당 레벨의 클리어율을 올리거나 cap 을 5 이상으로 올린다.

#### CLI

`node plugins/nereus-game/lib/retry-economy.mjs` 가 stdin `{ genre, retry?, levels, lives?, continueOffer?, seed? }` 를 받아 `measureRetry` 결과 JSON 을 stdout 에 낸다.
`retry` 를 주면 장르 프로파일의 `retry` 를 통째로 대신한다(게임별 기준 덮어쓰기, 같은 검증). JS 에서는 `profile` 객체의 `retry` 를 바꿔 넘긴다.
입력 오류·모르는 장르는 `cli-input.mjs` 의 `runCli` 관례대로 사유를 stderr 에 내고 종료 코드 1. 위반이 있어도 종료 코드는 0 이다.
이 저장소의 검사기 CLI(`economy-curve.mjs` 등)와 같은 방식이다. 게이트가 필요하면 SKILL.md §6 처럼 태스크 완료 조건에 "`violations` 가 비어 있다"를 적는다.

### 스타터 판정 (`checkStarterOffer`)

#### 입력

`checkStarterOffer({ shop })`, `shop.products[]` = `{ sku, price, currency?, value?, oneTime?, starter?, replacedBy? }`. `simulate()` 에는 배선하지 않는다.
`currency` 기본값은 `"real"`(현금 결제). 가격 비교(`starter-not-cheapest`·`starter-replaced-pricier`·`valueRatio`)는 스타터와 같은 `currency` 상품끼리만 한다 — 소프트 재화 상품과 현금 상품의 가격은 비교할 수 없다.
검증(어기면 사유를 포함한 오류): `products` 배열, `sku` 고유, `price` 유한한 0 이상, `replacedBy` 는 있는 sku, 교체 사슬에 순환 없음. 유료 = `price > 0`.

#### 위반

| 위반 | 조건 |
|---|---|
| `starter-missing` | 현금(`currency: "real"`) 유료 상품이 있는데 `starter: true` 가 없다 |
| `starter-duplicate` | `starter: true` 가 둘 이상 |
| `starter-not-one-time` | 스타터에 `oneTime: true` 가 없다 |
| `starter-not-cheapest` | 스타터보다 싼 유료 상품이 있다(무료 스타터는 해당 없음) |
| `starter-replaced-pricier` | 스타터의 `replacedBy` 사슬(교체의 교체까지)에 스타터보다 비싼 상품이 있다 |

같은 가격·더 싼 교체는 허용한다 — 문턱이 올라가지 않는다. 스타터가 둘 이상이면 아래 세 검사를 스타터마다 따로 한다.

#### 지표

`metrics = { starterSku, valueRatio }`. `valueRatio` = (스타터 value/price) ÷ (스타터를 뺀 유료 상품 value/price 의 중앙값, 짝수 개면 가운데 둘의 평균).
스타터가 정확히 하나가 아니거나, 스타터·비교 상품에 value 가 없거나, 비교 상품이 없거나, 스타터가 무료면 `null`. 판정에 쓰지 않는 판단 재료다.

#### CLI

`node plugins/nereus-game/lib/starter-offer.mjs` 가 stdin `{ shop }` 을 받아 결과 JSON 을 낸다. 종료 코드 규칙은 재시도 CLI 와 같다.

## Proposed Architecture

### 모듈과 데이터 흐름

```text
levels·lives·continueOffer ─┐
profile.retry ──────────────┼─► retry-economy.measureRetry ─► { levels, violations, unmeasured }
seed ─► seeded-random.mixSeed(seed, id ?? name) ─► lcg ─┘           │
                                                                     ├─► CLI (stdin → stdout)
economy(…, levels) ─► balance-sim.simulate ─► summary.retry ◄────────┘
shop ─► starter-offer.checkStarterOffer ─► { violations, metrics } ─► CLI
```

`seeded-random.mjs` 는 `lcg`(balance-sim 에서 코드 변경 없이 옮김)와 `mixSeed` 를 낸다. balance-sim 과 retry-economy 가 둘 다 쓴다.
retry-economy 는 balance-sim 을 import 하지 않는다(순환 없음). 규범은 스펙 델타(`specs/game-harness/spec.md`)이고, Interface 절은 그 계약을 근거와 함께 풀어 쓴 것이다. 둘이 어긋나면 스펙 델타가 이긴다.

### 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 측정 방식 | 시드 고정 몬테카를로(레벨당 판 `trials` 개) | 판 모델에 묶이지 않는다. 표본은 판 모델을 보드 규칙·봇으로 바꿔도 같은 인터페이스·같은 지표 정의로 남는다. 대가는 표본 오차이고, 같은 시드면 결과가 같아 게이트로 쓸 수 있으며 경계 레벨은 `borderline` 으로 드러난다 |
| 표본 수 | 기본 2000판 | 표준오차 √(p(1−p)/n): p = 0.5, n = 2000 이면 약 1.1%p, n = 400 이면 약 2.5%p. 비용은 레벨 수 × trials × (moves + 이어하기 moves) 번의 난수 — 레벨 100·수 35 면 700만 번. 실측은 구현 후 PR 에 적는다 |
| `progress` 의 정체 | 설계자가 보정하는 입력 | 시뮬은 입력값(이동 수·목표)과 클리어율의 관계를 낸다. 실제 판을 잰 것이 아니다 |
| 레벨별 시드 | `mixSeed(seed, key)` | 레벨 삽입·삭제·순서 변경에도 다른 레벨의 지표가 그대로다 |
| `mixSeed` 알고리즘 | 키 문자열의 **UTF-8 바이트** FNV-1a 32비트 해시와 seed 를 XOR 한 뒤 MurmurHash3 의 마무리 섞기(fmix32). 결과가 0 이면 `0x9e3779b9` | 정의를 고정해야 지표가 구현마다 같다. 레벨 이름이 한글이라 인코딩을 못박는다 |
| 시드를 그대로 쓰지 않음(대안: 시드를 레벨마다 그대로) | 해시로 섞는다 | 선형합동생성기(LCG, `s ← 1664525·s + 1013904223 mod 2^32`)는 연속 시드의 첫 값 차이가 1664525/2^32 ≈ 0.0004 라 레벨끼리 상관된다. `lcg(0)` 은 1 로 바뀌어 seed 1 과 겹친다. 한계: LCG 는 주기 2^32 의 한 고리라 레벨 난수열은 그 고리의 창이다. 레벨당 추출이 7만 번(2000판 × 35수)이면 레벨 100개 중 어떤 두 창이 겹칠 확률이 약 15% 다. 겹친 두 레벨은 같은 수열 일부를 공유하지만 각 레벨의 추정은 여전히 편향이 없다 |
| 이어하기 난수열 분리 | 기본 판과 다른 난수열 | 같은 열을 쓰면 `continueOffer` 를 주는 것만으로 뒤 판들의 p 가 바뀐다 |
| 지표 안정성의 범위 | 삽입에 안정한 것은 지표다 | 티어 기본값은 위치(`earlyLevels`)라 앞에 끼워 넣으면 판정이 바뀔 수 있다. 긴 목록은 레벨마다 `tier` 를 적으라고 SKILL.md 에 적는다 |
| 목숨 판정 | 꼬리 `(1−p)^cap` 를 티어 상한과 비교 | 평균 `(1−p)/p`(횟수)와 상한(확률)은 단위가 달라 비교할 수 없다. 세션은 연속 실패에서 끊긴다 |
| 이어하기와 목숨 | 목숨 지표는 이어하기 없이, 이어하기 지표는 따로 | 벽은 사지 않는 플레이어 기준으로 판정한다. 사는 플레이어에게 벽인지는 이 판정 밖의 수익화 질문이다 |
| 스타터 배선 | `simulate()` 에 붙이지 않는다 | 턴·자원과 무관한 정적 검사다. 붙이면 상관없는 두 판정이 한 출력에 묶인다 |
| 스타터가 balance 소속 | 경제 데이터 검사로 둔다 | 상품 목록의 가격·가치만 보고 사용자 데이터·구매 이력·확률을 다루지 않는다. 같은 SKU 가격을 사용자 이력으로 바꾸는지(X4)는 사용자 상태를 보는 검사라 compliance 에 둔다 |

## Alternatives Considered

| 안 | 버린 이유 |
|---|---|
| 레벨에 클리어율을 직접 입력 | 입력값(이동 수·목표)과 클리어율의 관계가 사라진다. `progress` 도 입력이지만 레벨별 결과가 아니라 판 모델의 보정값이다 |
| 정확 계산(안정한 B-스플라인 점화식·이산 합성곱) 또는 정규 근사 | 지금 모델에는 쓸 수 있다(순진한 Irwin–Hall 교대합은 U(0,1) 합에서 n = 100 일 때 P(S ≤ 0.55n) 이 30206, n = 200 은 NaN 으로 깨지지만 안정한 점화식이 있다). 버린 이유는 판 모델 종속이다 — 보드 규칙·봇 모델에는 해석적 해가 없어 그때 지표 정의가 정확값에서 추정값으로 바뀐다. 정규 근사는 수가 적은 레벨의 꼬리에서 틀린다 |
| 지금은 정확 계산, 판 모델을 바꿀 때 표본으로 | 같은 지표의 정의가 판 모델에 따라 정확값/추정값으로 바뀌어, 바꾸는 날 모든 레벨 판정이 한꺼번에 움직인다 |
| 신뢰 구간(Wilson)으로 판정 | 판정 규칙이 두 겹이 된다. 대신 `borderline` 정보 필드로 경계 레벨을 드러낸다 |
| `casual-puzzle` 의 `failureMode` 를 새 축으로 교체 | `failureMode: "cliff"` 는 곡선 절벽 판정이 쓰는 값이고, 재시도는 그와 별개로 덧붙는 축이다 |
| 실력 층(약·중·강) 분포 | Non-Goals 참조 |
| 상점 슬롯 모델(`slot`·`unlockAfter`)로 교체를 유도 | 스키마가 커지고 쓰는 곳이 없다. 정적 검사의 한계를 문서에 적는다 |
| 스타터 가치가 낮으면 위반 | 문턱은 가격으로 낮춘다. 가치 배율은 지표로 둔다 |
| "하나·가장 쌈"을 권고(경고)로 낮춤 | 권고는 게이트가 아니어서, 첫 구매가 가장 싸지 않은 상점도 위반 없음으로 통과한다. 지역·세그먼트별 스타터는 세그먼트마다 상점 데이터를 따로 두고 각각 판정한다 |
| 위반 이름 `retry-inflation` | 기존 `summary.inflation`(수입이 비용을 앞지름)과 같은 단어라 보고서에서 경제 인플레로 읽힌다 |

## Risks & Limits

완화 열의 라벨: "기계"는 코드·테스트가 막는 것, "문서"는 SKILL.md 에 적는 것뿐, "범위 밖"은 다른 스킬·작업의 몫이다.

| 위험 | 영향 | 완화 |
|---|---|---|
| `progress` 오보정 | 모든 재시도 판정이 함께 틀린다. 판정을 맞추려 `progress` 를 조정하면 검사가 통과 근거로 쓸모없어진다 | 문서: `progress` 는 플레이테스트·텔레메트리의 레벨별 클리어율로 보정하고 그 출처를 적는다. 출처 없는 결과는 입력값 비교용으로만 읽는다 |
| 실력 동일 가정 | 실력 차가 있으면 한 번 실패한 플레이어는 약한 쪽일 가능성이 커서, 실제 `livesOutRate` 는 계산값보다 크고 실제 `cumulativeWinRate` 는 작다. 이 효과만 보면 계산값은 각각 하한·상한이다 | 문서: SKILL.md 에 그 방향으로 읽으라고 적고, `progress` 를 약한 층 기준으로 보정하라고 적는다 |
| 학습 무시 | 같은 플레이어가 재시도에서 나아지면 반대 방향이다. 두 효과의 합산 방향은 재지 않았다 | 문서: 위와 같은 곳 |
| 고정 판 퍼즐 | 라인·물리 퍼즐은 같은 판을 다시 하므로 운 모델이 맞지 않는다 | 문서: 판 모델 절의 적용 범위 |
| 회복 시간 미모델 | 목숨이 덜 찬 상태로 시작하는 세션·회복 대기를 보지 않는다 | 문서: SKILL.md 의 "아직 재지 않는 것" 에 남긴다 |
| 경계 레벨의 표본 오차 | 참 p 가 경계 근처인 레벨은 시드나 `id` 를 바꾸면 판정이 뒤집힐 수 있다. 시드를 바꿔 가며 초록을 고르는 것도 가능하다 | 기계: `borderline` 필드. 프로파일 `trials` 를 올릴 수 있다. 문서: 게이트의 시드는 태스크 완료 조건에 고정해 적는다 |
| 표시 없는 하드 레벨 | 중간중간 하드 레벨이 있는 목록에서 `tier` 를 안 적으면 하드 레벨마다 `mid` 기준 `retry-cliff` 가 난다 | 문서: SKILL.md 에 긴 목록은 레벨마다 `tier` 를 적으라고 적는다 |
| 잠정 기본값 | 범위·상한이 검증된 기준이 아니다 | 문서: 프로파일 note·SKILL.md 에 잠정값이라고 적고, 게임별로 덮어쓴다 |
| `mixSeed`·`lcg` 변경 | 모든 레벨 지표가 한꺼번에 바뀐다 | 기계: 한글 키 고정값 테스트, 같은 시드 회귀 테스트, 기존 `simulate()` 테스트 |
| 입력 크기 | 비용이 레벨 수 × trials × moves 에 비례한다 | 기계: `moves`·이어하기 `moves` ≤ 1000, `trials` ≤ 100000, 총 추출 ≤ 2×10^8 검증 |
| 신뢰할 수 없는 stdin | CLI 가 외부 JSON 을 읽는다 | 기계: CLI 는 `cli-input.mjs` 의 `readCliInput`(`JSON.parse`)으로만 입력을 해석하고 파일·프로세스를 열지 않는다(코드 리뷰 대상) |
| 스타터 정적 검사 | 데이터에 적히지 않은 런타임 교체·가격 변경은 잡지 못한다 | 범위 밖: 런타임 가격 규칙은 compliance |
