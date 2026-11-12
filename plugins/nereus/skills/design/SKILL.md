---
name: design
description: Design, UI, UX and aesthetic work must go through impeccable critique: direction candidates → direction (impeccable shape, before code) → render critique (impeccable critique/audit, after code). Hard gate at finish. 트리거: "디자인", "화면 만들어", "UI 수정", "예쁘게".
---

# design

디자인 표면을 만지는 모든 작업 — 신규 생성, 수정, 방향 설계 — 은 **impeccable** 비평을 통과해야 완료로 인정된다.
게이트는 `design.enforce="block"`(기본)에서 finish 를 실제로 차단한다. 내 눈으로 판단하지 않는다.

비평 채널은 동반 플러그인 `impeccable` 의 스킬 하나다(2026-11-12 방침). 이미지 생성 외의 외부 웹세션은 쓰지 않는다.
impeccable 이 없으면 `/nereus:setup` 이 설치를 안내하고, 게이트는 그대로 차단한다 — 비평 없이 통과시키지 않는다.

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

1. `impeccable` 스킬을 `shape <대상>` 으로 부른다. 0단계 파일(`docs/design/<이름>-system.md`)이 있으면 그것을 브리프로 넘긴다.
   **레퍼런스는 이미지로 붙인다** — "Stripe 같은 느낌" 같은 텍스트는 비평가가 대조할 수 없다. Figma 가 레퍼런스면 `figma` 스킬로 프레임 스크린샷을 뜬다.
2. 결과를 아래 "옮기는 형식"으로 파일에 적고 기록한다:
```bash
D="${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/design-feedback.mjs"
node "$D" prompt direction --brief docs/design/hero-brief.md     # 옮길 형식·체크리스트 (참고용)
node "$D" record direction --critique-file .nereus/design/direction.md --report .nereus/design/direction-raw.md
```
`--report` 는 impeccable 이 낸 **원본 보고서를 손대지 않고** 저장한 파일이다. 라운드에 그 해시가 남아, 옮긴 비평을 원본과 대조할 수 있다.
없으면 기록이 거절되고, 원본에 `DEGRADED` 가 있으면(서브에이전트 격리가 깨짐) 역시 거절된다.
브리프가 "깔끔하고 미니멀" 수준이면 그 자체가 지적 대상이다. 차단 지적이 남으면 브리프를 고치거나 0단계를 다른 다이얼로 다시 생성하고 다시 받는다.

### 2. visual — 렌더 결과 **후**
구현 후 실제 화면으로 비평받는다. 폭은 `design.widths`(기본 320/768/1440).

1. `impeccable` 스킬을 `critique <대상>` 으로 부른다(접근성·성능·반응형은 `audit <대상>` 을 더한다).
   impeccable critique 는 디자인 리뷰와 결정론적 detector 를 **서로 격리된 서브에이전트 둘**로 돌린다 — 새 맥락 비평이다.
   보고서 첫 줄에 `⚠️ DEGRADED` 가 있으면 격리가 깨진 것이다. 그 라운드는 기록하지 않고 다시 받는다.
2. 결과를 옮겨 기록한다. `--files` 에 적은 파일만 커버된다 — 빼먹으면 게이트가 계속 차단한다.
```bash
node "$D" record visual --critique-file .nereus/design/visual.md --report .nereus/design/visual-raw.md \
  --files src/components/hero/Hero.tsx,src/components/hero/hero.css
```

### 옮기는 형식 — impeccable 보고서 → 게이트
게이트 파서는 한 줄에 지적 하나, 심각도·축 태그, 마지막 줄 `VERDICT:` 를 읽는다. **옮기며 심각도를 낮추지 않는다** — 그러면 게이트가 느슨해진다.

| impeccable | 게이트 |
|---|---|
| P0 / blocker / 접근성 위반 | `[CRITICAL]` |
| P1 / priority issue | `[HIGH]` |
| P2 / minor observation | `[MEDIUM]` |
| P3 / nit | `[LOW]` |

축은 아래 "축" 표의 여덟 개 중 하나를 붙인다(`- [HIGH][a11y] 비활성 버튼 대비 2.4:1 — 명도를 올릴 것`).
고칠 것이 없으면 마지막 줄 `VERDICT: OK`, 아니면 `VERDICT: REVISE`. 직전 라운드 지적을 되돌리는 항목은 줄 앞에 `[REVERSAL]` 을 붙인다.
`prompt direction|visual` 이 같은 형식·체크리스트를 출력한다.

