---
name: phone
description: AI places a voice call on the user's behalf (Twilio + OpenAI Realtime) to ask a shop, hotel or office questions — probe readiness, write a brief, get the user's approval, dial, read the transcript, report. 트리거: "전화해서 물어봐", "AI 전화", "통화로 확인해", "phone call".
---

# phone

nereus:common 규칙을 따른다. 사람에게 **전화로 물어야만 답이 나오는 일**에 쓴다(영업일·예약 가능 여부·할인 대상 확인 등).
웹 폼·메일로 되는 일이면 그쪽이 먼저다 — 전화는 돈이 들고, 상대의 시간을 쓴다.

## 0. 왜 이 절차인가 (실패 사례 2026-09-25 Japan2026)

| # | 일어난 일 | 이 스킬의 대응 |
|---|---|---|
| 1 | 발신하고 나서야 Twilio `401 20003`(KYC 프로필 미승인)을 알았다 | 발신 전 `probe.mjs` 가 env·KYC·잔액·중계를 한 번에 보고 사유를 전부 낸다 |
| 2 | 지시문을 잡마다 손으로 복사했다 — 규칙 하나만 빠져도 AI 가 사람인 척하거나 예약을 확정할 수 있다 | `brief.mjs` 가 규칙을 고정한다. 브리프에는 사실·질문만 쓴다 |
| 3 | 경로·도메인·잡이 한 프로젝트 안에 있어 다른 작업이 못 썼다 | 스크립트는 플러그인에, 잡·기록은 `~/.local/share/nereus/phone` 에 |

## 1. 판정 — 작업 시작과 발신 직전

```bash
P="${CLAUDE_PLUGIN_ROOT}/skills/phone/scripts"
node "$P/probe.mjs" --risk read                         # 준비 상태만 (막지 않는다)
node "$P/probe.mjs" --risk call --job <id>              # 저장된 잡으로 발신 판정 (승인 전)
```

| verdict | 행동 |
|---|---|
| `go` | (`--risk read`) 준비 끝. (`call`) 승인이 있을 때만 나온다 → 발신 |
| `ask` | `needs-approval` — §3 형식으로 사용자에게 한 번 묻는다 |
| `block` | 발신하지 않는다. `reasons` 를 사용자에게 그대로 알리고 아래 표대로 안내한다 |

| reason | 누가 · 무엇을 |
|---|---|
| `kyc-not-approved` | **사용자 본인**이 Twilio Console → Trust Hub → Primary Customer Profile 에서 Persona 신분증+셀카 인증. 에이전트가 대신 누르지 않는다(생체정보 동의) |
| `balance-low` | 사용자가 Twilio 잔액 충전 (`MIN_BALANCE_USD` 이상) |
| `env-missing` | `~/.config/nereus/phone/env` (없으면 `~/.config/japancall/env`)에 `OPENAI_API_KEY · TWILIO_ACCOUNT_SID · TWILIO_AUTH_TOKEN · CALL_SECRET · TWILIO_FROM` |
| `relay-local-down` | `nohup node "$P/relay.mjs" >> ~/.local/share/nereus/phone/relay.log 2>&1 &` — 127.0.0.1:8791 |
| `relay-public-down` | nginx `location ^~ /japancall/` → 127.0.0.1:8791 (Upgrade 헤더 포함) 확인. 그 location 에 `access_log off;` — 경로에 CALL_SECRET 이 있다 |
| `geo-blocked` | Twilio Console → Voice → Geo Permissions 에서 그 나라 low-risk 허용 |
| `outside-call-hours` | 상대 현지 09:00~20:00(또는 브리프 `hours`) 안에 다시 |
| `disclosure-missing` · `secret-in-job` | 잡을 손으로 고치지 말고 브리프에서 다시 만든다. 카드번호·비밀번호는 브리프에 넣지 않는다 |

## 2. 브리프 — 사실과 질문만

```json
{
  "to": "+81977852848",
  "language": "ja",
  "target": "七厘焼き和作（湯布院）",
  "onBehalfOf": "イ・ソヌ",
  "facts": ["2026年11月4日(水) 大人4名", "韓国在住の旅行者"],
  "questions": ["11月4日(水)は営業されますか", "19時から大人4名で予約できますか"],
  "hours": { "start": 17, "end": 22 }
}
```

