---
name: design
description: 디자인·UI·UX·미감 작업은 Gemini 피드백을 반드시 거친다. 방향 후보 생성 → 방향 비평(코드 전) → 렌더 비평(코드 후), finish 하드 게이트. "디자인", "화면 만들어", "UI 수정", "예쁘게" 요청 시.
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
```bash
D="${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/design-feedback.mjs"
node "$D" direction --brief docs/design/hero-brief.md --target web
```
0단계를 돌렸으면 그 파일을 그대로 먹인다 — `--brief docs/design/checkout-system.md`.
브리프가 "깔끔하고 미니멀" 수준이면 Gemini 가 그 자체를 지적한다. REVISE 면 방향을 고쳐 다시 돌린다.
REVISE 를 받으면 브리프를 직접 고치거나, 0단계를 다른 다이얼로 다시 생성한다.

### 2. visual — 렌더 결과 **후**
구현 후 실제 스크린샷을 첨부해 미감을 판정받는다. 폭은 `design.widths`(기본 320/768/1440).
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
- **generate**: `ui-ux-pro-max` 로컬 데이터셋(python3, 네트워크·API 키 불필요). 스킬이 아니라 데이터 엔진으로만 설치한다 — 상류 번들에 `nereus:design` 과 트리거가 겹치는 `design` 스킬이 함께 들어 있다.
- **direction**: `agy`(Antigravity CLI) → 없으면 Gemini 웹세션 CLI
- **visual**: Gemini 웹세션 CLI(`skills/image/scripts/gemini_cli.py ask --file`). `agy` 는 이미지 첨부를 못 받으므로 쓰지 않는다.
- 웹세션이 죽으면 `SESSION DEAD` — Chrome 에서 gemini.google.com 로그인 상태를 확인한다(image 스킬 참조).

## 설정 (`.nereus/config.json` 또는 사용자 전역)
```json
{ "design": { "enforce": "block", "exclude": ["src/legacy/**"], "widths": [320, 768, 1440], "systemGenerator": "ui-ux-pro-max" } }
```
`enforce: "warn"` 으로 낮추면 findings 는 보고하되 차단하지 않는다. 기본은 `block`.

## 기록
라운드는 `.nereus/design-feedback.json` 에 최근 20건까지 남는다. handoff 갱신 시 미이행 라운드를 "열린 질문"에 옮긴다.
