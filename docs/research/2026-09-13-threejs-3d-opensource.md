# three.js · 3D 전문 오픈소스 조사

조사일 **2026-09-13**. 담당: researcher. 수집 경로: `gh search repos` → GitHub API 직접 조회 → 1차 자료(threejs.org).
`last30days`·CloakBrowser 는 쓰지 않았다 — 앞 두 단계로 답이 나왔고, 차단도 없었다.

> **개정 (같은 날, 2차 수집)**: 1차 수집이 `claude`·`skill`·`mcp` 키워드에 치우쳐
> **스타가 낮은 서드파티만** 잡혔다. 스타 임계(`stars:>1500`)를 걸고 다시 쓸어
> 대형 3D 프로젝트 8곳을 직접 조회했다. 결론은 바뀌지 않았지만 **근거가 완전히 달라졌고**,
> 아래 Q6 에서 한 가지를 정정한다.

## 요약

0. **대형 3D 프로젝트 8곳 중 에이전트용 문서를 내놓는 곳은 셋뿐이다**(three.js · filament · playcanvas).
   그중 **라이브러리 사용자**를 겨냥한 것은 **three.js 하나**다 — playcanvas 것은 엔진 기여자용이라 대상이 다르다.
1. **three.js 전용 에이전트 스킬팩은 실재한다** — 둘 찾았고 둘 다 실제 내용이 있다(각 ~300KB, 40여 파일).
   **그런데 둘 다 라이선스가 없다.** 라이선스 없음은 "자유"가 아니라 **전권 보유**라 복사·포크·벤더링이 막힌다.
2. **진짜 상류는 three.js 본체다.** 서드파티 스킬팩이 스스로 출처를 밝혔고(`llms` 브랜치),
   그 브랜치는 없지만 **`docs/llms.txt`(5.4KB)와 `llms-full.txt`(363KB)가 공식으로 존재**한다.
   three.js 는 **MIT** — 라이선스 문제가 사라진다.
3. **서드파티는 이미 낡았다.** `three-agent-skills` 는 `@0.182.0` 기준이고 공식은 `0.186.0` 이다.
   **중개자를 거치면 버전이 뒤처지고, 뒤처진 것이 권위 있게 보인다.**

## Q7. (3차 수집) `gh search` 가 놓친 것 — Context7 색인으로 재확인

**`gh search repos` 가 가장 큰 것을 놓쳤다.** 사용자가 "스타가 너무 적다"고 지적해
Context7 색인(`resolve-library-id`)으로 교차 확인하니 **3,291 스타짜리가 나왔다.**

| 저장소 | 스타 | 포크 | 마지막 커밋 | 라이선스 | 규모 |
|---|---|---|---|---|---|
| **`cloudai-x/threejs-skills`** | **3,291** | **376** | 2026-07-09 | **없음** | 스킬 10개 · 135KB |
| `emalorenzo/three-agent-skills` | 51 | 6 | 2026-01-28 | 없음 | 47파일 · 315KB |
| `BunsDev/threejs-claude-skills` | 0 | 0 | 2026-03-24 | 없음 | 42파일 · 260KB |

`cloudai-x` 는 도메인을 10개로 쪼갠다: `fundamentals` · `geometry` · `materials` · `textures` ·
`lighting` · `animation` · `loaders` · `shaders` · `postprocessing` · `interaction`
(각 11~16KB). 내용에 실제 규율이 있다 — `dispose()` 패턴, `frustumCulled`,
`powerPreference: "high-performance"` 등.

**그래도 라이선스가 없다. 셋 다 없다.** 3,291 스타·376 포크가 붙었다는 건
**사람들이 법적 근거 없이 쓰고 있다**는 뜻이지 쓸 수 있다는 뜻이 아니다.
README 의 설치 안내가 **다른 저장소**(`pinkforest/threejs-playground`)를 가리키는 등
관리 상태도 얇다. 이슈 9건이 열려 있다.

### 교훈 — 검색 도구 하나에 의존하지 않는다

