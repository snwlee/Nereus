---
name: research
description: "Market and technology research procedure: gh search → web → last30days → Agent-Reach, producing a report + PDF under docs/research/. 트리거: \"조사\", \"리서치\", \"비교\"."
---

# research

nereus:common 규칙. 담당: researcher.

## 1. 질문 분해
요청을 3~6개 하위 질문으로 나누고 사용자에게 한 번 보여준다(수정 기회). 각 질문에 "어떤 근거가 답이 되는가"를 적는다.

## 2. 수집 순서 (앞 단계로 충분하면 뒤는 생략)
1. `gh search repos "<키워드>" --sort stars --limit 20 --json fullName,stargazersCount,pushedAt,description,license` / `gh search code`. 구현·라이브러리 질문은 여기서 대부분 끝난다.
2. WebSearch → 상위 결과 WebFetch. 공식 문서·1차 자료 우선. 날짜를 기록.
3. `last30days` 스킬(설치 시): Reddit/X/YouTube/HN 최근 30일 반응. 사용자 불만·실사용 후기용.
4. **Agent Reach**: 플랫폼 원문(트윗·영상 자막·스레드·RSS)이 필요할 때. **먼저 무엇이 살아 있는지 묻는다:**
   ```bash
   agent-reach doctor          # 채널별 현재 상태와 지금 쓰는 백엔드
   ```
   **백엔드를 여기 적지 않는다** — 상류가 주기적으로 갈아치운다(2026-03·2026-06 에 실제로 교체됐다).
   `doctor` 가 알려주는 경로를 그대로 쓴다. 미설치면 `/nereus:setup` 이 설치법을 낸다.
   **미설치를 "자료 없음"으로 읽지 않는다** — 채널이 없는 것이지 결과가 0인 게 아니다.
   무료로 바로 되는 것: 웹페이지 전문(Jina Reader), YouTube 자막, RSS/Atom.
   Twitter·Reddit·Instagram 등은 사용자의 기존 브라우저 세션이 필요하다 — 사용자가 직접 붙인다.

## 2.1 차단에 막혔을 때만 — Scrapling

WebFetch 가 403·캡차·Cloudflare 로 막혀 **1차 자료를 못 읽을 때만** 쓴다. 안 막혔으면 쓰지 않는다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/research/scripts/scrape.mjs" <URL>   # 결과: .nereus/research/scraped/*.md
```
가벼운 것부터 올린다 — `get`(브라우저 없이 크롬 TLS 흉내, 1~2초) → 막히면 `fetch`(스텔스 브라우저 + Cloudflare 풀이, 10~70초).
본문은 `--ai-targeted` 로 본문만 골라 정리한 Markdown 이다.

- **종료 코드가 아니라 내용으로 판정한다.** scrapling 은 차단 화면을 받아도 0 으로 끝난다. `scrape.mjs` 가 차단 화면·너무 짧은 응답을 걸러 `ok: false` 로 낸다 — 그 파일을 자료로 쓰지 않는다.
- `ok: false` 면 `tried` 의 이유를 보고서에 적고 다른 1차 자료를 찾는다. DataDome·Akamai 보호 사이트(예: g2·coupang)는 두 단계 모두 못 뚫었다(2026-11-12).
- 미설치면 `fix` 가 설치 명령을 준다(nereus:setup 의 scrapling 행).

근거 — 2026-11-12 스파이크(일반 요청이 403 인 사이트 6곳, 헤드리스, 사이트당 1~2회):
Scrapling `fetch` 4/6(재실행 동일), `get` 1/6, 이전 경로 CloakBrowser 2~3/6(glassdoor 재실행 시 차단).
CloakBrowser 가 뚫고 Scrapling 이 못 뚫은 곳은 없었다. CloakBrowser 는 무료 빌드 고정(v146)도 따로 지켜야 해서 뺐다.

**쓰지 않는 곳**: 우리 앱의 E2E · design 스크린샷 · SEO/Lighthouse. 전부 agent-browser·Lighthouse 가 한다. 자기 사이트에 봇 탐지를 우회할 이유가 없다.
MCP 서버(`scrapling mcp`)는 붙이지 않는다 — 세션마다 상주한다. CLI 로만 쓴다.

**판단은 사용자가 한다**: 이건 남의 사이트 안티봇 우회다. 대상 사이트 ToS 문제이며
하네스는 그것을 판정하지 않는다. 쓰기로 했으면 보고서에 어떤 자료를 이 경로로(어느 단계로) 받았는지 적는다 —
일반 경로로 받은 것과 구분되지 않으면 재현할 수 없다.

## 3. 검증
- 주장마다 출처 URL + 확인 날짜. 두 출처가 상충하면 둘 다 적고 판단 근거를 쓴다.
- 오픈소스 비교표 필수 열: 마지막 커밋일, 라이선스, 스타, 우리 스택(Flutter/Spring/TS) 적합성, Windows 지원.
- 숫자는 원문 그대로. 추정치는 "추정"이라고 표시.

## 4. 출력
`docs/research/<YYYY-MM-DD>-<slug>.md`:
1. 요약(3줄) 2. 질문과 답 3. 비교표 4. 추천 하나 + 이유 + 리스크 5. 출처 목록.
그 다음 `nereus:pdf --template research`로 같은 이름의 PDF.
