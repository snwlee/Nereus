---
name: threert
description: ThreeRT(하드웨어 레이트레이싱 three.js, @threert/scene) 장면 코드의 정적 검사 — 호출되지 않는 setAnimationLoop, 0 고정 renderer.info, setup 의 비결정성, 표준 머티리얼에 준 라이브러리 필드, lux 단위 오용. 트리거 "ThreeRT", "@threert", "threert-render".
---

# threert

nereus:common 규칙을 따른다. 담당 에이전트: graphics-engineer.
구현 절차(TDD·게이트)는 **`nereus:build` 의 것을 그대로 쓴다** — 여기서 다시 정의하지 않는다.

## 0. 문서를 여기 복사하지 않는다

ThreeRT(meshy-dev/ThreeRT, MIT)는 장면 작성 스킬을 **저장소 안에** 갖고 있다:
`.claude/skills/threert-scene-authoring/` (워크플로·물리 단위·머티리얼 라이브러리·리뷰 루프).
ThreeRT 저장소나 `threert create` 로 만든 프로젝트에서 작업하면 그 스킬을 읽는다.
API 는 `https://threert.dev/docs/` 와 상류 `packages/scene/src` 가 출처다.
상류는 2026-11-10 에 생겼고 매일 바뀐다 — 복사본은 그날로 낡는다.

이 스킬이 갖는 것은 **검사기**다. ThreeRT 는 three.js 코드가 그대로 돌게 하려고
three.js 렌더러 설정을 **받고 무시한다**(`packages/scene/src/compat.ts`).
three.js 습관이 에러 없이 다르게 동작하는 지점만 잡는다.

## 1. 검사기

```bash
echo '{"sources":[{"file":"scene.ts","text":"..."}]}' \
  | node plugins/nereus-3d/lib/threert-scan.mjs
```

```js
import { scanThreeRT, loadThreeRTData } from "./plugins/nereus-3d/lib/threert-scan.mjs";
const { applies, violations, warnings, unmeasured } = scanThreeRT({ sources });
```

**전체 소스를 한 번에 넘긴다.** `@threert/` import 가 한 파일에만 있어도 전부 본다.
어떤 소스도 import 하지 않으면 `applies: false` — plain three.js 에는 이 규칙들이 틀린 경고다.

## 2. 무엇을 내는가

| code | 수준 | 뜻 |
|---|---|---|
| `threert-animation-loop` | violation | `setAnimationLoop(cb)` 의 cb 는 **호출되지 않는다**. 게임의 `frame(f)` 로 옮긴다 |
| `threert-info-stub` | violation | `renderer.info` 는 **0 고정 스텁**이다. 측정에 쓰면 거짓 통과다 |
| `threert-setup-nondeterministic` | violation | setup **진입점** 안의 `Math.random`·`Date.now`·인자 없는 `new Date`·`crypto.randomUUID`. 핸들러와 달리 setup 은 결정론으로 감싸지 않는다 — 받은 seed·random 을 쓴다 |
| `threert-library-field` | violation | `MeshStandardMaterial({ wet, puddles, grime, windows, worldScale })` — 저장만 되고 렌더되지 않는다. `SurfaceMaterial` 로 |
| `threert-ignored-setting` | warning | `toneMappingExposure`·`shadowMap.*`·`light.shadow.*` 대입. 노출은 `camera.setManualExposure` |
| `threert-lux-suspect` | warning | `DirectionalLight` intensity 가 (0.3, 10] — 단위가 lux 다. 달빛 0.1–0.3 은 정상 |

규칙·근거(상류 파일 경로)·커밋·확인일은 `threert-compat.json` 에 있다. 코드에 박지 않는다.

### setup 진입점은 이름으로 찾지 않는다

진입점은 상류의 두 모양뿐이다: 장면의 `export default function build()` 와 게임의 `defineGame({ setup })` 최상위 멤버.
`setup`·`build` 라는 **이름**으로 찾으면 타워 디펜스의 `build(type)`, 엔티티의 `setup()` 같은 평범한 코드가 차단된다.
자체 래퍼(`levelGame(` 같은)로 게임을 정의하면 그 이름을 `threert-compat.json` 의 `gameDefiners` 에 더한다 —
더하지 않으면 그 setup 은 `unmeasured` 다. setup 안에서 `.on(`·`addEventListener(` 로 **등록만** 하는 콜백은
나중에 결정론 래퍼 안에서 불리므로 뺀다(`deferredCallbackMethods`).

## 3. 다른 두 스킬과의 관계

- **`threejs` 의 scene-scan 은 ThreeRT 에서 거짓 통과한다.** `instrumentation-missing` 은
  `renderer.info` 를 읽으면 통과인데, ThreeRT 에서 그 값은 0 이다. `applies: true` 면
  `threert-info-stub` 가 우선이고 scene-scan 의 계측 판정은 **미검사**로 읽는다.
- **`renderbudget` 에 ThreeRT 의 `renderer.info` 표본을 넣지 않는다.** 전부 0 이라 누수도 초과도 없다고 나온다.
  ThreeRT 의 비용은 상류 `node tools/bench-live.ts` 의 프레임 시간으로 본다(macOS Apple silicon).
- dispose 검사(`incomplete-dispose`)는 브라우저 폴백(plain three.js 로 같은 파일을 여는 경로)에 여전히 유효하다.

## 4. 판정 규칙

- **통과가 정상을 증명하지 않는다.** 정규식 기반이고, setup 이 부르는 헬퍼 안의 `Math.random` 은 못 본다.
  `unmeasured` 에 항상 남는다.
- **경고는 의도일 수 있다.** 황혼 장면의 5 lux 태양은 맞을 수 있다. violation 만 차단으로 다룬다.
- **상류 커밋이 낡으면 데이터부터 다시 확인한다.** `unmeasured` 에 기준 커밋이 찍힌다.

## 5. 범위 밖

네이티브 렌더러 실행·`threert-render compare` 이미지 비교(macOS 14+ Apple silicon 실기 필요).
필요하면 상류 스킬의 Commands 절을 따른다.