1차 수집에서 `gh search repos "threejs claude skill"` 이 **3,291 스타짜리를 안 내놓고**
0 스타짜리를 내놨다. 같은 질문을 **다른 색인**(Context7)에 던지니 바로 나왔다.
`Ruling: 요약 모델에 개수를 묻지 않는다` 와 같은 부류다 — **한 경로의 결과를 전수로 믿지 않는다.**

## Q8. 문서 조회 경로는 이미 있는가 — **있다**

**Context7 MCP 가 이미 three.js 를 색인하고 있고, 그 MCP 는 `nereus` 에 이미 설치돼 있다.**

| Context7 라이브러리 ID | 스니펫 | 평판 |
|---|---|---|
| `/mrdoob/three.js` | **21,304** | High |
| `/websites/threejs` | 10,034 | High |
| `/llmstxt/threejs_llms-full_txt` | 5,346 | High |
| `/cloudai-x/threejs-skills` | 340 | High |

그리고 **Poimandres(react-three-fiber·drei·zustand 조직)는 자체 MCP 서버를 운영한다**:

| | |
|---|---|
| 저장소 | `pmndrs/claude-code-plugin` · **MIT** · 2026-08-14 |
| MCP | `https://docs.pmnd.rs/api/mcp` (http) |
| 스킬 | `docs`(2.1KB) · `examples`(4.0KB) |

그 스킬의 규율이 **우리 Context7 규칙과 같은 문장**이다:
> *"Prefer it over memory: these libraries move fast and recalled APIs go stale."*

**즉 `llms-full.txt` 363KB 를 하네스에 복사할 이유가 없다.** 조회 경로가 둘이나 이미 있다.

### `llms-full.txt` 363KB 의 정체 — 정정

2차 수집에서 이 파일을 "채굴할 규율"로 제시했는데 **헤딩을 확인하니 대부분이
TSL(Three.js Shading Language) API 레퍼런스**다. 규율은 5.4KB `llms.txt` 의
"Instructions for Large Language Models" 절에 있고, 363KB 쪽은 **레퍼런스**다.

레퍼런스는 하네스에 넣을 것이 아니라 **조회할 것**이다. 넣으면 즉시 낡는다.

## Q6. (2차 수집) 대형 3D 프로젝트는 에이전트용 문서를 내놓는가

스타 1,500 이상 3D 프로젝트 8곳의 `llms.txt` · `AGENTS.md` · `CLAUDE.md` · `.cursorrules` 를 직접 조회했다.

| 저장소 | 스타 | 라이선스 | 에이전트용 문서 |
|---|---|---|---|
| `mrdoob/three.js` | **115,469** | MIT | **`docs/llms.txt` 5.4KB + `llms-full.txt` 363KB** |
| `pmndrs/react-three-fiber` | 32,270 | MIT | **없음** |
| `BabylonJS/Babylon.js` | 26,063 | Apache-2.0 | **없음** |
| `google/filament` | 20,486 | Apache-2.0 | `AGENTS.md` 2.9KB · `.cursorrules` · `docs/llms.txt` 1.2KB |
| `playcanvas/engine` | 16,735 | MIT | `AGENTS.md` **16.5KB** |
| `CesiumGS/cesium` | 15,720 | Apache-2.0 | **없음** |
| `zeux/meshoptimizer` | 8,322 | MIT | **없음** |
| `google/model-viewer` | 8,239 | Apache-2.0 | **없음** |
| `KhronosGroup/glTF` | 7,840 | NOASSERTION | **없음** |

**8곳 중 셋만 내놓는다.** 그리고 셋이 서로 다른 것을 겨냥한다:

- **three.js `llms-full.txt`(363KB)** — 라이브러리를 **쓰는 사람**을 위한 지침. 우리가 필요한 것.
- **playcanvas `AGENTS.md`(16.5KB)** — **엔진 코드베이스에 기여하는 사람**을 위한 규칙
  (ESLint 실행법, JSDoc 규약, 빌드 시스템). **대상이 다르다** — 우리는 게임을 만들지 엔진에 기여하지 않는다.
- **filament `docs/llms.txt`(1.2KB)** — 내용이 아니라 **링크 색인**이다.
  다만 가리키는 *Physically Based Rendering in Filament* 는 PBR 이론의 권위 있는 1차 자료다.

