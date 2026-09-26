# add-phone

## Why

에이전트가 **사람에게 전화로 물어야만 답이 나오는 일**을 만났을 때 Nereus 에는 절차가 없었다.
2026-09-25 Japan2026 세션에서 식당·호텔에 물을 게 생겼다(영업일, 19시 예약, 부흥 할인 대상).
다른 세션이 Twilio + OpenAI Realtime 중계를 손으로 만들어 리허설 통화까지 갔지만, 세 가지가 매번 사람 몫이었다.

1. **준비 상태를 몰랐다.** 발신하고 나서야 401 20003(KYC 프로필 미승인)을 알았다. 잔액·중계 서버·Geo 허용도 따로 확인해야 했다.
2. **지시문을 손으로 썼다.** "AI 라고 먼저 밝힌다 · 사실만 · 확정·결제 금지 · 끝에 복창 · end_call" 을 잡마다 복사했다. 하나 빠지면 AI 가 사람인 척하거나 예약을 확정할 수 있다.
3. **Japan2026 에 묶여 있었다.** 경로·도메인·잡이 그 프로젝트 안이라 다른 작업이 쓸 수 없었다.

## What Changes

- 새 스킬 `nereus:phone` — 준비 판정 → 브리프로 잡 작성 → **사용자 승인** → 발신 → 기록 → 요약.
- `scripts/judge.mjs` (순수): 준비 상태(env·KYC·잔액·중계)와 요청(번호·잡·현지 시각·승인)으로 `go` · `ask` · `block` 과 사유 코드를 낸다. 발신은 승인 없으면 항상 `ask`.
- `scripts/brief.mjs` (순수): 브리프(상대·언어·대리인·사실·질문)로 지시문을 만든다. 안전 규칙은 템플릿에 고정돼 빠질 수 없다.
- `scripts/ws.mjs` (순수 + 소켓 어댑터): 표준 라이브러리만으로 WebSocket 서버 핸드셰이크와 프레임 코덱. 기존 `ws` npm 의존을 없앤다.
- `scripts/relay.mjs`: Twilio Media Streams ↔ OpenAI Realtime 중계(기존 `server.mjs` 이식).
- `scripts/{config,twilio,probe,call,transcript}.mjs`: 설정 로드, Twilio REST, 실측 CLI, 발신 CLI, 기록 파서.
- 라우터에 `nereus:phone` 라우트 추가 — 걸기 동사만.

## Impact

- 새 파일: `plugins/nereus/skills/phone/{SKILL.md,scripts/*.mjs}`
- 수정: `plugins/nereus/hooks/scripts/lib/router.mjs`, 버전·스킬 수 표기
- 테스트: `tests/skills/phone-*.test.ts`, `tests/lib/router.test.ts`
- 사용자 데이터: `~/.config/nereus/phone/env`(없으면 `~/.config/japancall/env`), `~/.local/share/nereus/phone/{jobs,logs}` — 저장소 밖
- 외부: Twilio 계정(KYC 승인 필요), OpenAI Realtime, 공개 wss 경로(nginx `/japancall/` → 127.0.0.1:8791, 이미 있음)
