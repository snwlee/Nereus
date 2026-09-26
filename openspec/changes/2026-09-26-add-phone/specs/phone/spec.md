# phone Specification

## Purpose
에이전트가 사람에게 전화로 물어야 할 때, 준비 상태를 먼저 실측하고, 안전 규칙이 고정된 지시문으로 AI 가 대신 통화하게 한다.
발신은 외부로 나가는 행동이므로 사용자 승인 없이는 하지 않는다. 통화 내용은 기록으로 남기고 요약해 돌려준다.

## ADDED Requirements

### Requirement: 준비가 안 됐으면 발신을 막고 이유를 내야 한다
<!-- id: phone.readiness -->
<!-- entities: Judge -->
<!-- enforced: tests/skills/phone-judge.test.ts -->

The system MUST satisfy the following. `judge(probe, request)` 는 `risk` 가 `call` 일 때 다음 중 하나라도 해당하면 `block` 이어야 하고, 해당하는 사유 코드를 모두 `reasons` 에 실어야 한다.
env 필수 키 누락(`env-missing`), KYC 프로필이 `twilio-approved` 아님(`kyc-not-approved`), 잔액이 `MIN_BALANCE_USD` 미만(`balance-low`),
중계 서버 로컬 health 실패(`relay-local-down`), 공개 wss health 실패(`relay-public-down`).
`risk` 가 `read` 면 준비 실패여도 `go` 이고 사유만 싣는다 — 상태 조회는 막지 않는다.

#### Scenario: KYC 미승인
- **WHEN** `risk` `call`, probe `kyc` 가 `"draft"`, 나머지 정상, 승인 있음
- **THEN** `verdict` 가 `"block"`, `reasons` 에 `kyc-not-approved`

#### Scenario: 여러 문제는 모두 싣는다
- **WHEN** `risk` `call`, 잔액 0.5, 로컬 중계 down
- **THEN** `reasons` 에 `balance-low` 와 `relay-local-down` 이 둘 다 있다

#### Scenario: 조회는 막지 않는다
- **WHEN** `risk` `read`, KYC `draft`
- **THEN** `verdict` 가 `"go"`, `reasons` 에 `kyc-not-approved`

### Requirement: 번호·잡·시각이 안전할 때만 발신해야 한다
<!-- id: phone.request -->
<!-- entities: Judge -->
<!-- enforced: tests/skills/phone-judge.test.ts -->

The system MUST satisfy the following. 번호는 E.164(`+` 뒤 8~15자리)여야 하고(`bad-number`), 국가 코드를 알아야 하며(`country-unknown`), 그 국가가 Geo Permission 허용 목록에 있어야 한다(`geo-blocked`).
잡 지시문에 AI 고지 표식이 없거나(`disclosure-missing`), 카드번호처럼 보이는 13~19자리 숫자열이 있거나(`secret-in-job`), `timeLimitSec` 이 `MAX_CALL_SEC` 를 넘으면(`time-limit-too-long`) `block` 이다.
상대 현지 시각이 통화 허용 시간(기본 09:00~20:00, 잡의 `hours` 가 있으면 그것) 밖이면 `block` 이다(`outside-call-hours`).
위가 모두 통과해도 `approved` 가 없으면 `ask`(`needs-approval`)이고, 있으면 `go` 다.

#### Scenario: 승인 없는 발신
- **WHEN** 준비·번호·잡·시각 정상, `approved` false
- **THEN** `verdict` 가 `"ask"`, `reasons` 에 `needs-approval`

#### Scenario: 승인 있는 발신
- **WHEN** 준비·번호·잡·시각 정상, `approved` true
- **THEN** `verdict` 가 `"go"`, `reasons` 가 비었다

#### Scenario: 일본 밤 11시
- **WHEN** `to` `+81977852848`, 현지 23시
- **THEN** `verdict` 가 `"block"`, `reasons` 에 `outside-call-hours`

