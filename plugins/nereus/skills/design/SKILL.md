---
name: design
description: Design, UI, UX and aesthetic work must go through Gemini feedback: direction candidates → direction critique (before code) → render critique (after code). Hard gate at finish. 트리거: "디자인", "화면 만들어", "UI 수정", "예쁘게".
---

# design

디자인 표면을 만지는 모든 작업 — 신규 생성, 수정, 방향 설계 — 은 Gemini 비평을 통과해야 완료로 인정된다.
게이트는 `design.enforce="block"`(기본)에서 finish 를 실제로 차단한다. 내 눈으로 판단하지 않는다.

## 언제 걸리나
`designTouched` 가 디자인 표면으로 분류하는 변경:
- 스타일시트(`.css/.scss/.sass/.less/.styl`) — 무조건
- 디자인 토큰(`tailwind.config.*`, `theme.*`, `tokens.*`, `palette.*`, `typography.*`) — 무조건
- 컴포넌트·마크업(`.tsx/.jsx/.vue/.svelte/.astro/.html/.dart`) — **추가된 라인에 시각 신호가 있을 때만**
  (className/style, `<div>` 계열 태그, CSS 속성, `TextStyle`·`EdgeInsets`·`ThemeData` 등)

로직만 바뀐 컴포넌트 편집, 테스트, 문서, `node_modules`·`dist`·`vendor` 는 걸리지 않는다.

## 3단계

### 0. generate — 방향 **후보**를 만든다
빈 종이에서 방향을 쓰면 "깔끔하고 미니멀"이 나오고, 그건 디자인 언어가 아니라 기획 공백의 기본값이다.
`ui-ux-pro-max` 데이터셋(스타일 79종·팔레트 192종·폰트 페어링 74종·UX 가이드 119종)에서 후보를 뽑아 시작한다.
```bash
D="${CLAUDE_PLUGIN_ROOT}/skills/design/scripts"
node "$D/design-system.mjs" "결제 완료 히어로, 신뢰감, B2B SaaS" \
  --project-name checkout --stack nextjs --variance 7 --density 3
# → docs/design/checkout-system.md (스타일·팔레트 16역할·타이포 페어링·안티패턴·사전 배포 체크리스트)
```
다이얼: `--variance` 1=중앙정렬/미니멀 ~ 10=대담/비대칭, `--motion` 1=은은 ~ 10=복합, `--density` 1=여유 ~ 10=대시보드.

**이 파일은 후보다. 그대로 구현하지 않는다.** 1단계 브리프의 출발점이고, 제품 맥락·톤·레퍼런스는 직접 얹는다.
생성기가 없으면 이 단계를 건너뛰고 브리프를 직접 쓰되, 무색 기본값은 1단계에서 반려된다(설치 안내는 스크립트가 출력).
끄려면 `.nereus/config.json` 에 `{ "design": { "systemGenerator": "none" } }`.

### 1. direction — 코드 쓰기 **전**
신규 화면·컴포넌트를 만들 때 필수. 방향 브리프(스타일 방향, 팔레트, 타이포 페어링, 레퍼런스)를 먼저 적고 비평받는다.

**채널 1순위는 browser MCP 다** (아래 "채널" 참조). MCP 가 안 되면 CLI 로 내려간다:
```bash
D="${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/design-feedback.mjs"
node "$D" direction --brief docs/design/hero-brief.md --target web
```
0단계를 돌렸으면 그 파일을 그대로 먹인다 — `--brief docs/design/checkout-system.md`.
브리프가 "깔끔하고 미니멀" 수준이면 Gemini 가 그 자체를 지적한다. REVISE 면 방향을 고쳐 다시 돌린다.
REVISE 를 받으면 브리프를 직접 고치거나, 0단계를 다른 다이얼로 다시 생성한다.

### 2. visual — 렌더 결과 **후**
구현 후 실제 스크린샷을 첨부해 미감을 판정받는다. 폭은 `design.widths`(기본 320/768/1440).
**채널 1순위는 browser MCP 다.** MCP 가 안 되면 CLI 로 내려간다:
```bash
# 스크린샷은 chrome-devtools MCP(take_screenshot) 또는 Playwright 로 먼저 확보한다
node "$D" visual \
  --shot 320:/tmp/s320.png --shot 768:/tmp/s768.png --shot 1440:/tmp/s1440.png \
  --context "결제 완료 히어로" \
  --files src/components/hero/Hero.tsx,src/components/hero/hero.css
```
`--files` 에 적은 파일만 커버된다. 빼먹으면 게이트가 계속 차단한다(스크립트가 경고한다).