### 정정

1차 수집 결론에서 "서드파티 스킬팩의 분류 구조를 참고한다"고 적었는데, **참고할 필요가 줄었다.**
상류 자체가 에이전트용 문서를 내놓기 시작했고(three.js·filament·playcanvas),
`llms-full.txt` 363KB 는 스타 51짜리 서드파티가 정리한 것보다 **크고 최신이고 라이선스가 깨끗하다.**
서드파티는 **"상류에 없던 시절의 우회로"** 였고, 그 시절은 지났다.

## 질문과 답

### Q1. Claude Code / AI 에이전트용 three.js·3D 전용 스킬이 존재하나

**존재한다. 둘.**

| 저장소 | 스타 | 마지막 커밋 | 라이선스 | 규모 | 내용 |
|---|---|---|---|---|---|
| `emalorenzo/three-agent-skills` | 51 | 2026-01-28 | **없음** | 47파일 / 315KB | Three.js + R3F 베스트프랙티스. 규칙을 우선순위 12단계로 분류(`setup-`·`memory-`·`render-`…) |
| `BunsDev/threejs-claude-skills` | 0 | 2026-03-24 | **없음** | 42파일 / 260KB | core · R3F · ECS · WebGPU/TSL 4종 스킬팩 |

`emalorenzo` 쪽 구조는 우리 규율과 잘 맞는다 — **우선순위와 영향도를 표로 선언**하고
규칙마다 접두사를 붙여 추적 가능하게 한다:

| Priority | Category | Impact |
|---|---|---|
| 0 | Modern Setup & Imports | FUNDAMENTAL |
| 1 | Memory Management & Dispose | **CRITICAL** |
| 2 | Render Loop Optimization | **CRITICAL** |
| 3 | Geometry & Buffer Management | HIGH |
| 4 | Material & Texture Optimization | HIGH |
| … | … 12단계까지 | … |

### Q2. MCP 서버 중 3D 관련

| 저장소 | 스타 | 마지막 커밋 | 라이선스 | 비고 |
|---|---|---|---|---|
| `ahujasid/blender-mcp` | **28,411** | 2026-09-07 | MIT | **이미 우리 `asset` 스킬이 쓰는 것** |
| `AnkleBreaker-Studio/unity-mcp-server` | 437 | 2026-07-27 | other | 268 도구. 라이선스 `other` — 확인 필요 |
| `DmitriyGolub/threejs-devtools-mcp` | 106 | 2026-04-07 | MIT | **씬·머티리얼·셰이더·라이트를 실시간 조회/편집** |
| `seehiong/blender-mcp-bridge` | 53 | 2026-09-13 | MIT | 93 도구 |
| `bpy-dev/blender-mcp` | 81 | 2026-09-12 | **GPL-3.0** | 라이선스 때문에 채택 대상 아님 |
| `nurture-tech/unity-mcp-server` | 33 | 2026-04-30 | MIT | |

`threejs-devtools-mcp` 가 주목할 만하다. 우리 `nereus:design` 은 **스크린샷**으로 비평하는데,
3D 는 스크린샷만으로 드로우콜·머티리얼 수를 못 본다. 씬 그래프를 읽을 수 있으면 판정이 달라진다.
**다만 스타 106·마지막 커밋 2026-04(5개월 전)이라 유지보수가 얇다.**

### Q3. three.js 생태계에 채굴할 규율이 쌓인 곳

**공식 1차 자료가 있다.**

| 자료 | 크기 | 라이선스 | 확인일 |
|---|---|---|---|
| `https://threejs.org/docs/llms.txt` | 5,404 B | MIT | 2026-09-13 |
| `https://threejs.org/docs/llms-full.txt` | **363,106 B** | MIT | 2026-09-13 |
| `mrdoob/three.js` 본체 | 115,469 스타 · 2026-09-13 커밋 | MIT | 2026-09-13 |

`llms.txt` 는 **"LLM 을 위한 지침"** 을 명시적으로 담고 있다 — 임포트 맵을 쓸 것,
WebGL 과 WebGPU 렌더러 중 무엇을 언제 고를 것인지 등.

