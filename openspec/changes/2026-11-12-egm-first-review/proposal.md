# 디자인 비평은 impeccable, 제3자 검증은 EGM (egm-first-review)

## Problem

디자인 비평과 리뷰 2차 의견이 Gemini 웹세션·agy·Codex 외부 CLI 에 기대고 있다.
- Gemini 웹세션은 쿠키(Windows App-Bound Encryption)·할당량·스트림 끊김(Pro)으로 자주 못 쓴다. agy 는 할당량 소진·이미지 첨부 불가.
- 디자인 비평가가 매 라운드 처음 보는 사람이라 요구가 뒤집혔다(2026-09-13 다섯 라운드).
- 사용자 방침(2026-11-12): 디자인 검토는 impeccable 1순위, 제3자 검증은 EGM 1순위로 충분, Gemini 는 무료 이미지 생성에만.

## Goals

- `nereus:design` 의 direction·visual 라운드는 impeccable(`shape` / `critique`·`audit`)로 받는다. 게이트·차단 축·파일 해시 커버는 그대로.
- `nereus:review` 의 2차 의견 기본은 EGM: 대화 맥락 없는 서브에이전트가 diff 와 스펙만 읽고 리뷰한다.
- Gemini 는 `nereus:image` 에만 남는다. 디자인·리뷰 코드에서 Gemini·agy 호출 경로를 없앤다.

## Non-Goals

- montage collage-broll 의 Gemini 유료 영상(외부 동반 스타일, video-gate 로 이미 승인 게이트).
- Codex 를 하네스(훅 호스트)로 쓰는 어댑터.

## Design

| 영역 | 이전 | 이후 |
|---|---|---|
| 디자인 direction | browser MCP→Gemini 웹 CLI→agy | `impeccable shape` 결과를 `record direction` |
| 디자인 visual | Gemini 웹 CLI(스크린샷 첨부) | `impeccable critique`(+`audit`) 결과를 `record visual --files` |
| 라운드 source | gemini-web·gemini-agy·gemini-mcp | `impeccable` |
| 리뷰 2차 의견 기본 | `both` = OCR+Codex+Gemini | `egm` = OCR+EGM |
| Codex | 기본 포함·필수 도구 | `secondOpinion: "codex"` 로 명시할 때만, 선택 도구 |
| agy | 선택 리뷰어·디자인 대체 채널 | 제거 |

EGM 리뷰어는 바이너리가 없다 — 이 세션이 `Agent`(general-purpose)로 띄우는 새 맥락 서브에이전트다. 프롬프트에는 대화의 결정·이유를 넣지 않고
diff 범위, 변경된 스펙 경로, goldfish 페르소나(`codebase_details.md`·`design_critic.md`)만 준다. 서브에이전트를 띄울 수 없으면 `skipped` 로 알린다(조용히 같은 맥락 리뷰로 대체하지 않는다).

## Alternatives Considered

| 안 | 버린 이유 |
|---|---|
| Gemini 를 후순위 대체 채널로 남김 | 사용자 방침이 "이미지 전용". 대체 채널로 남기면 쿠키·할당량 실패 처리 코드와 문서가 계속 유지 부담이 된다 |
| Codex 를 EGM 과 함께 기본 유지 | "EGM 만으로 충분" 방침. Codex 는 opt-in 으로 남겨 필요한 사람만 켠다 |
| impeccable 결과를 별도 게이트로 | 기존 게이트(해시 커버·차단 축·REVERSAL)는 실측으로 다듬어진 것이다. 출처만 바꾸는 편이 회귀가 적다 |

## Risks & Limits

- impeccable 은 동반 플러그인이다. 없으면 디자인 라운드를 받을 수 없다 → setup 이 안내하고, 게이트는 그대로 차단한다(조용히 통과시키지 않는다).
- impeccable 보고서 형식을 `[SEV][축]` 형식으로 옮기는 것은 이 세션이 한다. 옮기며 심각도를 낮추면 게이트가 느슨해진다 — SKILL 에 매핑표를 고정한다(P0→CRITICAL, P1→HIGH, P2→MEDIUM, P3→LOW).
- EGM 은 같은 모델의 새 맥락이다. 모델 고유의 맹점은 공유한다. 그것을 원하면 Codex 를 opt-in 한다.
