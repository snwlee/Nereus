---
name: balance
description: 게임 밸런싱 — 장르 프로파일 + 결정론적 시뮬레이터로 병목·인플레·난이도 절벽을 수치로 낸다. 트리거 "밸런스", "경제", "수치", "난이도".
---

# balance

nereus:common 규칙을 따른다. 담당 에이전트: economy-designer.
**엔진과 무관하다** — 로블록스든 Unity든 같은 절차다.

## 왜 시뮬레이터인가

밸런싱을 체크리스트로 하면 게이트가 사람 판단에 의존해 검증이 불가능해진다.
시뮬레이터는 결정론적이라 (1) 회귀 테스트가 성립하고 (2) 수식을 고쳤을 때 무엇이 달라졌는지 보이고
(3) finish 게이트가 "밸런스가 깨졌다"를 기계적으로 판정할 수 있다.

## 1. 장르 프로파일을 먼저 고른다

```js
import { loadProfile, listProfiles } from "../../lib/profiles.mjs";
const profile = loadProfile("casual-puzzle");
```

쓸 수 있는 장르는 `node plugins/nereus-game/lib/profiles.mjs` 로 확인한다. 지금 다섯이다:

| 프로파일 | 주 실패 양상 | 절벽 임계 |
|---|---|---|
| `sim-tycoon` | `bottleneck` | 8 |
| `narrative` | `pacing` | 6 |
| `battle-pvp` | `dominant-strategy` | 4 |
| `obby-platformer` | `cliff` | 3 |
| `casual-puzzle` | `cliff` | 2 |

임계가 장르마다 다르다는 것이 요점이다. 같은 곡선이 오비에서는 초록이고 퍼즐에서는 벽이다.

알 수 없는 장르는 **던진다**. 기본값으로 떨어지지 않는다 — 다른 장르로 밸런싱하면 수치가
그럴듯한 채로 틀리고, 그건 수치가 없는 것보다 나쁘다.

장르가 정하는 것: 핵심 루프(`loop`), 봐야 할 지표(`metrics`), **주 실패 양상**(`balance.failureMode`),
절벽 임계(`balance.cliffRatio`).

## 2. 경제를 데이터로 옮긴다

밸런싱 대상을 `{ income, stages }` 로 정규화한다. 이 형태로 못 옮기면 아직 설계가 안 끝난 것이다.

```js
const economy = {
  income: { base: 10, growth: 1.1 },          // 턴당 기본 수입과 증가 계수
  stages: [{ name: "1단계", cost: 50 }, { name: "2단계", cost: 300 }],
};
```

도메인별로 `stages` 가 뜻하는 것이 다르다 — 타이쿤은 업그레이드 단계, 오비는 구간,
전투는 파워 티어, 진행은 레벨 구간이다. 비용 축만 같으면 된다.

## 3. 돌린다

```js
import { simulate } from "../../lib/balance-sim.mjs";
const r = simulate({ profile, economy, turns: 60, seed: 1 });
```

`seed` 를 고정한다. 같은 입력이면 같은 출력이어야 게이트로 쓸 수 있다.

## 4. 결과를 읽는다

| 지표 | 뜻 | 대응 |
|---|---|---|
| `bottlenecks` | 시뮬 종료까지 **못 깬 단계 이름** | 그 단계 비용을 내리거나, 그 앞에 수입원을 추가한다. 타이쿤의 1순위 |
| `inflation` | 턴당 수입 증가율 − 턴당 비용 증가율 | 양수가 지속되면 후반이 무의미해진다. 비용 곡선을 가파르게 하거나 자원 싱크를 넣는다 |
| `cliffs` | 앞 단계 대비 비용 배수가 `cliffRatio` 를 넘는 단계 인덱스 | 중간 단계를 끼워 넣는다. 오비의 1순위 — 이탈이 여기서 난다 |
| `clearedStages` / `totalStages` | 도달률 | 목표 턴 안에 몇 단계까지 가는가 |

`primaryFailure` 가 `bottleneck` 이면 병목을, `cliff` 면 절벽을 먼저 본다. 장르가 정한다.

## 5. 도메인별 추가 점검

시뮬레이터가 못 보는 축은 사람이 본다. (출처: CCGS `balance-check` 의 판단 기준)

