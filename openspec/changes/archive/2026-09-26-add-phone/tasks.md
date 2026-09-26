# Tasks — add-phone

- [x] T1. 준비·요청 판정 순수 함수 judge
  - Files: Create `plugins/nereus/skills/phone/scripts/judge.mjs` · Test `tests/skills/phone-judge.test.ts`
  - Interfaces: Consumes 없음 · Produces `judge(probe, request): { verdict, reasons }`, `countryOf(e164): {iso, tz} | null`, `MIN_BALANCE_USD`, `MAX_CALL_SEC`, `DEFAULT_HOURS`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { judge } from "../../plugins/nereus/skills/phone/scripts/judge.mjs";
      const probeOk = (over = {}) => ({ envMissing: [], kyc: "twilio-approved", balanceUsd: 20, relayLocal: true, relayPublic: true, geo: ["JP", "KR"], ...over });
      const job = { instructions: "[AI-DISCLOSURE] こちらはAIアシスタントです", language: "ja", timeLimitSec: 600 };
      const req = (over = {}) => ({ risk: "call", to: "+81977852848", job, localHour: 14, approved: true, ...over });
      it("KYC 미승인은 block", () => {
        const r = judge(probeOk({ kyc: "draft" }), req());
        expect(r.verdict).toBe("block");
        expect(r.reasons).toContain("kyc-not-approved");
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/phone-judge.test.ts` · Expected: FAIL (judge.mjs 없음)
    - [x] 최소 구현: spec phone.readiness · phone.request 시나리오 7개(KYC 미승인, 여러 문제, 조회 go, 승인 없음 ask, 승인 go, 일본 23시, 카드번호)를 통과하는 judge 와 국가 표(+81 JP Asia/Tokyo, +82 KR Asia/Seoul, +1 US America/New_York, +86 CN, +852 HK, +886 TW, +65 SG, +66 TH, +84 VN, +63 PH, +61 AU, +44 GB, +33 FR, +49 DE — 긴 접두어 우선)
    - [x] 통과 확인: Run `npx vitest run tests/skills/phone-judge.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/phone/scripts/judge.mjs tests/skills/phone-judge.test.ts && git commit -m "feat(phone): 준비·요청 판정"`
  - Done when: readiness·request 시나리오 7개와 `countryOf("+85221234567")` 가 HK 인 테스트가 통과한다

- [x] T2. 브리프 → 잡 지시문
  - Files: Create `plugins/nereus/skills/phone/scripts/brief.mjs` · Test `tests/skills/phone-brief.test.ts`
  - Interfaces: Consumes 없음 · Produces `buildJob(brief): { to, language, instructions, timeLimitSec, hours }`, `DISCLOSURE_TAG = "[AI-DISCLOSURE]"`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { buildJob, DISCLOSURE_TAG } from "../../plugins/nereus/skills/phone/scripts/brief.mjs";
      const brief = { to: "+81977852848", language: "ja", target: "七厘焼き和作", onBehalfOf: "イ・ソヌ",
        facts: ["2026年11月4日(水) 大人4名"], questions: ["11月4日は営業されますか", "19時に4名で予約できますか"] };
      it("일본어 식당 문의 지시문", () => {
        const j = buildJob(brief);
        expect(j.instructions).toContain("こちらはAIアシスタント");
        expect(j.instructions).toContain(DISCLOSURE_TAG);
        expect(j.instructions).toContain("end_call");
        for (const q of brief.questions) expect(j.instructions).toContain(q);
      });
      it("질문이 없으면 에러", () => {
        expect(() => buildJob({ ...brief, questions: [] })).toThrow();
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/phone-brief.test.ts` · Expected: FAIL (brief.mjs 없음)
    - [x] 최소 구현: 언어별 첫 문장(ja/ko/en), 고정 규칙 블록(기존 aicall jobs 의 Rules 문구 이식), `mayCommit` 항목만 확정 허용 문장, 기본 `timeLimitSec` 600, `hours` 는 브리프 값 또는 `DEFAULT_HOURS`
    - [x] 통과 확인: Run `npx vitest run tests/skills/phone-brief.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/phone/scripts/brief.mjs tests/skills/phone-brief.test.ts && git commit -m "feat(phone): 브리프에서 지시문 생성"`
  - Done when: 두 시나리오와 "judge 가 buildJob 결과를 disclosure-missing 없이 통과시킨다" 테스트가 통과한다

- [x] T3. 표준 라이브러리 WebSocket 서버
  - Files: Create `plugins/nereus/skills/phone/scripts/ws.mjs` · Test `tests/skills/phone-ws.test.ts`
  - Interfaces: Consumes `node:crypto`, `node:http` · Produces `acceptKey(key)`, `encodeFrame(data, opcode = 1)`, `class FrameDecoder { push(buf): 배열 {type, data}[] }`, `upgrade(req, socket): Conn`, `Conn { send(text), close(), on(event, fn) }` (event: message·close)
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { acceptKey, encodeFrame, FrameDecoder } from "../../plugins/nereus/skills/phone/scripts/ws.mjs";
      const masked = (text: string) => {
        const p = Buffer.from(text), m = Buffer.from([1, 2, 3, 4]);
        return Buffer.concat([Buffer.from([0x81, 0x80 | p.length]), m, Buffer.from(p.map((b, i) => b ^ m[i % 4]))]);
      };
      it("RFC 예제 키", () => expect(acceptKey("dGhlIHNhbXBsZSBub25jZQ==")).toBe("s3pPLMBiTxaQ9kYGzzhZRbK+xOo="));
      it("두 조각 프레임", () => {
        const d = new FrameDecoder(), f = masked("hello");
        expect(d.push(f.subarray(0, 3))).toEqual([]);
        expect(d.push(f.subarray(3))).toEqual([{ type: "text", data: "hello" }]);
      });
      it("126 길이 헤더", () => expect(encodeFrame("x".repeat(200)).subarray(0, 4)).toEqual(Buffer.from([0x81, 126, 0, 200])));
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/phone-ws.test.ts` · Expected: FAIL (ws.mjs 없음)
    - [x] 최소 구현: 핸드셰이크 101 응답, 7/16/64비트 길이, 마스크 해제, 조각 이어붙이기, ping→pong, close 응답
    - [x] 통합 테스트 추가: `http.createServer` + `upgrade` 에 Node 내장 `WebSocket` 으로 붙어 `"ping-text"` 를 보내고 되돌려받는다
    - [x] 통과 확인: Run `npx vitest run tests/skills/phone-ws.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/phone/scripts/ws.mjs tests/skills/phone-ws.test.ts && git commit -m "feat(phone): 표준 라이브러리 WebSocket 서버"`
  - Done when: 코덱 테스트 3개와 내장 클라이언트 왕복 테스트가 통과한다

- [x] T4. 통화 기록 파서
  - Files: Create `plugins/nereus/skills/phone/scripts/transcript.mjs` · Test `tests/skills/phone-transcript.test.ts`
  - Interfaces: Consumes 없음 · Produces `parseLog(text): { turns, ended, endedBy, errors }`, CLI `node transcript.mjs [CALL_SID]`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { parseLog } from "../../plugins/nereus/skills/phone/scripts/transcript.mjs";
      const line = (who: string, text: string) => JSON.stringify({ t: "2026-11-01T01:00:00.000Z", who, text });
      it("AI 가 끊은 통화", () => {
        const r = parseLog([line("system", "start job=x"), line("상대", "はい"), line("AI", "失礼します"), line("system", "end_call"), line("system", "stop")].join("\n"));
        expect(r.endedBy).toBe("ai");
        expect(r.turns.map((t) => t.who)).toEqual(["상대", "AI"]);
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/phone-transcript.test.ts` · Expected: FAIL (transcript.mjs 없음)
    - [x] 최소 구현: 빈 줄 무시, system 분리, `error`·`실패` 포함 system 줄은 errors, CLI 는 logs 디렉터리 최신 파일
    - [x] 통과 확인: Run `npx vitest run tests/skills/phone-transcript.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/phone/scripts/transcript.mjs tests/skills/phone-transcript.test.ts && git commit -m "feat(phone): 통화 기록 파서"`
  - Done when: AI 종료·원격 종료·미종료 세 경우 테스트가 통과한다

- [x] T5. 설정 로드 · Twilio REST · 실측 probe
  - Files: Create `plugins/nereus/skills/phone/scripts/config.mjs` · Create `plugins/nereus/skills/phone/scripts/twilio.mjs` · Create `plugins/nereus/skills/phone/scripts/probe.mjs` · Test `tests/skills/phone-probe.test.ts`
  - Interfaces: Consumes `judge(probe, request)` · Produces `loadEnv({ required, files })`, `paths()`, `twilio(env, method, path, form)`, `readinessFrom({ profiles, balance, geo }): { kyc, balanceUsd, geo }`, CLI `node probe.mjs [--risk read|call] [--job ID] [--approved]`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { readinessFrom } from "../../plugins/nereus/skills/phone/scripts/probe.mjs";
      import { loadEnv } from "../../plugins/nereus/skills/phone/scripts/config.mjs";
      it("Trust Hub draft 는 kyc draft", () => {
        const r = readinessFrom({ profiles: { results: [{ status: "draft" }] }, balance: { balance: "20.0" }, geo: { content: [{ iso_code: "JP", low_risk_numbers_enabled: true }] } });
        expect(r).toEqual({ kyc: "draft", balanceUsd: 20, geo: ["JP"] });
      });
      it("첫 파일이 없으면 두 번째 파일에서 읽는다", () => {
        const env = loadEnv({ required: ["A"], files: ["/nonexistent/env", "tests/fixtures/phone/env"] });
        expect(env.A).toBe("1");
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/phone-probe.test.ts` · Expected: FAIL (probe.mjs 없음)
    - [x] 최소 구현: `tests/fixtures/phone/env` 에 `A=1` 한 줄, env 파일 순서 `~/.config/nereus/phone/env` → `~/.config/japancall/env`, 데이터 경로 `~/.local/share/nereus/phone/{jobs,logs}`, probe 는 계정·Trust Hub·잔액·Geo·로컬/공개 health 를 조회하고 judge 결과 JSON 을 출력(비밀값 출력 금지)
    - [x] 통과 확인: Run `npx vitest run tests/skills/phone-probe.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/phone/scripts/config.mjs plugins/nereus/skills/phone/scripts/twilio.mjs plugins/nereus/skills/phone/scripts/probe.mjs tests/skills/phone-probe.test.ts tests/fixtures/phone && git commit -m "feat(phone): 설정·Twilio·실측 probe"`
  - Done when: 테스트 통과, 이 맥에서 `node probe.mjs --risk read` 가 `kyc-not-approved` 를 담은 JSON 을 낸다

- [x] T6. 중계 서버 이식 [flow]
  - Files: Create `plugins/nereus/skills/phone/scripts/relay.mjs` · Test `tests/skills/phone-relay.test.ts`
  - Interfaces: Consumes `upgrade(req, socket)`, `loadEnv`, `paths()`, `twilio` · Produces `startRelay({ port, secret, prefix, openaiUrl, openaiKey, jobsDir, logsDir, hangup }): Promise({ port, close() })`, `NO_SPEECH_KICK_MS`, CLI `node relay.mjs`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { startRelay } from "../../plugins/nereus/skills/phone/scripts/relay.mjs";
      it("가짜 Twilio ↔ 가짜 Realtime 왕복", async () => {
        const fake = await startFakeRealtime();          // ws.mjs upgrade 로 연 서버, session.update 받으면 audio delta·전사를 보낸다
        const relay = await startRelay({ port: 0, secret: "s", prefix: "/japancall", openaiUrl: fake.url, openaiKey: "k", jobsDir, logsDir, hangup: async () => {} });
        const tw = new WebSocket(`ws://127.0.0.1:${relay.port}/japancall/s/stream`);
        const got = await twilioRoundTrip(tw, "t1");      // start(job=t1) → media → 첫 media 이벤트를 기다린다
        expect(got.event).toBe("media");
        expect(fake.received.map((m) => m.type)).toEqual(expect.arrayContaining(["session.update", "input_audio_buffer.append"]));
        expect(readFileSync(join(logsDir, "CAtest.jsonl"), "utf8")).toContain('"who":"AI"');
        await relay.close(); await fake.close();
      });
      ```
      `startFakeRealtime`·`twilioRoundTrip` 은 같은 테스트 파일 안에 정의한다.
    - [x] 실패 확인: Run `npx vitest run tests/skills/phone-relay.test.ts` · Expected: FAIL (relay.mjs 없음)
    - [x] 최소 구현: `Japan2026/tools/aicall/server.mjs` 의 bridge 로직을 옮기고 `ws` 대신 Twilio 쪽은 `ws.mjs`, OpenAI 쪽은 내장 `WebSocket(url, { headers })`. 끼어들기 truncate, 4초 킥, end_call 2.5초 뒤 hangup 유지
    - [x] 틀린 비밀 경로 테스트 추가: 연결이 `error`/`close` 로 끝난다
    - [x] 통과 확인: Run `npx vitest run tests/skills/phone-relay.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/phone/scripts/relay.mjs tests/skills/phone-relay.test.ts && git commit -m "feat(phone): 표준 라이브러리 중계 서버"`
  - Done when: 왕복·틀린 경로 테스트 통과, `node relay.mjs` 가 127.0.0.1:8791 에서 `/health` 200 을 낸다

- [x] T7. 발신 CLI (승인 게이트) [flow]
  - Files: Create `plugins/nereus/skills/phone/scripts/call.mjs` · Test `tests/skills/phone-call.test.ts`
  - Interfaces: Consumes `judge`, `buildJob`, `loadEnv`, `twilio`, `paths()` · Produces `buildTwiml({ wss, jobId }): string`, `saveJob(dir, id, job)`, CLI `node call.mjs --brief FILE --id JOB_ID [--to E164] [--approved]`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { buildTwiml } from "../../plugins/nereus/skills/phone/scripts/call.mjs";
      it("TwiML 은 스트림 주소와 잡 id 를 담고 XML 특수문자를 막는다", () => {
        const x = buildTwiml({ wss: "wss://h/japancall/s/stream", jobId: "wasaku-1104" });
        expect(x).toContain('<Stream url="wss://h/japancall/s/stream">');
        expect(x).toContain('<Parameter name="job" value="wasaku-1104"/>');
        expect(() => buildTwiml({ wss: "wss://h/x", jobId: 'a"b' })).toThrow();
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/phone-call.test.ts` · Expected: FAIL (call.mjs 없음)
    - [x] 최소 구현: 브리프 → buildJob → saveJob → probe 수집 → judge(`risk: call`, `approved`) → `go` 일 때만 `POST /Calls.json`(To, From, Twiml, TimeLimit), `ask`·`block` 이면 판정 JSON 을 출력하고 exit 2
    - [x] 통과 확인: Run `npx vitest run tests/skills/phone-call.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/phone/scripts/call.mjs tests/skills/phone-call.test.ts && git commit -m "feat(phone): 승인 게이트 발신 CLI"`
  - Done when: TwiML 테스트 통과, `--approved` 없이 실행하면 발신하지 않고 exit 2 로 판정을 낸다

- [x] T8. SKILL.md 절차
  - Files: Create `plugins/nereus/skills/phone/SKILL.md`
  - Interfaces: Consumes `probe.mjs`, `call.mjs`, `relay.mjs`, `transcript.mjs` CLI · Produces 스킬 절차(판정 → 브리프 → 승인 → 발신 → 기록 → 요약)
  - Steps:
    - [x] 작성: frontmatter(name `phone`, description + 트리거), 실패 사례 표(KYC 401, 손 지시문, 프로젝트 종속), verdict 표, 브리프 형식 예시(와사쿠), 승인 문구 형식(번호·상대·질문·예상 비용 한 줄), 중계 서버 켜기(`nohup node relay.mjs`), 통화 뒤 요약 형식, 금지(사람인 척·확정·결제·비밀값 출력·승인 없는 발신)
    - [x] 검증: Run `grep -c "probe.mjs\|call.mjs" plugins/nereus/skills/phone/SKILL.md` · Expected: 2 이상
    - [x] 커밋: `git add plugins/nereus/skills/phone/SKILL.md && git commit -m "docs(phone): 스킬 절차"`
  - Done when: SKILL.md 가 판정·승인·요약 절차와 금지 목록을 담는다

- [x] T9. 라우터 트리거
  - Files: Modify `plugins/nereus/hooks/scripts/lib/router.mjs` · Test `tests/lib/router.test.ts`
  - Interfaces: Consumes `routePrompt(text)` · Produces ROUTES 항목 `nereus:phone`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      it("전화 걸어서 물어보는 요청은 phone", () => {
        expect(routePrompt("식당에 전화해서 영업하는지 물어봐줘").map((h) => h.skill)).toContain("nereus:phone");
        expect(routePrompt("AI 전화로 예약 문의해").map((h) => h.skill)).toContain("nereus:phone");
      });
      it("전화번호·전화 인증은 phone 이 아니다", () => {
        expect(routePrompt("전화번호 형식 검사 추가").map((h) => h.skill)).not.toContain("nereus:phone");
        expect(routePrompt("전화 인증 SMS 코드").map((h) => h.skill)).not.toContain("nereus:phone");
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/router.test.ts` · Expected: FAIL
    - [x] 최소 구현: ROUTES 끝에 `{ skill: "nereus:phone", why: "AI 가 대신 전화로 묻기 (Twilio·Realtime)", re: /(전화\s?(해서|걸어|해\s?줘|돌려)|통화(로|해서)\s?(물어|확인|문의)|ai\s?전화|음성\s?전화\s?(걸|대신)|phone\s?call|call\s?(them|the\s?(shop|hotel|restaurant)))/i }`
    - [x] 통과 확인: Run `npx vitest run tests/lib/router.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/hooks/scripts/lib/router.mjs tests/lib/router.test.ts && git commit -m "feat(router): phone 트리거"`
  - Done when: 트리거 두 문장은 phone, 전화번호·전화 인증 문장은 phone 이 아니다

- [x] T10. 버전·스킬 수 표기
  - Files: Modify `plugins/nereus/.claude-plugin/plugin.json` · `.claude-plugin/marketplace.json` · `README.md` · `README.ko.md`
  - Interfaces: 없음
  - Steps:
    - [x] 수정: nereus 0.22.0 → 0.23.0, README 스킬 수 +1, 스킬 목록에 `phone`
    - [x] 확인: Run `npm test` · Expected: PASS (전체)
    - [x] 커밋: `git add plugins/nereus/.claude-plugin .claude-plugin README.md README.ko.md && git commit -m "chore: nereus 0.23.0 — phone 스킬"`
  - Done when: `npm test` 전부 통과, 버전 표기 일치

## Global Constraints
- 플러그인 런타임은 Node 표준 라이브러리만(package.json 선언). `ws` 를 포함한 외부 npm 금지. Node ≥ 22 내장 `WebSocket` 사용.
- 판정·브리프·코덱·파서는 순수 함수. 네트워크는 probe·call·relay 에만.
- 비밀값(API 키·토큰·CALL_SECRET)은 출력·로그·커밋·테스트 픽스처에 싣지 않는다. 픽스처 env 는 더미 키만.
- 잡·기록은 저장소 밖(`~/.local/share/nereus/phone`)에 둔다 — 개인 정보가 들어간다.
- 실제 발신은 사용자 승인(`--approved`) 없이는 하지 않는다. 테스트는 Twilio·OpenAI 에 실제로 붙지 않는다.
- 코어 ROUTES 순서와 MAX_HITS=2 불변.
