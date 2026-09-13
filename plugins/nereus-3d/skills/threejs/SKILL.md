---
name: threejs
description: three.js 씬 코드의 정적 검사 — 불완전한 dispose, 배선되지 않은 dispose 헬퍼, renderer.info 계측 부재. 트리거 "three.js", "webgl", "webgpu", "gltf", "3d 씬", "메시 생성", "dispose".
---

# threejs

nereus:common 규칙을 따른다. 담당 에이전트: graphics-engineer.
구현 절차(TDD·게이트)는 **`nereus:build` 의 것을 그대로 쓴다** — 여기서 다시 정의하지 않는다.

## 0. 문서를 여기 복사하지 않는다

three.js API·예제·TSL 은 **Context7 `/mrdoob/three.js`(21,304 스니펫)** 으로 조회한다.
R3F·drei 는 `pmndrs/claude-code-plugin`(MIT)과 `docs.pmnd.rs/api/mcp` 가 갖는다.
복사본은 상류가 리비전을 올리는 순간 **낡았다는 표시 없이** 틀린다.

이 스킬이 갖는 것은 문서가 아니라 **검사기**다. 조사에서 확인했다:
`awesome-claude-skills` 목록 셋(74,938 · 15,047 · 10,125★) **전부 3D 매치 0건**,
스킬팩 3종(`cloudai-x/threejs-skills` 3,291★ 포함)은 전부 *문서*이고 **셋 다 라이선스가 없다**.

## 1. 왜 정적 검사인가 — 조용히 틀리기 때문이다

도너(FindDifferences3D, 읽기 전용)의 같은 저장소 안에 두 구현이 있었다.

| 위치 | 코드 | 결과 |
|---|---|---|
| `game_view.html:616` | `for (key in material) if (value.isTexture) value.dispose()` | **완전** |
| `js/difference_engine.js:358` | `if (material.map) material.map.dispose()` | **`.map` 만** |

두 번째는 `normalMap`·`roughnessMap`·`aoMap`·`emissiveMap` 을 GPU 에 남긴다.
**예외도 경고도 나지 않는다.** 프레임만 떨어지고, 리뷰에서는 둘 다 "dispose 한다"로 보인다.

`disposeSubtree` 는 정의돼 있었지만 **호출이 한 곳뿐**이었다.
선언은 정리가 된다는 착각을 만든다. 그래서 **호출 지점을 세지 않고 결함이라 부르지 않고,
세지 않고 통과라 부르지도 않는다.**

## 2. 부르는 법

```bash
echo '{"sources":[{"file":"a.js","text":"..."}]}' \
  | node plugins/nereus-3d/lib/scene-scan.mjs
```

모듈로도 쓴다:

```js
import { scanScene } from "./plugins/nereus-3d/lib/scene-scan.mjs";
const { violations, unmeasured, disposeHelpers } = scanScene({ sources });
```

`sources` 는 `{ file, text }` 배열이다. **전체 소스를 한 번에 넘긴다** —
파일 하나만 넘기면 다른 파일에 있는 호출을 못 보고 거짓 `dispose-unwired` 를 낸다.

## 3. 무엇을 내는가

| code | 뜻 |
|---|---|
| `incomplete-dispose` | 머티리얼을 dispose 하면서 슬롯 일부만 정리한다. `missingSlots` 에 빠진 슬롯 |
| `dispose-unwired` | dispose 헬퍼가 정의만 되고 호출되지 않는다 |
| `instrumentation-missing` | 소스 어디에서도 `renderer.info` 를 읽지 않는다 — 측정 자체가 불가능하다 |

`disposeHelpers` 에 헬퍼별 **호출 지점 수**가 들어 있다. 미달과 위반을 섞어 보고하지 않는다.

## 4. 판정 규칙

- **속성 순회가 슬롯 나열보다 강하다.** 본문이 `isTexture` 로 순회하면 통과다 —
  상류가 슬롯을 늘려도 자동으로 덮인다. 나열은 통과시키되 `unmeasured` 에
  "슬롯 목록 확인일 기준"임을 남긴다.
- **위임을 따라간다.** 완전한 헬퍼를 부르는 함수는 완전하다. 도너의 `disposeObject3D` 가
  바로 이 경우였고, 위임을 안 보면 거짓 양성이 된다.
- **슬롯 목록은 데이터다**(`three-budget.json`). 코드에 박지 않는다 —
  three.js 가 정하고 three.js 가 바꾼다.
- **AST 파서를 쓰지 않는다.** 정규식 기반임을 결과의 `unmeasured` 에 **항상** 싣는다.
  통과가 정리를 증명하지 않는다.

## 5. 경계

- 에셋 파일(용량·포맷·텍스처 크기)은 `nereus-game:asset` 이다. **여기는 프레임이다.**
- 런타임 증거(드로우콜·GPU 메모리 표본)는 `nereus-3d:renderbudget` 이다.