- **전투** — 티어별 DPS·처치 시간, 지배 전략(하나만 쓰면 되는 것)이 있는가
- **경제** — 수도꼭지와 배수구가 짝을 이루는가. 싱크 없는 파우셋은 반드시 인플레를 만든다
- **진행** — 데드존(아무 보상 없이 긴 구간)과 파워 스파이크가 의도된 것인가
- **루트** — 희귀도 분포, 천장(pity) 유무, 인벤토리 압박

## 6. 게이트

수치를 낸 것으로 끝내지 않는다. 기준을 태스크의 완료 조건에 적는다 —
예: "`bottlenecks` 가 비어 있고 `cliffs` 가 2개 이하". 기준 없는 수치는 판정이 아니다.

## 캐주얼 퍼즐 재시도 경제 — `casual-puzzle`

곡선(병목·절벽·지배 전략)만으로는 퍼즐 고유의 실패 — **목숨(수명·에너지)이 떨어져 세션이 끊긴다** — 가 안 잡힌다.
이동 수 제한 레벨 목록을 시드 고정으로 레벨마다 2000판 돌려 클리어율과 재시도 비용을 잰다.

```bash
node plugins/nereus-game/lib/retry-economy.mjs < plugins/nereus-game/skills/balance/assets/puzzle-levels.sample.json
```

입력은 `{ genre, retry?, levels, lives?, continueOffer?, seed? }`. 레벨은 `{ name, id?, moves, goal, progress:[min,max], tier? }` —
수마다 진척을 `[min,max]` 균등분포로 뽑아 더해 `moves` 안에 `goal` 에 닿으면 클리어다. JS 에서는 `measureRetry({ profile, levels, lives, continueOffer, seed })`,
`simulate()` 경제에 `levels` 를 넣으면 `summary.retry` 로 같은 결과가 붙는다.

| 지표 | 뜻 |
|---|---|
| `firstTryWinRate` | 이어하기 없이 첫 시도에 클리어할 비율 p |
| `cumulativeWinRate[n-1]` | n번째 시도까지 누적 클리어율 1 − (1−p)^n |
| `expectedLivesPerClear` | 클리어까지 잃는 목숨 평균 (1−p)/p |
| `livesOutRate` | 목숨을 가득 채우고 들어와 한 줄(`cap`)을 다 쓰고도 못 깰 확률 (1−p)^cap |
| `continueSaveRate` | 실패한 판 중 이어하기(`continueOffer.moves` 추가)로 구해지는 비율. 실패가 50판 미만이면 `null` |
| `continueCostPerClear` | 실패마다 이어하기를 사는 플레이어의 클리어당 지출(상한 쪽 값, 판정에 안 씀) |
| `borderline` | p 가 티어 범위 경계에서 2σ 안 — 시드·`id` 를 바꾸면 판정이 뒤집힐 수 있는 레벨 |

| 위반 | 뜻 | 대응 |
|---|---|---|
| `retry-cliff` | 첫 시도 클리어율이 티어 범위 아래 — 난이도 절벽 | 이동 수를 늘리거나 목표를 낮춘다 |
| `retry-too-easy` | 티어 범위 위 — 난이도 인플레, 재시도가 일어나지 않는다 | 하드로 표시한 레벨이 하드 노릇을 못 한다. 이동 수를 줄인다 |
| `lives-wall` | `livesOutRate` 가 티어 상한 초과 — 목숨 한 줄로 못 깨고 세션이 끊긴다 | 클리어율을 올리거나 `cap` 을 늘린다. 기본값에서는 `cap` 4 이하일 때 따로 의미가 생긴다 |
| `continue-weak` | 이어하기를 사도 구해지는 판이 `minContinueSave` 미만 | 이어하기 이동 수를 늘린다 |
| `no-baseline` | 프로파일에 `retry` 기준이 없다 | 지표만 났다. 통과가 아니다 |

티어별 목표 첫 시도 클리어율(`casual-puzzle` 의 `retry`, **잠정값** — 검증된 기준이 아니라 출발점이다):

