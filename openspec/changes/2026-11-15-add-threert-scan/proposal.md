# ThreeRT 장면 코드의 조용한 실패를 잡는다 (add-threert-scan)

## Problem

ThreeRT(meshy-dev/ThreeRT, MIT)는 three.js 와 같은 모양의 API 위에 하드웨어 패스 트레이서를 얹었다.
"three.js 코드가 그대로 돈다"를 위해 three.js 의 렌더러 설정을 **받고 무시한다**(`packages/scene/src/compat.ts`).
그래서 three.js 습관으로 쓴 코드가 에러 없이 다르게 동작한다:

- `renderer.setAnimationLoop(cb)` — cb 는 호출되지 않는다. 애니메이션이 멈춘 채로 보인다.
- `renderer.info` — 0 고정 스텁. nereus-3d 의 `instrumentation-missing` 검사와 renderbudget 이 **거짓 통과**한다.
- setup 안의 `Math.random`/`Date` — 핸들러와 달리 결정론으로 감싸지 않는다. 방(room)마다 장면이 달라진다.
- `MeshStandardMaterial({ wet: 0.8 })` — 모르는 키를 저장만 한다. 젖음·창문·그라임은 `SurfaceMaterial` 의 것이다.
- `DirectionalLight(…, 3)` — 단위가 lux 다. 태양은 ~100,000.

## Goals

- `lib/threert-scan.mjs`: `@threert/` 를 import 하는 소스에만 적용되는 정적 검사기.
- 규칙·근거는 `threert-compat.json` 데이터(출처 URL·커밋·확인일).
- `threert` 스킬·라우트·graphics-engineer 책임·README 갱신. 문서는 upstream 스킬을 출처로 참조만.

## 리뷰에서 바뀐 결정 (2026-11-15)

- 처음엔 `setup`·`build` **이름**으로 진입점을 찾았다. opus 재리뷰가 `class TowerManager { build(type) { Math.random() } }` 같은 평범한 코드의 거짓 위반을 CRITICAL 로 냈다. 상류 59개 파일을 전수해 진입점이 두 모양(`export default function build` 10개, `defineGame({ setup })` 18개)뿐임을 확인하고 그 둘로 좁혔다. 래퍼(`levelGame(`)는 `gameDefiners` 데이터로 더한다.
- `performance.now()` 는 넣었다가 뺐다: 상류 벤치가 setup 시간을 재는 데 쓰고, 시간 측정은 내용을 바꾸지 않는다.

## Non-Goals

- 네이티브 렌더러 실행·이미지 비교 자동화. upstream 문서 복사. 간접 호출 추적.

## Design

| code | 수준 | 판정 |
|---|---|---|
| `threert-animation-loop` | violation | `.setAnimationLoop(` 인자가 `null`·`undefined` 가 아니다 |
| `threert-info-stub` | violation | `.info.render`·`.info.memory` 를 읽는다 (상류 스텁에 있는 둘만) |
| `threert-setup-nondeterministic` | violation | setup **진입점** 본문에 `Math.random(`·`Date.now(`·인자 없는 `new Date`·`crypto.randomUUID(`·`crypto.getRandomValues(`. 진입점은 `export default` 함수와 `defineGame({ setup })` 의 최상위 setup 뿐(이름으로 찾지 않는다). setup 안에서 `.on(`·`addEventListener(` 등으로 등록만 하는 콜백은 뺀다 |
| `threert-library-field` | violation | `new MeshStandardMaterial|MeshPhysicalMaterial({…})` 리터럴에 라이브러리 전용 키 |
| `threert-ignored-setting` | warning | 무시되는 설정에 대입 |
| `threert-lux-suspect` | warning | `new DirectionalLight(c, n)` 의 n 이 (0.3, 10] |

출력: `{ applies, violations, warnings, unmeasured }`. `applies:false` 면 나머지는 비고 사유가 `unmeasured` 에 있다.
문자열·주석 제거는 scene-scan 의 `stripNoise` 를 export 해 재사용한다(같은 플러그인 내부).
