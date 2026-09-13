---
name: renderbudget
description: renderer.info 표본으로 렌더 예산과 GPU 누수를 판정한다. 예산 기준은 호출부가 준다. 트리거 "드로우 콜", "draw call", "renderer.info", "gpu 메모리", "프레임 드랍", "텍스처 예산".
---

# renderbudget

nereus:common 규칙을 따른다. 담당 에이전트: graphics-engineer.
구현 절차(TDD·게이트)는 **`nereus:build` 의 것을 그대로 쓴다**.

## 0. 정적 검사만으로는 모자란다

`scene-scan` 은 코드가 무엇을 *안 부르는지* 본다. 실제로 GPU 에 무엇이 남았는지는
**런타임 증거**로만 안다. 그 증거가 `renderer.info` 다.

```js
// 씬 전환·상태 복귀 지점에서 표본을 남긴다. 라벨은 "같은 상태"를 뜻한다.
samples.push({ label: "stage-1", info: JSON.parse(JSON.stringify(renderer.info)) });
```

`renderer.info` 를 읽는 곳이 하나도 없으면 `scene-scan` 이 `instrumentation-missing` 으로
잡는다. **계측 부재는 통과가 아니다** — 측정 자체가 불가능하다는 뜻이다.

## 1. 부르는 법

```bash
echo '{"samples":[{"label":"stage-1","info":{...}}],"budgets":{"calls":100}}' \
  | node plugins/nereus-3d/lib/render-budget.mjs
```

```js
import { checkRenderBudget } from "./plugins/nereus-3d/lib/render-budget.mjs";
const { violations, unmeasured } = checkRenderBudget({ samples, budgets });
```

판정 축: `calls` · `triangles` · `points` · `lines` · `geometries` · `textures` · `programs`.

## 2. 예산 기본값을 여기 적지 않는다

드로우콜 상한·텍스처 예산은 **기기 등급·해상도·씬 복잡도가 정하는 운영값**이다.
스킬이나 데이터 파일에 숫자를 적으면 정책인 척하면서 낡는다
(`nereus-ads` 의 쿨다운·세션 상한과 같은 판단).

**기준을 안 주면 판정하지 않는다.** 대신 그 사실이 `unmeasured` 에 실린다.
지어낸 기준은 그럴듯하게 틀린다.

목표 기기를 정한 쪽이 자기 숫자를 넘긴다:

```json
{ "budgets": { "calls": 120, "textures": 48, "programs": 20 } }
```

## 3. 누수는 같은 라벨 두 표본 비교다

**단발 스냅샷으로 판정하지 않는다.** 지오메트리 99,999개는 누수가 아니라 큰 씬일 수 있다.
단발로 판정하면 큰 씬이 전부 빨개지고, 그러면 아무도 안 본다.

- 같은 `label` 의 표본이 **둘 이상**일 때만 본다. 같은 라벨은 "같은 상태로 돌아왔다"는 뜻이다.
- 누수 축은 `memory.geometries` 와 `memory.textures` 만이다(`three-budget.json` 의 `leakAxes`).
  `render.calls` 는 프레임마다 달라 누수 축이 아니다.
- 첫 표본보다 마지막 표본이 크면 `leak-suspected` 다.
- 표본이 하나뿐인 라벨은 위반이 아니라 `unmeasured` 로 나간다.

수집 순서: 상태 진입 → 표본 → 떠남 → 다시 진입 → 표본. 두 번째가 크면 떠나는 경로가 새는 것이다.
그때 `scene-scan` 의 `dispose-unwired` 를 같이 본다.

## 4. 무엇을 내는가

| code | 뜻 |
|---|---|
| `budget-exceeded` | 축 값이 주어진 상한을 넘는다. `axis` · `value` · `limit` |
| `leak-suspected` | 같은 라벨에서 메모리 축이 늘었다. `axis` · `from` · `to` |

`unmeasured` 는 **판정하지 않은 것**이다. 비어 있지 않으면 통과가 아니라 부분 검사다.
