# nereus-3d

three.js 에서 **조용히 틀리는 것**을 프로세스로 잡는다.

## 왜 문서가 아니라 검사기인가

| 필요한 것 | 이미 있나 |
|---|---|
| three.js API·예제·TSL | **있다** — Context7 `/mrdoob/three.js`, 21,304 스니펫 |
| R3F·drei | **있다** — `pmndrs/claude-code-plugin`(MIT) · `docs.pmnd.rs/api/mcp` |
| **검사기** | **없었다** |

조사 근거(`docs/research/2026-09-13-threejs-3d-opensource.md`):
`awesome-claude-skills` 목록 셋(74,938 · 15,047 · 10,125★)에서 **3D 매치 0건**.
스킬팩 3종(`cloudai-x/threejs-skills` 3,291★ 포함)은 전부 *문서*이고 **셋 다 라이선스가 없다**
— 라이선스 없음은 GPL 보다 더 막힌다.

그래서 이 플러그인은 **문서를 복사하지 않는다.** Context7·pmndrs MCP 로 조회하고 출처만 참조한다.
복사본은 상류가 리비전을 올리면 낡았다는 표시 없이 틀린다.

## 두 검사기

| 스킬 | 검사기 | 본다 |
|---|---|---|
| `threejs` | `lib/scene-scan.mjs` | **코드** — 불완전한 dispose, 배선 안 된 헬퍼, 계측 부재 |
| `renderbudget` | `lib/render-budget.mjs` | **프레임** — `renderer.info` 표본의 예산 초과와 누수 |

둘 다 stdin JSON → stdout JSON 이고, 모듈로도 import 할 수 있다.

## 실제로 무엇을 잡았나

도너 프로젝트(FindDifferences3D, Flutter + WebView three.js r160, 읽기 전용)에서:

- `js/difference_engine.js` 의 `disposeSubtree` — `material.map` **만** 정리한다.
  `normalMap` 등 25종이 GPU 에 남는다. **에러는 나지 않는다.** → `incomplete-dispose`
- `renderer.info` 를 읽는 곳이 **0곳**. → `instrumentation-missing`
- 같은 저장소의 `game_view.html` 은 속성을 순회해 **완전**하다. 위임까지 따라가므로
  그것을 부르는 `disposeObject3D` 도 통과한다 — 거짓 양성을 내지 않는다.

## 경계

- **에셋 파일**(용량·포맷·텍스처 해상도)은 `nereus-game:asset` 이 갖는다.
  **여기는 프레임**이다 — GPU 에 올라간 뒤의 이야기.
- 게임 런타임 3D·R3F 정적 검사는 검증 대상이 생긴 뒤에 연다(연기된 판단).

## 규칙

- **기준이 없으면 판정하지 않는다.** 예산 수치는 운영값이라 데이터에 넣지 않는다.
  주지 않은 축은 통과가 아니라 `unmeasured` 다.
- **누수는 같은 라벨 두 표본 비교다.** 단발 스냅샷으로 판정하면 큰 씬이 전부 빨개진다.
- **슬롯 목록은 출처·확인일과 함께 데이터**(`three-budget.json`)다. 코드에 박지 않는다.
- **AST 파서도 three.js 도 설치하지 않는다.** 정규식 기반임을 결과에 항상 밝힌다.
- 다른 플러그인의 내부를 import 하지 않는다. `lib/cli-input.mjs` 도 이 플러그인 것이다.