#### Scenario: 카드번호가 섞인 잡
- **WHEN** 지시문에 `4111 1111 1111 1111`
- **THEN** `reasons` 에 `secret-in-job`

### Requirement: 지시문은 브리프에서 만들고 안전 규칙을 빼먹을 수 없어야 한다
<!-- id: phone.brief -->
<!-- entities: Brief -->
<!-- enforced: tests/skills/phone-brief.test.ts -->

The system MUST satisfy the following. `buildJob(brief)` 는 `{to, language, instructions, timeLimitSec, hours}` 를 내야 한다. 지시문은 언제나 다음을 담는다:
언어별 첫 문장(AI 어시스턴트가 누구를 대신해 전화했는지), AI 고지 표식 `[AI-DISCLOSURE]`, 브리프 사실만 쓰고 지어내지 않기,
묻고 듣기만 하고 예약·변경·취소·결제·동의를 하지 않기(브리프 `mayCommit` 이 true 인 항목만 예외), 질문은 하나씩,
모르는 건 "본인이 따로 연락한다", 끝에 질문별 복창, 작별 뒤 `end_call`, 음성사서함·ARS 면 한 문장 사과 후 `end_call`.
`language` 가 `ja`·`ko`·`en` 이 아니거나 질문이 비었거나 `to`·`target`·`onBehalfOf` 가 없으면 에러를 던져야 한다.

#### Scenario: 일본어 식당 문의
- **WHEN** `language` `ja`, target `七厘焼き和作`, onBehalfOf `イ・ソヌ`, 질문 2개
- **THEN** 지시문이 `こちらはAIアシスタント` 로 여는 문장과 `[AI-DISCLOSURE]`, `end_call`, 두 질문을 모두 담는다

#### Scenario: 질문 없는 브리프
- **WHEN** `questions` 가 빈 배열
- **THEN** `buildJob` 이 에러를 던진다

### Requirement: 표준 라이브러리만으로 WebSocket 을 받아야 한다
<!-- id: phone.ws -->
<!-- entities: Ws -->
<!-- enforced: tests/skills/phone-ws.test.ts -->

The system MUST satisfy the following. `acceptKey(key)` 는 RFC 6455 의 `Sec-WebSocket-Accept` 를 내야 한다. `encodeFrame` 은 서버→클라이언트(마스크 없음) 텍스트 프레임을 125·65535 경계 길이 모두 올바르게 만들어야 한다.
`FrameDecoder` 는 클라이언트의 마스크된 프레임을 조각나 들어와도 합쳐 텍스트 메시지로 내고, close·ping 을 구분해야 한다.
`serve` 로 연 서버에 Node 내장 `WebSocket` 클라이언트가 붙어 텍스트를 주고받을 수 있어야 한다.

#### Scenario: RFC 예제 키
- **WHEN** `acceptKey("dGhlIHNhbXBsZSBub25jZQ==")`
- **THEN** `"s3pPLMBiTxaQ9kYGzzhZRbK+xOo="`

#### Scenario: 두 조각으로 온 마스크 프레임
- **WHEN** 마스크된 `"hello"` 프레임을 3바이트와 나머지로 나눠 `push`
- **THEN** 두 번째 `push` 뒤에 `{type:"text", data:"hello"}` 하나가 나온다

### Requirement: 중계는 기존 aicall 동작을 유지해야 한다 (역스펙 기준선)
<!-- id: phone.relay -->
<!-- entities: Relay -->
<!-- enforced: tests/skills/phone-relay.test.ts -->

The system MUST satisfy the following. 기준선: `Japan2026/tools/aicall/server.mjs` (2026-09-25). 중계는 비밀 경로(`<prefix>/<CALL_SECRET>/stream`)가 아닌 업그레이드를 끊어야 한다.
Twilio `start` 이벤트의 `customParameters.job` 으로 잡을 읽어 Realtime `session.update`(μ-law 입출력, 전사 언어, server VAD, `end_call` 도구)를 보내야 한다.
Twilio `media` 는 `input_audio_buffer.append` 로, Realtime `response.output_audio.delta` 는 Twilio `media` 로 넘겨야 한다.
상대가 말을 시작하면 Twilio 에 `clear` 를 보내고 AI 응답을 자른다. 상대가 `NO_SPEECH_KICK_MS` 동안 말이 없으면 AI 가 먼저 말한다.
전사(상대·AI)와 시스템 이벤트를 `logs/<callSid>.jsonl` 에 한 줄씩 남긴다.