### 현황 확인
```bash
node "$D" status            # 종료코드 0=통과, 1=차단
```

## 판정 규칙
- 커버는 **파일 내용 해시** 기준이다. 비평 후 그 파일을 고치면 그 파일만 STALE 이 되고 다시 비평받아야 한다. 무관한 백엔드 수정은 디자인 비평을 무효화하지 않는다.
- Gemini 응답에 `VERDICT: OK` 가 없거나, `[HIGH]`·`[CRITICAL]` 지적이 하나라도 있으면 **REVISE** 로 기록된다(fail-closed).
- REVISE 인데 파일이 그대로면 `design_feedback_unaddressed` 로 차단된다. 고치고 다시 비평받는 것이 유일한 통로다.
- 신규 디자인 파일이 있는데 direction 라운드가 한 번도 없으면 `design_direction_missing` 으로 차단된다.

## 채널

우선순위: **browser MCP → Gemini 웹세션 CLI → agy**. MCP 를 앞에 두는 이유는 쿠키·플랫폼에
의존하지 않기 때문이다 — Windows 는 Chrome 127+ App-Bound Encryption 때문에 쿠키 자동 추출이
안 된다(`image` 스킬 참조). `agy` 를 맨 뒤로 내린 이유는 두 가지다: 이미지 첨부를 못 받아
visual 라운드를 아예 못 하고, 2026-09-12 실측으로 할당량이 소진돼 있었다.

### 1순위 — browser MCP (직접 조작)
스크립트는 MCP 도구를 부를 수 없다. 그래서 **프롬프트를 내보내고 응답을 들여오는** 두 단계로 잇는다.
```bash
D="${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/design-feedback.mjs"
node "$D" prompt direction --brief docs/design/hero-brief.md            # 프롬프트를 stdout 으로
node "$D" prompt visual --shot 320:/tmp/s320.png --context "결제 히어로"
```
그 텍스트를 browser MCP 로 `gemini.google.com` 에 넣는다 — `navigate_page` → `fill`(프롬프트) →
visual 이면 `upload_file`(스크린샷) → `click`(전송) → `take_snapshot` 으로 응답을 읽는다.
받은 응답을 그대로 파일에 저장하고 기록한다:
```bash
node "$D" record direction --critique-file /tmp/critique.txt
node "$D" record visual --critique-file /tmp/critique.txt --files src/hero/Hero.tsx,src/hero/hero.css
```
`record` 는 `gemini-mcp` source 로 남는다. **verdict 판정은 CLI 경로와 동일한 파서를 쓴다** —
`VERDICT: OK` 가 없거나 `[HIGH]`·`[CRITICAL]` 이 있으면 REVISE 다. MCP 경로가 게이트를 느슨하게
만들지 않는다. 빈 비평은 거부한다(빈 기록은 게이트 우회다).

브라우저가 없거나 Gemini 에 로그인되어 있지 않으면 2순위로 내려간다. 억지로 붙들지 않는다.

### 2·3순위 — CLI
- **direction**: Gemini 웹세션 CLI → 없으면 `agy`(Antigravity CLI)
- **visual**: Gemini 웹세션 CLI(`skills/image/scripts/gemini_cli.py ask --file`). `agy` 는 이미지 첨부를 못 받는다.
- 웹세션이 죽으면 `SESSION DEAD` — Chrome 로그인 상태를 확인한다. Windows/Linux 는 쿠키 재Export 가
  필요하다(`image` 스킬의 `cookies-import.mjs`).

### generate (0단계)
`ui-ux-pro-max` 로컬 데이터셋(python3, 네트워크·API 키 불필요). 스킬이 아니라 데이터 엔진으로만
설치한다 — 상류 번들에 `nereus:design` 과 트리거가 겹치는 `design` 스킬이 함께 들어 있다.

## 설정 (`.nereus/config.json` 또는 사용자 전역)
```json
{ "design": { "enforce": "block", "exclude": ["src/legacy/**"], "widths": [320, 768, 1440], "systemGenerator": "ui-ux-pro-max" } }
```
`enforce: "warn"` 으로 낮추면 findings 는 보고하되 차단하지 않는다. 기본은 `block`.

## 기록
라운드는 `.nereus/design-feedback.json` 에 최근 20건까지 남는다. handoff 갱신 시 미이행 라운드를 "열린 질문"에 옮긴다.