| 티어 | 범위 | `maxLivesOut` |
|---|---|---|
| `early` (앞 `earlyLevels`=10 개, 표시 없을 때) | 0.8 ~ 1.0 | 0.01 |
| `mid` (그 뒤, 표시 없을 때) | 0.4 ~ 0.6 | 0.1 |
| `hard` (`tier: "hard"` 로 표시) | 0.15 ~ 0.35 | 0.5 |

게임마다 다르면 CLI 입력에 `retry` 를 통째로 주어 덮어쓴다(같은 검증).

자원과 오류:

- `assets/puzzle-levels.sample.json` — 샘플 레벨 세트 14개(초반 10·중반 2·하드 1·표시 없는 벽 1). 벽 레벨에서 `retry-cliff`·`lives-wall` 이 나는 것을 보여 준다. 새 게임의 레벨 파일을 이 모양으로 만든다.
- 잘못된 입력(배열이 아닌 `levels`, 1~1000 밖의 `moves`, 겹치는 레벨 이름, 빠진 `retry` 키, 총 추출 2×10^8 초과 등)은 사유를 담아 던진다. CLI 는 그 사유를 stderr 에 내고 종료 코드 1, 위반이 있어도 결과를 내고 종료 코드 0 이다.

**통과로 읽지 않는 것 세 가지**: `no-baseline`, 비어 있지 않은 `unmeasured`(재지 않은 축 — `levels`·`lives`·`continue`), `null` 지표.

읽는 법과 한계:

- `progress` 는 설계자가 넣는 보정값이다. 플레이테스트·텔레메트리의 레벨별 클리어율로 맞추고 출처를 적는다. 출처 없는 결과는 이동 수·목표 비교용으로만 읽는다.
- 실력 차가 있으면 한 번 실패한 플레이어는 약한 쪽일 가능성이 커서 실제 `livesOutRate` 는 계산값보다 크고 실제 누적 클리어율은 작다 — 계산값은 각각 하한·상한이다. 실력 차가 크면 `progress` 를 약한 층 기준으로 보정한다. 학습 효과는 반대 방향이다.
- 운 모델이라 무작위 리필 매치-3 류에 맞는다. 같은 판을 다시 하는 고정 판 퍼즐(라인·물리)에는 맞지 않는다.
- `livesOutRate` 는 레벨 단위다. 레벨 사이에 목숨이 이어지는 세션 단위 끊김의 하한으로 읽는다.
- 목숨 단위가 다르다: 재시도 판정은 목숨 1 = 실패한 시도 1, `simulate()` 턴 루프는 목숨 1 = 시도한 턴 1.
- 레벨이 많으면 레벨마다 `tier` 를 적는다. 안 적은 하드 레벨은 `mid` 기준에서 `retry-cliff` 로 잡힌다. 지표는 레벨 이름(`id ?? name`)으로 시드를 정해 레벨을 끼워 넣어도 그대로지만, 티어 기본값은 위치라 판정은 바뀔 수 있다.
- 게이트로 쓸 때는 태스크 완료 조건에 시드를 고정해 적는다 — 시드를 바꿔 가며 초록을 고르지 않는다.

## 1회 한정 첫 구매 상품 — 스타터

첫 결제 문턱을 낮추는 상품은 하나·한 번이고, 가장 싸며, 산 뒤 그 자리를 더 비싼 상품으로 교체하지 않는다(채택한 설계 규칙).

```bash
echo '{"shop":{"products":[
  {"sku":"starter","price":0.99,"value":500,"oneTime":true,"starter":true},
  {"sku":"small","price":1.99,"value":100}]}}' | node plugins/nereus-game/lib/starter-offer.mjs
```

| 위반 | 뜻 |
|---|---|
| `starter-missing` | 현금 유료 상품이 있는데 `starter: true` 가 없다 |
| `starter-duplicate` | 스타터가 둘 이상 |
| `starter-not-one-time` | 스타터에 `oneTime: true` 가 없다 |
| `starter-not-cheapest` | 스타터보다 싼 유료 상품이 있다 |
| `starter-replaced-pricier` | `replacedBy` 사슬(교체의 교체까지)에 스타터보다 비싼 상품이 있다. 같은 값·더 싼 교체는 괜찮다 |