`AxiomeCG/awesome-threejs`(983 스타 · 2026-07-28 · **CC0-1.0**)는 큐레이션 목록이라
다음 채굴 대상을 고르는 입구로 쓸 수 있다.

### Q4. 게임 런타임 3D(Unity·로블록스) 에이전트 지식

**Unity 는 MCP 가 여럿 있으나 로블록스 3D 런타임은 검색에서 안 나왔다.**
`agent skills 3d graphics` · `claude-code plugin 3d` 는 **매치 0건**이다 —
게임 런타임 3D 규율을 에이전트 지식으로 옮긴 선례가 사실상 없다.

### Q5. 우리 스택 적합성과 Windows

| 후보 | 우리 스택 적합성 | Windows |
|---|---|---|
| 공식 `llms-full.txt` | **높음** — 텍스트 데이터라 스택 무관 | 무관 |
| `three-agent-skills` | 높음(TS/웹) — **단 라이선스로 채택 불가** | 무관 |
| `threejs-devtools-mcp` | 중 — 브라우저 런타임 필요 | 확인 안 함 |
| `blender-mcp` | 이미 채택됨 | 우리 Blender 경유 규칙이 전제 |

## 비교표 — 채택 판정

| 후보 | 라이선스 | 유지보수 | 판정 |
|---|---|---|---|
| **공식 `llms.txt` / `llms-full.txt`** | **MIT** | 본체와 같이 감(오늘 커밋) | **채택** |
| **`cloudai-x/threejs-skills`** (3,291★·376포크) | **없음** | 2026-07-09 | **채택 불가** — 스타가 높아도 라이선스가 없다 |
| `pmndrs/claude-code-plugin` + `docs.pmnd.rs` MCP | **MIT** | 2026-08-14 | **채택** — R3F 문서 조회 경로 |
| Context7 `/mrdoob/three.js` (21,304 스니펫) | — | 상시 | **이미 설치됨** |
| `emalorenzo/three-agent-skills` | **없음** | 2026-01-28 (정체) | **채택 불가** — 구조만 참고 |
| `BunsDev/threejs-claude-skills` | **없음** | 2026-03-24 | **채택 불가** |
| `AxiomeCG/awesome-threejs` | CC0-1.0 | 2026-07-28 | 보조 — 다음 채굴 입구 |
| `threejs-devtools-mcp` | MIT | 2026-04-07 (얇음) | **보류** — 검증 후 판단 |
| `ahujasid/blender-mcp` | MIT | 활발 | 이미 채택됨 |
| `bpy-dev/blender-mcp` | GPL-3.0 | 활발 | **제외** — 라이선스 |

## 추천 (3차 수집 후 개정)

**문서는 넣지 않는다 — 이미 Context7·pmndrs MCP 로 조회된다.
하네스가 만들 것은 아무도 안 만든 것, 즉 `3d` 도메인의 *검사기*다.**

세 번 쓸어본 결론이 한 곳을 가리킨다:

| 필요한 것 | 이미 있나 |
|---|---|
| three.js API 레퍼런스 | **있다** — Context7 `/mrdoob/three.js` 21,304 스니펫 |
| R3F·drei API | **있다** — pmndrs 공식 MCP(MIT) |
| 예제·패턴 | **있다** — Context7 `/websites/threejs` 10,034 스니펫 |
| TSL 레퍼런스 | **있다** — `llms-full.txt` 363KB, Context7 색인됨 |
| **판정 가능한 규율(검사기)** | **없다** |

**"없다"의 근거**: 스타 74,938 · 15,047 · 10,125 짜리 `awesome-claude-skills` 목록
**셋 모두 three.js·webgl·3D 매치 0건**이다. 그리고 스킬팩 셋은 전부 *문서*이지 *검사기*가 아니다.

우리 하네스의 다른 도메인이 그랬듯(`ad-policy-check` · `store-l10n-check` · `l10n-scan`),
가치는 문서가 아니라 **조용히 틀리는 것을 프로세스로 잡는 것**에 있다. 3D 에서 조용히 틀리는 것:
`dispose()` 누락으로 인한 GPU 메모리 누수 · 드로우콜 폭증 · 텍스처 예산 초과 ·
`frustumCulled` 오남용 · 셰이더 컴파일 스톨. **전부 에러가 안 나고 프레임만 떨어진다.**

