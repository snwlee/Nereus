# ui-ux-pro-max 채택 기록 (2026-09-07)

`nereus:design` 에 0단계(방향 후보 생성)를 붙이기 위해
[ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT) 을 채택했다.
이 문서는 **보안 판정 근거**와 **설치 방식 결정 근거**를 남긴다 — 둘 다 재조사 비용이 크기 때문이다.

## 왜 붙였나

소셜 프리뷰 작업(2026-09-07)에서 Gemini 방향 라운드가 반복해서 같은 것을 지적했다:
"깔끔하고 미니멀은 디자인 언어가 아니라 기획 공백의 기본값이다", "구체적 스타일 방향·팔레트·타이포
페어링·레퍼런스를 확정하라."

즉 우리 게이트는 **방향을 판정**할 수 있지만 **방향을 생성**하지 못한다. 빈 종이에서 브리프를 쓰면
무색 기본값이 나오고, direction 라운드가 그것을 반려하는 왕복이 반복된다. ui-ux-pro-max 가 정확히
그 산출물(스타일 79종·팔레트 192종·폰트 페어링 74종·UX 가이드 119종·안티패턴·사전 배포 체크리스트)을
만든다. 그래서 design 흐름이 2단계 → 3단계가 됐다: generate → direction → visual.

## 보안 판정: 채택 가능 (SkillSpector 결과와 반대)

`skillspector scan --recursive --no-llm` 결과는 **채택하면 안 되는 것처럼 보인다**:

| 스킬 | 점수 | 판정 | findings |
|---|---|---|---|
| ui-ux-pro-max | 100/100 | CRITICAL / DO NOT INSTALL | 72 |
| design | 100/100 | CRITICAL | 12 |
| brand | 87/100 | CRITICAL | 6 |
| ui-styling | 74/100 | HIGH | 16 |
| design-system | 70/100 | HIGH | 5 |
| slides | 17/100 | LOW | 1 |
| banner-design | 0/100 | LOW | 0 |

**이 점수는 신뢰할 수 없다.** findings 를 위치별로 열어보면 스캐너가 데이터 스킬의 CSV 본문을
코드처럼 읽은 결과다:

- `MEDIUM: E1 External Transmission` × 24 → 전부 `data/stacks/flutter.csv` 의 `api.flutter.dev`
  **문서 링크 열**이다. 네트워크 호출이 아니라 참고 URL 문자열.
- `HIGH: AE1 Referenced artifact not inspected` × 9 → SKILL.md 의 외부 링크.
- `HIGH: PE3 Credential Access` → `data/products.csv:112` 의 **"Password Manager" 제품 행**
  (`password, security, vault, credentials, ...` 는 그 제품의 검색 키워드 열이다).
- `HIGH: MP3 Memory Manipulation` → `data/stacks/javafx.csv`·`flutter.csv` 의 `dispose()` 로
  **메모리 누수를 막으라는 가이드 문구**.
- `HIGH: OH1 Unvalidated Output Injection` → `react-performance.csv`·`nextjs.csv` 의 입력 검증
  가이드 문구.
- `MEDIUM: RP1 MCP server without pinned version` × 12 → CSV 안의 `npx shadcn`·`npx astro` 예시 문자열.

### 실행 표면 직접 감사 (이게 판정 근거다)

스캐너 점수 대신 실제 실행되는 코드를 AST 로 감사했다. `scripts/*.py` 5개의 import 전체:

| 파일 | import |
|---|---|
| `core.py` | collections, csv, difflib, math, pathlib, re |
| `design_system.py` | argparse, core, csv, datetime, io, json, os, pathlib, re, reasoning_contract, sys, tempfile |
| `reasoning_contract.py` | json, re |
| `search.py` | argparse, core, design_system, io, json, sys |
| `validate_data.py` | core, csv, datetime, hashlib, json, math, pathlib, re, reasoning_contract, statistics, sys, urllib.parse |

- **서드파티 의존성 0.** 전부 표준 라이브러리. BM25 를 직접 구현했다. venv 불필요(image 스킬과 다름).
- `subprocess`·`os.system`·`eval`·`exec`·`__import__`·`socket`·`requests` **전무**. 네트워크 호출 0.
  (`urllib.parse` 는 URL 파싱 전용이고 `urllib.request` 가 아니다.)
- `os` 사용은 두 곳뿐: `os.environ.get('COLORTERM')` (터미널 색 지원 판정),
  그리고 원자적 파일 쓰기(`tempfile` → `fsync` → `os.replace`/`os.link`).
