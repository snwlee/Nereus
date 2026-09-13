# add-3d-harness

## Why

3D 는 **에러가 안 나는 영역**이다. GPU 메모리가 새도, 드로우콜이 폭증해도,
텍스처 예산을 넘겨도 예외 하나 안 던지고 **프레임만 서서히 떨어진다.**
모바일 WebView 에서는 더 아프다.

조사(3회 수집, `docs/research/2026-09-13-threejs-3d-opensource.md`)의 결론:

| 필요한 것 | 이미 있나 |
|---|---|
| three.js API·예제·TSL 레퍼런스 | **있다** — Context7 `/mrdoob/three.js` 21,304 스니펫, **이미 설치됨** |
| R3F·drei 문서 | **있다** — `pmndrs/claude-code-plugin`(MIT) + `docs.pmnd.rs/api/mcp` |
| **판정 가능한 규율(검사기)** | **없다** |

"없다"의 근거: 스타 **74,938 · 15,047 · 10,125** 짜리 `awesome-claude-skills` 목록
**셋 모두 three.js·webgl·3D 매치 0건**이다. 스킬팩 3종(3,291★ 포함)은 전부 *문서*이고,
**셋 다 라이선스가 없어 채택할 수도 없다.**

**그러니 하네스가 만들 것은 문서가 아니라 검사기다.**

## 도너 — 실측으로 결함을 이미 찾았다

`/Volumes/SKHY1TB/workspace/FindDifferences3D` (오너 제공, **읽기 전용**).
Flutter 앱 안에 three.js 를 WebView 로 태운 하이브리드다.

| 항목 | 실측 |
|---|---|
| three.js 코드 | `js/` 13파일 **1,910줄** + `game_view.html` **1,213줄** |
| 씬 | 10종 |
| `new THREE.*Geometry` | **103건** |
| `new THREE.Mesh` | **122건** |
| `renderer.info` | **0건** — 계측이 아예 없다 |

### 찾은 결함 — 같은 저장소에 dispose 구현이 둘인데 하나가 샌다

`game_view.html:616` 은 **모든 텍스처 슬롯**을 순회한다:
```js
for (const key in material) { if (value && value.isTexture) value.dispose(); }
```

`js/difference_engine.js:358` 은 **`.map` 하나만** 본다:
```js
if (material.map && material.map.dispose) material.map.dispose();
```

**`normalMap`·`roughnessMap`·`aoMap`·`emissiveMap` 은 GPU 에 그대로 남는다.**
에러는 안 난다. 프레임만 떨어진다.

그리고 `disposeSubtree` 는 **정의돼 있는데 호출이 단 한 곳**(`:277`)이다 —
이 하네스가 자기 코드에서 계속 잡아온 **"선언하고 배선하지 않는 것"** 과 같은 모양이다.

**이 두 건이 첫 검사기의 요구사항을 그대로 준다.** 지어낸 시나리오가 아니다.

## 무엇을 만드나 — 게이트 둘

경계는 **앱이 실제로 돌아야 하는가**다. 이게 CI 에서 무엇이 돌 수 있는지를 가른다.

### `scene-scan.mjs` — 정적. 브라우저 없이 돈다

| 위반 | 왜 조용한가 |
|---|---|
| `incomplete-dispose` | 텍스처 슬롯 일부만 dispose 한다. **도너에서 실제로 났다** |
| `dispose-unwired` | dispose 헬퍼가 정의만 되고 정리 경로에 안 붙었다 |
| `instrumentation-missing` | `renderer.info` 를 아무도 안 읽는다 — 측정 자체가 불가능하다 |

### `render-budget.mjs` — 런타임 증거. 앱이 돈 뒤에만 판정한다

`renderer.info` 는 three.js **표준**이다(`render.calls`·`render.triangles`·
`memory.geometries`·`memory.textures`·`programs`). 프로젝트가 이것을 증거로 제출한다.

**하네스는 브라우저를 띄우지 않는다.** 실제 렌더러가 쓴 수치는 렌더한 쪽만 안다 —
`nereus-l10n` 이 두부를 직접 검출하지 않고 증거를 요구한 것과 같은 판단이다.

## 무엇을 하지 않나

- **문서를 넣지 않는다.** `llms-full.txt` 363KB 는 대부분 TSL 레퍼런스이고 Context7 이 색인한다.
  넣으면 즉시 낡는다. 출처 URL·확인일로 **참조만** 한다.
- **three.js 를 설치해 파싱하지 않는다.** 버전마다 API 가 움직이고,
  검사기가 라이브러리에 묶이면 프로젝트 버전과 어긋난다.
- **게임 런타임 3D**(Unity·로블록스 드로우콜·LOD·라이트맵). 선례 0건이라 가치는 크지만
  **이 맥에서 실측 불가**다. `asset-doctor` 검증이 이미 세 handoff 를 밀렸다 — 같은 패턴을 반복하지 않는다.
- **R3F 전용 정적 검사.** 도너가 순수 three.js 라 **검증할 대상이 없다.**
  검증 못 하는 것을 먼저 만들지 않는다.
- **인스턴싱 기회 조언.** 도너가 103 지오메트리/122 메시라 게이트로 내면 시끄럽기만 하다.
  기준을 세울 근거가 아직 없다.