### 모션 검사 — 렌더 비평이 못 보는 것
정지 화면 비평은 모션 실수를 못 본다. diff 에서 결정적으로 잡는다(impeccable `animate` 는 모션을 **만드는** 쪽이다):
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/motion-check.mjs"            # 미커밋 diff
node "${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/motion-check.mjs" --base main
```
| 규칙 | 잡는 것 | 고치는 법 |
|---|---|---|
| `transition-all` | `transition: all`, `transition-all` | 바뀌는 속성만 명시 |
| `layout-prop` | width·height·top·left·margin·padding 전환 | transform·opacity |
| `scale-zero` | `scale(0)`, `scale-0` 에서 등장 | `scale(0.95)` + `opacity: 0` |
| `ease-in` | 진입·반응에 `ease-in` | `ease-out` 또는 커스텀 곡선 |
| `long-duration` | 500ms 초과 | UI 반응 150–300ms |
| `no-reduced-motion` | 모션을 추가했는데 reduced-motion 처리가 없음 | `prefers-reduced-motion`·`motion-reduce:` |

**권고다 — finish 게이트를 막지 않는다**(취향으로 막지 않는다는 위 원칙). 반영하거나, 의도한 것이면 이유를 남긴다.
저장소의 스타일·마크업 파일 어딘가에 전역 reduced-motion 처리(`globals.css` 의 `@media (prefers-reduced-motion)` 등)가 있으면 `no-reduced-motion` 은 묻지 않는다.
CI 등에서 막고 싶으면 `--strict`(지적이 있으면 종료코드 1). 규칙의 출처는 Emil Kowalski 의 공개 원칙이다 —
사람이 직접 깊게 보려면 동반 스킬 `/review-animations` (에이전트가 스스로 부를 수 없게 설정된 스킬이다).

### 현황 확인
```bash
node "$D" status            # 종료코드 0=통과, 1=차단
```

## 판정 규칙
- 커버는 **파일 내용 해시** 기준이다. 비평 후 그 파일을 고치면 그 파일만 STALE 이 되고 다시 비평받아야 한다. 무관한 백엔드 수정은 디자인 비평을 무효화하지 않는다.
- 기록한 비평에 `VERDICT: OK` 가 없거나, `[HIGH]`·`[CRITICAL]` 지적이 하나라도 있으면 **REVISE** 로 기록된다(fail-closed).
- **막는 것은 verdict 가 아니라 차단 축의 지적이다** (아래 "축"). 차단 0 건이면 REVISE 로 기록돼도 게이트는 통과한다.
- 차단이 남았는데 파일이 그대로면 `design_feedback_unaddressed` 로 차단된다. 고치고 다시 비평받는 것이 유일한 통로다.
- 신규 디자인 파일이 있는데 direction 라운드가 한 번도 없으면 `design_direction_missing` 으로 차단된다.

## 축 — 무엇이 막고 무엇이 권고인가

지적은 여덟 축 중 하나를 달고 나온다: `- [HIGH][a11y] …`
`hierarchy · rhythm · depth · type · color · states · template · a11y`

**막는 축은 셋뿐이다 — `a11y` · `hierarchy` · `states`.** 나머지는 REVISE 로 기록되지만 게이트를
막지 않는다. 축을 안 붙인 지적은 CRITICAL 만 차단으로 센다.

### 왜 (2026-09-13 googleplay-control)
같은 두 파일(`CampaignActionsCard.tsx`·`MidpointReplyModal.tsx`)에 visual 라운드가 다섯 번 돌았고
**전부 REVISE** 였다. 요구가 라운드마다 뒤집혔다.

| 라운드 | 요구 | 다음 라운드 |
|---|---|---|
| 2 | 320px 3열은 답답하다 → 세로 1열 스택으로 | 5: 세로 스택이 너무 크다 → 인라인 컴팩트로 |
| 2 | 1440px 유휴 공간 → 2열 그리드로 | 3·4: 2열 비율 재조정 → 5: 2열은 높이가 안 맞으니 세로로 |
| 3 | 표면 규칙을 한쪽으로 통일 | 5: 회색 섹션 배경을 제거 |

비평가는 매 라운드 처음 보는 사람이라 **직전에 자기가 시킨 것을 모른다.** 고칠수록 다시 걸렸다.
뒤집힌 것은 전부 배치·표면 취향(`rhythm`·`depth`·`template`)이었다. 재면 답이 나오는 축은
뒤집히지 않는다 — 대비는 숫자고, 포커스 링은 있거나 없고, 계층은 스케일 차이다.

그래서 두 가지를 고쳤다.
1. **차단 축을 고정했다.** 취향 축으로는 사람을 막지 않는다. 권고는 그대로 기록·보고된다.
2. **비평가에게 직전 라운드를 실어 준다.** 반영된 항목을 다시 지적하지 않게 하고, 되돌리려면
   `[REVERSAL]` 을 붙여 이전 판단의 무엇이 틀렸는지 적게 한다. `[REVERSAL]` 은 차단하지 않는다 —
   되돌릴지는 사람이 정한다.

차단 축을 바꾸려면 `design-feedback.mjs` 의 `BLOCKING_AXES` 를 고친다.

## 채널

**impeccable 하나다.** 이전의 브라우저 웹세션 → 웹세션 CLI → Antigravity CLI 사슬은 2026-11-12 에 없앴다.
- 웹세션은 쿠키(Windows App-Bound Encryption)·할당량·긴 이미지 비평의 스트림 끊김으로 자주 못 썼고, Antigravity CLI 는 이미지 첨부를 못 받았다.
- impeccable critique 는 격리된 서브에이전트로 비평한다 — 디자인 리뷰도 EGM(새 맥락) 원칙을 따른다.
- 예전 하위 명령(`direction`·`visual` 직접 실행)은 이제 안내만 내고 종료코드 2 로 끝난다.
- 예전 라운드 기록(옛 source 값)은 그대로 읽힌다. 새 라운드의 source 는 `impeccable` 이다.

### generate (0단계)
`ui-ux-pro-max` 로컬 데이터셋(python3, 네트워크·API 키 불필요). 스킬이 아니라 데이터 엔진으로만
설치한다 — 상류 번들에 `nereus:design` 과 트리거가 겹치는 `design` 스킬이 함께 들어 있다.

## 설정 (`.nereus/config.json` 또는 사용자 전역)
```json
{ "design": { "enforce": "block", "exclude": ["src/legacy/**"], "widths": [320, 768, 1440], "systemGenerator": "ui-ux-pro-max" } }
```
`enforce: "warn"` 으로 낮추면 findings 는 보고하되 차단하지 않는다. 기본은 `block`.

## 기록
라운드는 `.nereus/design-feedback.json` 에 최근 20건까지 남는다. 미이행 라운드는 finish 게이트와 Stop 훅이 알린다.

웹 이펙트 라이브러리를 참고할 때는 `references/web-effect-repos.md` 를 먼저 본다 — **라이선스부터 확인한다.**
