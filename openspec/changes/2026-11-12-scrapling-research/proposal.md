# 조사 차단 우회를 Scrapling 으로 (scrapling-research)

## Problem

research §2.1 은 WebFetch 가 막혔을 때 CloakBrowser 를 썼다.
- 무료로 쓰려면 v146 빌드 고정을 따로 지켜야 했다(v148+ 는 Pro). 그 고정을 검사하는 스크립트까지 유지했다.
- 브라우저만 줄 뿐 본문 추출은 따로 해야 했다.
- 2026-11-12 스파이크에서 차단 사이트 6곳 중 2~3곳만 뚫었고, 재실행 결과가 흔들렸다.

## Goals

- §2.1 을 Scrapling(BSD-3) 2단계로: `get`(브라우저 없음, TLS 흉내) → 막히면 `fetch`(스텔스 + Cloudflare 풀이).
- 결과는 본문만 고른 Markdown.
- **차단 화면을 자료로 넘기지 않는다** — scrapling 은 차단 화면에도 종료 코드 0 이라 내용으로 판정한다.
- CloakBrowser 경로(cloak.mjs·테스트·setup 행)를 지운다.

## Non-Goals

- Scrapling MCP 서버(세션 상주), 크롤러(Spiders), 프록시 회전.
- 우리 앱의 E2E·SEO(agent-browser·Lighthouse 담당).

## Design

`skills/research/scripts/scrape.mjs`
- `blockedReason(text)`: 앞 3000자에서 차단 문구, 또는 800자 미만이면 이유를 낸다.
- `planSteps(url, outDir)`: get(60s) → fetch(180s), 둘 다 `--ai-targeted`.
- `scrapeEscalate(url, outDir, deps)`: 의존성 주입. 단계별 `{method, ok, sec, reason}` 을 `tried` 에 남긴다.
- CLI: `node scrape.mjs <url> [--out]` → JSON, 종료 코드 0/1. `PYTHONUTF8=1` 로 실행(한글 Windows 출력 크래시 방지).

스파이크 결과(일반 요청 403 인 6곳, 헤드리스):

| 사이트(보호) | get | fetch | CloakBrowser |
|---|---|---|---|
| nopecha(Turnstile) | ✗ | ✅ 2/2 | ✗ 2/2 |
| glassdoor(Cloudflare) | ✗ | ✅ 2/2 | 1/2 |
| indeed(Cloudflare) | ✗ | ✅ | ✅ |
| zillow(PerimeterX) | ✅ | ✅ | ✅ |
| g2(DataDome) | ✗ | ✗ | ✗ |
| coupang(Akamai) | ✗ | ✗ | ✗ |

Scrapling 의 `--executable-path` 로 CloakBrowser 바이너리를 돌린 조합은 1/6 으로 가장 나빴다 — 섞지 않는다.

## Alternatives Considered

| 안 | 버린 이유 |
|---|---|
| CloakBrowser 를 대체 경로로 남김 | CloakBrowser 만 뚫은 사이트가 없었다. 남기면 v146 고정 유지 부담만 남는다 |
| Scrapling MCP | 세션 상주 비용(agent-browser 전환으로 없앤 것) |

## Risks & Limits

- 표본이 작다(6곳 × 1~2회). 보호 방식이 바뀌면 결과도 바뀐다 — 실패는 `tried` 이유와 함께 보고된다.
- 설치가 무겁다(Python 3.10+, patchright 크롬 ~300MB). 선택 도구다.
- `scrapling install` 이 브라우저를 안 받는 일이 있었다 → setup note 에 `python -m patchright install chromium`.
- 안티봇 우회의 ToS 판단은 사용자가 한다(이전과 같음).