가격 비교는 같은 `currency`(기본 `"real"`) 상품끼리만 한다. `valueRatio` 는 스타터의 가격당 가치가 다른 유료 상품 중앙값의 몇 배인지 — 판정이 아니라 판단 재료다.
정적 데이터 검사라 데이터에 적히지 않은 런타임 교체·가격 변경은 잡지 못한다. 사용자 이력으로 가격을 바꾸는지는 `nereus-game:compliance` 몫이다.

## 시뮬레이터가 아직 재지 않는 것

**목숨 회복 시간.** 재시도 판정은 가득 찬 목숨 한 줄만 본다. 목숨이 덜 찬 채 시작하는 세션과 회복 대기
(`lives.regenTurns`)는 `simulate()` 의 턴 루프가 소비·회복·`blocked` 를 기록할 뿐 판정하지 않는다. 재지 않은 것을 통과로 읽지 않는다.

## 하지 말 것

- 난수를 `Math.random` 으로 쓰지 않는다. 시드 기반만 쓴다.
- 알 수 없는 장르를 기본 프로파일로 대체하지 않는다.
- 시뮬 결과를 근거 없이 "괜찮아 보인다"로 넘기지 않는다. 임계를 먼저 정한다.

## 확률 아이템은 여기서 끝나지 않는다

경제 설계가 **유료 확률 아이템**(알·펫 뽑기, 상자, 스핀)을 만들면 `nereus-game:compliance` 로 넘긴다.
확률 공개는 **법적 요건**이라 밸런스 판단과 분리한다 — 밸런스는 우리가 정하고, 규정은 남이 정한다.

## 증분·방치형 페이싱 — `sim-tycoon`

시뮬레이터는 병목과 절벽을 본다. 타이쿤·클리커·방치형이 실제로 무너지는 곳은 그 사이다 —
"환생 6이 몇 주 걸린다", "레벨 50 가격이 레벨 0 의 6억 배다", "오프라인이 며칠치를 준다".
셋 다 **수입 없이 설정만으로** 계산되므로 시뮬레이션 전에 판정한다.

```bash
echo '{"genre":"sim-tycoon","config":{
  "upgrades":[{"id":"Income","baseCost":10,"costGrowth":1.15,"maxLevel":40}],
  "rebirth":{"baseRequirement":1e6,"requirementGrowth":1.8,"multiplierPerRebirth":0.5},
  "offline":{"maxHours":8,"efficiency":0.5},
  "peakBalance":1e12}}' | node plugins/nereus-game/lib/economy-curve.mjs
```

JS 에서는 `checkPacing({ profile, config })`. 기준은 프로파일의 `pacing` 이고 지금은 `sim-tycoon` 만 선언한다
(없는 장르는 `no-baseline` — 통과가 아니다).

| 위반 | 뜻 | 대응 |
|---|---|---|
| `rebirth-ratio` | 연속 환생 대기 비율이 범위(x1.2~x1.6) 밖 | 가산 배율이면 비율이 `requirementGrowth` 로 수렴한다 — 그 값이 곧 장기 비율이다. 낮추거나 곱셈 배율(`multiplierGrowth`, 비율 r/q 로 일정)로 바꾼다 |
| `steep-growth` | 여러 번(30+) 사는 업그레이드의 성장 계수가 1.15 초과 | 1.07~1.15. 드물게 사는 큰 업그레이드만 1.5~3 |
| `free-upgrade` | 가격 1 미만 | buy max 루프가 멈추지 않는다 |
| `offline-efficiency` · `offline-cap` | 효율 0.25~0.5 · 상한 8~12시간 밖 | 켜두는 쪽이 늘 낫게, 깨진 타임스탬프가 며칠치를 주지 않게 |
| `precision` | 최대 잔액이 1e15 초과 | 배정밀도 정수 한계(2^53). 가수·지수 쌍이나 log10 으로 저장한다 |

`unmeasured` 에 실린 축(`rebirth`·`offline`·`peakBalance`)은 재지 않은 것이다. 비어 있지 않으면 통과로 읽지 않는다.
큰 수 표기는 `formatNumber` — 반올림을 먼저 해야 `999950` 이 `1000.0K` 가 아니라 `1.0M` 이 된다.
엔진에서의 서버 구현(구매·환생·오프라인을 서버가 소유)은 엔진 스킬이 갖는다 — 로블록스는 `nereus-game:roblox` 의 `references/simulator-economy.md`.
