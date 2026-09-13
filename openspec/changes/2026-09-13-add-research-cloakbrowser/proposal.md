# add-research-cloakbrowser

## Why

조사에서 1차 자료가 403·Cloudflare·캡차로 막히는 일이 실제로 있다.
CloakBrowser(31.4k★, Playwright 드롭인, 래퍼 MIT)가 그 경로를 연다.

**브라우저 MCP 를 대체하지 않는다.** 우리 브라우저 용도는 우리 앱의 E2E·design 스크린샷·
SEO/Lighthouse 이고, 자기 사이트에 봇 탐지를 우회할 이유가 없다. 게다가 CloakBrowser 는
MCP 서버가 아니라 라이브러리이며 Lighthouse·CDP 트레이스·콘솔 수집이 **아예 없다.**
갈아끼우면 design 게이트와 SEO 감사가 통째로 죽는다.

## 무료 고정이 이 변경의 본체다

바이너리는 **v146 이하만 무료**(개인·상업 모두, 재배포 불가)이고 v148+ 는 Pro 구독이 있어야
**내려받아지지도 않는다**. 그런데 고정하지 않으면 기본값이 "최신"이다.
즉 핀 없는 실행은 "무료로 쓴다"가 아니라 **조용히 유료 경로로 간다**.

그래서 핀을 문서에 적는 데서 끝내지 않고 **검사한다.** 오타 난 핀을 무료로 단정하지도 않는다 —
`CLOAKBROWSER_VERSION=최신` 같은 값은 다운로드가 실패하기 전까지 드러나지 않는다.

근거 (확인 2026-09-13):
- https://github.com/CloakHQ/CloakBrowser/releases — 무료 최신 `chromium-v146.0.7680.177.5`,
  v148 이상은 전부 `-pro` 접미사
- README: "v146 and earlier — free for personal and commercial use, no redistribution.
  v148 and later — requires an active CloakBrowser Pro subscription to download."

## What Changes

- Add `skills/research/scripts/cloak.mjs` — `cloakPlan` 이 `free`·`pro`·`unpinned`·`unknown` 을
  판정하고 위반 4종(`unpinned`·`pro-version`·`license-key-set`·`unparsable`)을 낸다.
  핀 값은 여기 한 곳에만 둔다(`exportLine`).
- `skills/research/SKILL.md` 2.1 — **막혔을 때만** 쓴다. 안 쓰는 곳(E2E·design·SEO)을 명시.
  ToS 판단은 하네스가 하지 않는다. 이 경로로 받은 자료는 보고서에 표시한다.
- `skills/setup/scripts/detect.mjs` — 선택 도구로 추가. note 가 무료 핀을 못박는다.

## Impact

- 영향 스펙: `research` (요구사항 1개 추가)
- `.mcp.json` 은 **바뀌지 않는다.** chrome-devtools MCP 가 그대로 브라우저를 담당한다.