- 파일 쓰기는 `--persist` **옵트인 경로에서만** 일어나고, `safe_slug()` 가
  `[^a-z0-9_-]` 를 전부 `-` 로 접어 경로 탈출을 구조적으로 막는다. 우리 래퍼는 `--persist` 를
  아예 넘기지 않고 stdout 만 받는다.

**판정: 채택 가능.** 로컬 CSV 를 읽어 stdout 에 쓰는 순수 조회 도구다.

## 설치 방식: 데이터 엔진으로만 (스킬로 설치하지 않는다)

공식 설치 명령 `npx ui-ux-pro-max-cli init --ai claude` 는 쓰지 않는다. 이유 두 가지:

1. **트리거 충돌.** 상류는 스킬 1개가 아니라 **7개 번들**이다(ui-ux-pro-max, design, design-system,
   ui-styling, brand, banner-design, slides). 그 중 `design` 스킬(description 639자)이
   `nereus:design` 과 정면으로 겹친다. 게이트를 소유한 쪽이 라우팅을 잃으면 하드 게이트가 우회된다.
2. **상시 컨텍스트 비용.** 7개 description 합계 2,669자 ≈ 상시 700~900 토큰. v0.5.1 에서 상시 토큰을
   3,640 → 1,842 로 깎은 작업을 되돌리는 크기다.

그래서 스킬 디렉터리가 아닌 곳에 sparse clone 으로 두고, `design-system.mjs` 가 `python3` 로
직접 호출한다. 상시 토큰 0, 트리거 충돌 0.

```bash
mkdir -p ~/.local/share/nereus && cd ~/.local/share/nereus \
  && git clone --depth 1 --filter=blob:none --sparse \
     https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git ui-ux-pro-max \
  && cd ui-ux-pro-max && git sparse-checkout set .claude/skills/ui-ux-pro-max
```

sparse checkout 으로 4.7MB (전체 clone 은 29MB — gallery·screenshots·preview 가 대부분).
갱신은 `git -C ~/.local/share/nereus/ui-ux-pro-max pull`.

탐색 순서(`ENGINE_CANDIDATES`): `$NEREUS_UIUX_HOME` → `~/.local/share/nereus/…` → 전역 스킬 →
프로젝트 `.claude/skills/`. 뒤쪽 두 경로를 남긴 것은 공식 CLI 로 이미 설치한 사람도 동작하게 하기 위함이다.

## 왜 출력 파싱이 없나

상류 기본 출력은 ANSI 박스 아트라 브리프로 쓸 수 없다. 그런데 `--format markdown` 이 있고
(핸드오프 계획 시점에는 몰랐다) 그 출력이 그대로 브리프가 된다. 그래서 래퍼는 파싱을 전혀 하지 않고
경로 탐색·인자 조립·파일 쓰기·미설치 안내만 담당한다.

`--variance`/`--motion`/`--density` 다이얼(1~10)도 그대로 노출한다 — 무색 기본값을 피하는 직접적인 레버다.

## 부수 발견: designTouched 오탐 (수정함)

`design-system.mjs` 를 추가하자 finish 게이트가 그것을 `design-tokens` 디자인 표면으로 잡아 차단했다.
`TOKENS` 정규식이 파일명만 보고 확장자·내용을 보지 않았기 때문이다
(`(^|\/)(theme|tokens|design-system|palette|typography)[.\-/]` → `design-system` + `.mjs` 의 점).
같은 구멍으로 `theme.py`·`tokens.sh`·`palette.mjs` 도 전부 걸렸다.

`SURFACE`(컴포넌트)는 이미 "추가된 라인에 시각 신호가 있을 때만" 걸리는데 `TOKENS` 만 그 검증을
건너뛰고 있었다. 그래서 `TOKENS` 에도 같은 조건을 걸었다.

단순히 조건만 걸면 **fail-open 회귀**가 생긴다: `VISUAL_SIGNAL` 은 하이픈 케이스 CSS 속성만 보는데
`tailwind.config.js`·`theme.ts` 는 camelCase(`fontFamily`, `colors`, `borderRadius`)를 쓴다.
TOKENS 의 무조건 매치가 그것들을 잡는 유일한 통로였다. 그래서 `VISUAL_SIGNAL` 에 camelCase 토큰 키와
색 리터럴(`#RRGGBB`, `oklch(`, `rgb(`, `hsl(`)을 함께 추가했다. 색 리터럴은 팔레트 정의가 거의 항상
담기 때문에 가장 강한 신호다.