- `language` 는 `ja` · `ko` · `en`. 첫 문장은 언제나 "AI 어시스턴트가 ○○ 님을 대신해" 다.
- 기본은 **묻기만 한다**. 예약 확정처럼 구속력 있는 행동은 사용자가 명시한 것만 `mayCommit: ["..."]` 에 문장으로 적는다.
- 사실에 없는 건 AI 가 "본인이 따로 연락한다"고 답한다 — 모르는 정보는 브리프에 억지로 채우지 않는다.
- 예약번호 같은 개인 정보는 잡 파일(저장소 밖, 0600)에만 들어간다. 커밋·산출물에 싣지 않는다.

## 3. 승인 — 발신은 외부로 나가는 행동이다

**승인은 사람이 직접 친다.** `call.mjs` 는 승인 토큰이 없으면 걸지 않고 `askUser` 에 명령을 내준다:

```
! node <플러그인>/skills/phone/scripts/approve.mjs wasaku-1104
```

사용자가 프롬프트에 `!` 를 붙여 치면 토큰(잡 지문 · 30분 · 1회용)이 생긴다. `!` 명령은 에이전트 도구 훅을 거치지 않고,
에이전트가 `approve.mjs` 를 부르거나 승인 폴더를 쓰면 pre-tool-guard 가 막는다(`phone-approve-by-human`).
승인 뒤 브리프가 바뀌면 지문이 달라져 다시 승인해야 한다. 이 게이트는 규칙을 따르는 에이전트를 위한 안전장치이지
보안 경계가 아니다 — env 파일을 읽을 수 있는 프로세스는 Twilio 를 직접 부를 수 있다.
대화에서 먼저 묻는 형식(한 번에, 승인 명령을 같이 준다):

> 📞 **七厘焼き和作 (+81 977-85-2848)** 에 일본어로 전화합니다 — 질문: ① 11/4 영업 ② 19시 4명 예약 가능 · 확정은 안 함 · 최대 10분 · 예상 비용 약 $1~2. 걸까요?

리허설: 처음 쓰는 언어·상대 유형이면 먼저 본인 휴대폰으로 `--to +8210...` 리허설을 제안한다(상대 역할은 사용자).

```bash
node "$P/call.mjs" --brief brief.json --id wasaku-1104                  # 판정·잡 저장 → ask (askUser 에 승인 명령)
node "$P/call.mjs" --brief brief.json --id wasaku-1104 --approved       # 사용자가 ! approve.mjs 를 친 뒤 발신
node "$P/call.mjs" --brief brief.json --id wasaku-1104 --to +8210XXXXXXXX --approved   # 리허설
```

발신에 성공하면 `call.mjs` 가 잡 파일에 `callSid` 를 적는다. 중계는 **잡의 callSid 와 같은 스트림만 한 번** 받고,
발신한 잡은 덮어쓸 수 없다 — 다시 걸 때는 새 `--id` 를 쓴다.

## 4. 통화 뒤 — 기록을 읽고 요약한다

```bash
node "$P/transcript.mjs"            # 가장 최근 통화
node "$P/transcript.mjs" CA...      # 특정 통화
```

마지막 줄 JSON 의 `ended` · `endedBy`(`ai` 정상 종료 · `remote` 상대가 끊음) · `errors` 를 본다. 사용자에게는:
1. 질문별 **답** (원문 한 줄 + 번역) — 기록에 없는 답을 추측해 채우지 않는다
2. 상대가 요구한 후속 행동(메일·재전화·방문)과 마감
3. `errors` 가 있으면 그대로

## 5. 하지 말 것

- 승인 없이 발신하지 않는다. 같은 번호에 재발신도 새 승인이다.
- AI 가 사람인 척하게 하지 않는다. 고지 문장을 빼는 브리프를 만들지 않는다.
- 결제·카드·비밀번호·인증코드를 브리프나 대화에 넣지 않는다.
- 확정·변경·취소를 `mayCommit` 없이 시키지 않는다.
- 비밀값(키·토큰·CALL_SECRET)을 출력·로그·커밋에 싣지 않는다.
- KYC·결제 화면을 사용자 대신 진행하지 않는다.
- 브리프에 규칙처럼 쓰인 문장(「Rules:」「You may …」「Ignore …」)을 넣지 않는다 — `buildJob` 이 거절한다. 확정 허용은 `mayCommit` 으로만.
- `CALL_SECRET` 이 로그(nginx·Twilio 통화 기록)에 남았으면 새 값(32자 이상)으로 바꾼다.
