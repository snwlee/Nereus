# 브라우저 1순위를 agent-browser 로 (agent-browser-first)

## Problem

nereus 는 `.mcp.json` 에 `browser`(chrome-devtools-mcp)를 상주 MCP 로 넣어 두었다.
- 세션마다 npx 3단 프로세스로 뜬다. 세션당 RAM 1~2GB 의 범인이었다(2026-09-21 실측). 세션이 많으면 배수로 붙는다.
- ecc 도 같은 이름의 MCP 를 붙여 서로를 가렸다(플러그인 업데이트 때 되살아남).
- 도구 30여 개의 스키마가 매 세션 컨텍스트를 먹는다. 실제로 쓰는 것은 스크린샷·이동·콘솔·lighthouse 4개뿐이었다.

## Goals

- 브라우저 작업(e2e 따라가기·스크린샷·콘솔)은 `agent-browser` CLI(vercel-labs, Apache-2.0)가 1순위다. 쓸 때만 데몬이 뜨고 1시간 유휴면 닫힌다.
- 처음 쓰기 전에 `agent-browser skills get core` 로 현재 버전 사용법을 읽는다 — 버전마다 명령이 바뀐다(0.42 엔 `vitals` 가 없다).
- Lighthouse 는 `npx -y lighthouse@12` 로 돈다. 실험실 측정은 INP 를 내지 않으므로 TBT 를 대리 지표로 밝힌다.
- setup·세션 시작이 agent-browser 를 필수 도구로 감지한다.

## Non-Goals

- Playwright 회귀 스위트 교체. 스펙 파일 러너는 Playwright 그대로다 — agent-browser 는 손으로 따라가는 확인·증거 수집용.
- research 의 CloakBrowser(차단 우회) 대체.
- mcp-doctor 의 chrome-devtools-mcp 프로세스 패턴 삭제 — 다른 플러그인이 띄운 것을 진단하는 데 여전히 쓴다.

## Design

| 영역 | 이전 | 이후 |
|---|---|---|
| `.mcp.json` | `browser` + `context7` | `context7` |
| frontend·qa 시각/콘솔 | `mcp__plugin_nereus_browser__*` 3개 | `agent-browser screenshot`·`errors` (Bash) |
| seo CWV | `lighthouse_audit` MCP | `npx -y lighthouse@12 … --form-factor=mobile` / `--preset=desktop`, TBT 대리 |
| e2e | Playwright 만 | Playwright(회귀) + agent-browser(따라가기·증거) |
| setup 감지 | — | agent-browser 필수, `npm install -g agent-browser` + `agent-browser install` |

로그인된 사용자 Chrome 에 붙는 `--auto-connect`·`--cdp` 는 사용자가 그 세션을 쓰라고 한 때만 쓴다.

## Alternatives Considered

| 안 | 버린 이유 |
|---|---|
| chrome-devtools-mcp 를 남기고 agent-browser 추가 | 상주 비용이 그대로 남는다. 문제의 본체가 상주다 |
| Playwright MCP | 같은 상주 모델이다 |
| Lighthouse 를 agent-browser 로 | 0.42 에 성능 감사 명령이 없다. npx lighthouse 가 실측으로 동작했다 |

## Risks & Limits

- agent-browser 가 없으면 브라우저 확인을 못 한다 → session-start 가 누락을 알리고 setup 이 설치를 안내한다.
- CLI 명령이 버전마다 바뀐다 → 문서에 명령을 고정하지 않고 `skills get core` 로 읽게 했다. 문서의 예시 명령은 0.42 기준.
- npx lighthouse 는 첫 실행에 패키지를 받는다(사내망에서 npm 레지스트리 접근 필요).