### 이유

0. **문서 조회는 이미 풀린 문제다.** Context7 이 three.js 를 21,304 스니펫으로 색인하고 있고
   그 MCP 는 `nereus` 에 이미 설치돼 있다. 복사하면 낡을 뿐이다.
1. **채택 가능한 스킬팩이 하나도 없다.** 셋 다 라이선스가 없다 — 3,291 스타짜리도 마찬가지다. 서드파티 둘은 라이선스가 없어 법적으로 못 쓴다.
   `AltTester(GPL-3.0) 금지` 와 같은 종류의 판단이고, **라이선스 없음은 GPL 보다 더 막힌다.**
2. **중개자를 거치면 낡는다.** `three-agent-skills` 는 `@0.182.0`, 공식은 `0.186.0` 이다.
   조사 시점에 이미 4 마이너 뒤처져 있고 그 저장소는 8개월 가까이 멈춰 있다.
   `Ruling: 실측 수치는 출처·확인일과 함께 둔다` 의 같은 이유다 — **낡은 것이 권위 있게 보이는 것이 가장 나쁘다.**
3. **규칙 우선순위 구조는 우리 것과 이미 같은 모양이다.** `memory-`·`render-` 가 CRITICAL 이고
   `debug-` 가 LOW 인 배치는 우리 `severity` 체계와 대응된다. 그 **형태**는 아이디어라 자유롭게 쓸 수 있다.

### 리스크

- **363KB 를 그대로 넣지 않는다.** 하네스는 문서 저장소가 아니다. 판정 가능한 규칙만 검사기로 옮기고,
  나머지는 **출처 URL·확인일과 함께 참조**한다. 넣으면 즉시 낡기 시작한다.
- **버전 종속이 크다.** three.js 는 마이너마다 API 가 움직인다. 검사기가 버전을 데이터로 받아야 한다.
- `threejs-devtools-mcp` 는 **유지보수가 얇다**(5개월 정체·106 스타). 의존하면 그 저장소가 멈출 때 같이 멈춘다.
- **웹 three.js 와 게임 런타임 3D 는 다른 도메인이다.** 한 스킬에 섞으면 또 반만 들어온다
  (이번에 확인: 게임 런타임 3D 에이전트 지식은 **선례가 0건**이다).

## 출처

| 자료 | URL | 확인일 |
|---|---|---|
| three.js 본체 | https://github.com/mrdoob/three.js | 2026-09-13 |
| cloudai-x/threejs-skills (3,291★) | https://github.com/cloudai-x/threejs-skills | 2026-09-13 |
| pmndrs/claude-code-plugin (MIT) | https://github.com/pmndrs/claude-code-plugin | 2026-09-13 |
| pmndrs docs MCP | https://docs.pmnd.rs/api/mcp | 2026-09-13 |
| Context7 색인 (three.js 4종) | Context7 MCP `resolve-library-id` | 2026-09-13 |
| awesome-claude-skills 3종 (74,938·15,047·10,125★) | ComposioHQ · travisvn · BehiSecc | 2026-09-13 |
| 공식 LLM 지침 | https://threejs.org/docs/llms.txt | 2026-09-13 |
| 공식 전체 문서 | https://threejs.org/docs/llms-full.txt | 2026-09-13 |
| three-agent-skills | https://github.com/emalorenzo/three-agent-skills | 2026-09-13 |
| threejs-claude-skills | https://github.com/BunsDev/threejs-claude-skills | 2026-09-13 |
| threejs-devtools-mcp | https://github.com/DmitriyGolub/threejs-devtools-mcp | 2026-09-13 |
| blender-mcp | https://github.com/ahujasid/blender-mcp | 2026-09-13 |
| awesome-threejs | https://github.com/AxiomeCG/awesome-threejs | 2026-09-13 |
| unity-mcp-server | https://github.com/AnkleBreaker-Studio/unity-mcp-server | 2026-09-13 |

스타·커밋일·라이선스는 전부 GitHub API 원문이다. 추정치 없음.