#### Scenario: 가짜 Twilio·가짜 Realtime 사이 왕복
- **WHEN** 가짜 Realtime 서버가 `response.output_audio.delta` 와 전사를 보내고, 가짜 Twilio 가 `start`·`media` 를 보낸다
- **THEN** 가짜 Twilio 가 `media` 를 받고, 가짜 Realtime 이 `session.update` 와 `input_audio_buffer.append` 를 받고, 로그 파일에 `AI` 전사 줄이 있다

#### Scenario: 틀린 경로
- **WHEN** 비밀이 다른 경로로 업그레이드를 시도
- **THEN** 연결이 거절된다

### Requirement: 기록을 읽어 사람이 볼 요약을 내야 한다
<!-- id: phone.transcript -->
<!-- entities: Transcript -->
<!-- enforced: tests/skills/phone-transcript.test.ts -->

The system MUST satisfy the following. `parseLog(text)` 는 jsonl 을 `{turns:[{t,who,text}], ended, endedBy, errors}` 로 읽어야 한다.
`end_call` 이 있으면 `endedBy` 가 `"ai"`, `stop` 만 있으면 `"remote"`, 둘 다 없으면 `ended` 가 false 다. `system` 의 `error`·`실패` 줄은 `errors` 에 모은다.

#### Scenario: AI 가 끊은 통화
- **WHEN** 로그에 `상대`·`AI` 줄과 `end_call`, `stop`
- **THEN** `endedBy` 가 `"ai"`, `turns` 에 system 줄이 없다

### Requirement: 발신은 사람이 권한 창에서 허용해야 한다 (보안 리뷰 2026-09-26)
<!-- id: phone.approvalGate -->
<!-- entities: PhoneGate -->
<!-- enforced: tests/lib/phone-gate.test.ts -->

The system MUST satisfy the following. `call.mjs` 를 `--approved` 로 실행하는 Bash 명령은 PreToolUse 훅이 `permissionDecision: "ask"` 로 사람에게 묻고,
사유에 번호·상대·질문·확정 허용 여부를 한 줄로 보여야 한다. 브리프를 못 읽어도 `ask` 는 유지한다.

#### Scenario: 에이전트가 스스로 --approved 를 붙임
- **WHEN** `node call.mjs --brief b.json --id w --approved`
- **THEN** 훅 결과가 `ask` 이고 사유에 브리프의 번호와 질문이 있다

### Requirement: 중계는 우리가 건 통화의 스트림만 받아야 한다
<!-- id: phone.binding -->
<!-- entities: Relay, Call -->
<!-- enforced: tests/skills/phone-relay.test.ts -->

The system MUST satisfy the following. 발신 뒤 `bindCall` 이 잡에 `callSid` 를 적는다. 중계는 잡의 `callSid` 와 다른 `start` 를 거절하고 Realtime 에 붙지 않으며, 그 callSid 를 끊지도 않는다.
같은 callSid 의 두 번째 스트림은 거절한다. 발신한 잡은 `saveJob` 이 덮어쓰지 않는다. 깨진 메시지는 그 연결만 닫고 서버는 계속 돈다.
기록 디렉터리는 0700, 기록·잡 파일은 0600 이다. WebSocket 프레임은 `MAX_FRAME`, 메시지는 `MAX_MESSAGE` 를 넘으면 연결을 끊는다.

#### Scenario: 남의 callSid
- **WHEN** 잡 `callSid` 가 `CAtest` 인데 `start.callSid` 가 `CAother`
- **THEN** `session.update` 가 가지 않고, hangup 도 부르지 않는다
