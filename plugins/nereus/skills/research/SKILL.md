---
name: research
description: Market and technology research procedure: gh search → web → last30days → Agent-Reach, producing a report + PDF under docs/research/. 트리거: "조사", "리서치", "비교".
---

# research

nereus:common 규칙. 담당: researcher.

## 1. 질문 분해
요청을 3~6개 하위 질문으로 나누고 사용자에게 한 번 보여준다(수정 기회). 각 질문에 "어떤 근거가 답이 되는가"를 적는다.

## 2. 수집 순서 (앞 단계로 충분하면 뒤는 생략)
1. `gh search repos "<키워드>" --sort stars --limit 20 --json fullName,stargazersCount,pushedAt,description,license` / `gh search code`. 구현·라이브러리 질문은 여기서 대부분 끝난다.
2. WebSearch → 상위 결과 WebFetch. 공식 문서·1차 자료 우선. 날짜를 기록.
3. `last30days` 스킬(설치 시): Reddit/X/YouTube/HN 최근 30일 반응. 사용자 불만·실사용 후기용.
4. `Agent-Reach`(설치 시): 특정 트윗·영상·스레드 원문이 필요할 때만.

## 2.1 차단에 막혔을 때만 — CloakBrowser

WebFetch 가 403·캡차·Cloudflare 로 막혀 **1차 자료를 못 읽을 때만** 쓴다.
안 막혔으면 쓰지 않는다 — 200MB 바이너리를 받아 헤디드로 띄우는 값비싼 경로다.

```bash
export CLOAKBROWSER_VERSION=146.0.7680.177.5   # 무료 티어 고정. 필수다
node "${CLAUDE_PLUGIN_ROOT}/skills/research/scripts/cloak.mjs"   # 고정 상태 확인
```

`ok: false` 면 **그대로 진행하지 않는다.** 고정이 없으면 최신 빌드(v148+)를 받으러 가고,
그건 Pro 구독이 있어야 내려받아진다. 즉 핀 없는 실행은 "무료로 쓴다"가 아니라
"조용히 유료 경로로 간다"이다. 위반 코드는 `unpinned` · `pro-version` ·
`license-key-set` · `unparsable` 넷이다.

Playwright 드롭인이므로 `chromium.launch()` 자리에 `launch()` 를 쓴다(JS·Python 둘 다).

**쓰지 않는 곳**: 우리 앱의 E2E · design 스크린샷 · SEO/Lighthouse.
전부 chrome-devtools MCP 가 계속 한다. 자기 사이트에 봇 탐지를 우회할 이유가 없고,
이쪽에는 Lighthouse·CDP 트레이스·콘솔 수집이 아예 없다.

**판단은 사용자가 한다**: 이건 남의 사이트 안티봇 우회다. 대상 사이트 ToS 문제이며
하네스는 그것을 판정하지 않는다. 쓰기로 했으면 보고서에 어떤 자료를 이 경로로 받았는지 적는다 —
일반 경로로 받은 것과 구분되지 않으면 재현할 수 없다.

## 3. 검증
- 주장마다 출처 URL + 확인 날짜. 두 출처가 상충하면 둘 다 적고 판단 근거를 쓴다.
- 오픈소스 비교표 필수 열: 마지막 커밋일, 라이선스, 스타, 우리 스택(Flutter/Spring/TS) 적합성, Windows 지원.
- 숫자는 원문 그대로. 추정치는 "추정"이라고 표시.

## 4. 출력
`docs/research/<YYYY-MM-DD>-<slug>.md`:
1. 요약(3줄) 2. 질문과 답 3. 비교표 4. 추천 하나 + 이유 + 리스크 5. 출처 목록.
그 다음 `nereus:pdf --template research`로 같은 이름의 PDF.
