import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import fs, { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { startRelay, NO_SPEECH_KICK_MS, END_CALL_DELAY_MS, MAX_PENDING } from "../../plugins/nereus/skills/phone/scripts/relay.mjs";
import { upgrade } from "../../plugins/nereus/skills/phone/scripts/ws.mjs";

const waitFor = async (cond: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
};

// 가짜 Realtime: session.update 를 받으면 AI 가 말하고, 첫 오디오를 받으면 상대가 끼어든 뒤 AI 가 end_call 한다.
async function startFakeRealtime() {
  const received: any[] = [];
  let authHeader = "";
  const server = http.createServer();
  server.on("upgrade", (req, socket, head) => {
    authHeader = String(req.headers.authorization || "");
    const conn = upgrade(req, socket, head);
    let appended = false;
    conn.on("message", (text: string) => {
      const m = JSON.parse(text);
      received.push(m);
      const send = (o: object) => conn.send(JSON.stringify(o));
      if (m.type === "session.update") {
        send({ type: "response.created" });
        send({ type: "response.output_audio.delta", item_id: "item1", delta: Buffer.alloc(160, 0xff).toString("base64") });
        send({ type: "response.output_audio_transcript.done", transcript: "こちらはAIアシスタントです" });
      }
      if (m.type === "input_audio_buffer.append" && !appended) {
        appended = true;
        send({ type: "input_audio_buffer.speech_started" });
        send({ type: "conversation.item.input_audio_transcription.completed", transcript: "はい、どうぞ" });
        send({ type: "response.done", response: { output: [{ type: "function_call", name: "end_call" }] } });
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const { port } = server.address() as { port: number };
  return { url: `ws://127.0.0.1:${port}/v1/realtime`, received, auth: () => authHeader, close: () => new Promise((r) => server.close(r)) };
}

let dir: string, jobsDir: string, logsDir: string;
beforeEach(() => {
  dir = mkdtempSync(join(os.tmpdir(), "phone-relay-"));
  jobsDir = join(dir, "jobs"); logsDir = join(dir, "logs");
  mkdirSync(jobsDir); mkdirSync(logsDir);
  writeFileSync(join(jobsDir, "t1.json"), JSON.stringify({ to: "+81977852848", language: "ja", instructions: "[AI-DISCLOSURE] test", timeLimitSec: 600, callSid: "CAtest" }));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("phone.relay", () => {
  it("가짜 Twilio ↔ 가짜 Realtime 왕복 [flow]", async () => {
    const fake = await startFakeRealtime();
    const hungUp: string[] = [];
    const relay = await startRelay({
      port: 0, secret: "s", prefix: "/japancall", openaiUrl: fake.url, openaiKey: "k",
      jobsDir, logsDir, hangup: async (sid: string) => { hungUp.push(sid); }, kickMs: 10_000, endCallDelayMs: 10,
    });
    const tw = new WebSocket(`ws://127.0.0.1:${relay.port}/japancall/s/stream`);
    const fromRelay: any[] = [];
    tw.onmessage = (e) => fromRelay.push(JSON.parse(String(e.data)));
    await new Promise<void>((r, j) => { tw.onopen = () => r(); tw.onerror = () => j(new Error("open failed")); });
    tw.send(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CAtest", customParameters: { job: "t1" } } }));
    await waitFor(() => fromRelay.some((m) => m.event === "media"));
    tw.send(JSON.stringify({ event: "media", media: { payload: "AAAA" } }));
    await waitFor(() => hungUp.length > 0);

    const types = fake.received.map((m) => m.type);
    expect(types).toEqual(expect.arrayContaining(["session.update", "input_audio_buffer.append", "conversation.item.truncate"]));
    const session = fake.received.find((m) => m.type === "session.update").session;
    expect(session.instructions).toBe("[AI-DISCLOSURE] test");
    expect(session.audio.input.format.type).toBe("audio/pcmu");
    expect(session.audio.input.transcription.language).toBe("ja");
    expect(session.tools[0].name).toBe("end_call");
    expect(fake.auth()).toBe("Bearer k");
    expect(fromRelay.find((m) => m.event === "media").streamSid).toBe("MZ1");
    expect(fromRelay.some((m) => m.event === "clear")).toBe(true);
    expect(hungUp).toEqual(["CAtest"]);

    const log = readFileSync(join(logsDir, "CAtest.jsonl"), "utf8");
    expect(log).toContain('"who":"AI"');
    expect(log).toContain('"who":"상대"');
    expect(log).toContain("end_call");

    tw.close();
    await relay.close(); await fake.close();
  });

  it("틀린 비밀 경로는 거절한다", async () => {
    const relay = await startRelay({ port: 0, secret: "s", prefix: "/japancall", openaiUrl: "ws://127.0.0.1:1", openaiKey: "k", jobsDir, logsDir, hangup: async () => {} });
    const tw = new WebSocket(`ws://127.0.0.1:${relay.port}/japancall/wrong/stream`);
    const opened = await new Promise<boolean>((r) => { tw.onopen = () => r(true); tw.onerror = () => r(false); });
    expect(opened).toBe(false);
    await relay.close();
  });

  it("기준선 상수(aicall server.mjs 2026-09-25)", () => {
    expect(NO_SPEECH_KICK_MS).toBe(4000);
    expect(END_CALL_DELAY_MS).toBe(2500);
  });

  it("health 는 200, 다른 경로는 404", async () => {
    const relay = await startRelay({ port: 0, secret: "s", prefix: "/japancall", openaiUrl: "ws://127.0.0.1:1", openaiKey: "k", jobsDir, logsDir, hangup: async () => {} });
    expect((await fetch(`http://127.0.0.1:${relay.port}/japancall/health`)).status).toBe(200);
    expect((await fetch(`http://127.0.0.1:${relay.port}/nope`)).status).toBe(404);
    await relay.close();
  });

  it("잘못된 잡 id 면 기록하고 스트림만 닫는다 — 확인 안 된 callSid 는 끊지 않는다", async () => {
    const fake = await startFakeRealtime();
    const hungUp: string[] = [];
    const relay = await startRelay({ port: 0, secret: "s", prefix: "/japancall", openaiUrl: fake.url, openaiKey: "k", jobsDir, logsDir, hangup: async (sid: string) => { hungUp.push(sid); }, kickMs: 10_000 });
    const tw = new WebSocket(`ws://127.0.0.1:${relay.port}/japancall/s/stream`);
    await new Promise<void>((r) => { tw.onopen = () => r(); });
    const closed = new Promise<void>((r) => { tw.onclose = () => r(); });
    tw.send(JSON.stringify({ event: "start", start: { streamSid: "MZ2", callSid: "CAbad", customParameters: { job: "../etc" } } }));
    await closed;
    expect(readFileSync(join(logsDir, "CAbad.jsonl"), "utf8")).toContain("job 로드 실패");
    expect(hungUp).toEqual([]);
    await relay.close(); await fake.close();
  });
});

describe("phone.relay hardening (보안 리뷰 H2·M3·M9)", () => {
  const open = async (port: number) => {
    const tw = new WebSocket(`ws://127.0.0.1:${port}/japancall/s/stream`);
    await new Promise<void>((r) => { tw.onopen = () => r(); });
    const closed = new Promise<void>((r) => { tw.onclose = () => r(); });
    return { tw, closed };
  };

  it("깨진 메시지는 그 연결만 닫고 서버는 산다", async () => {
    const relay = await startRelay({ port: 0, secret: "s", prefix: "/japancall", openaiUrl: "ws://127.0.0.1:1", openaiKey: "k", jobsDir, logsDir, hangup: async () => {} });
    const a = await open(relay.port);
    a.tw.send("{not json");
    await a.closed;
    const b = await open(relay.port);
    b.tw.send(JSON.stringify({ event: "media" }));   // media 없음
    b.tw.send(JSON.stringify({ event: "start" }));   // start 없음
    await b.closed;
    expect((await fetch(`http://127.0.0.1:${relay.port}/japancall/health`)).status).toBe(200);
    await relay.close();
  });

  it("잡의 callSid 와 다른 스트림은 거절하고 Realtime 에 붙지 않는다", async () => {
    const fake = await startFakeRealtime();
    const hungUp: string[] = [];
    const relay = await startRelay({ port: 0, secret: "s", prefix: "/japancall", openaiUrl: fake.url, openaiKey: "k", jobsDir, logsDir, hangup: async (sid: string) => { hungUp.push(sid); }, kickMs: 10_000 });
    const a = await open(relay.port);
    a.tw.send(JSON.stringify({ event: "start", start: { streamSid: "MZ9", callSid: "CAother", customParameters: { job: "t1" } } }));
    await a.closed;
    expect(fake.received.some((m) => m.type === "session.update")).toBe(false);
    expect(hungUp).toEqual([]);   // 남의 통화를 끊지 않는다
    expect(readFileSync(join(logsDir, "CAother.jsonl"), "utf8")).toContain("callSid 불일치");
    await relay.close(); await fake.close();
  });

  it("같은 callSid 로 두 번째 스트림은 거절", async () => {
    const fake = await startFakeRealtime();
    const relay = await startRelay({ port: 0, secret: "s", prefix: "/japancall", openaiUrl: fake.url, openaiKey: "k", jobsDir, logsDir, hangup: async () => {}, kickMs: 10_000 });
    const start = JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CAtest", customParameters: { job: "t1" } } });
    const a = await open(relay.port);
    a.tw.send(start);
    await waitFor(() => fake.received.some((m) => m.type === "session.update"));
    const b = await open(relay.port);
    b.tw.send(start);
    await b.closed;
    expect(fake.received.filter((m) => m.type === "session.update")).toHaveLength(1);
    a.tw.close();
    await relay.close(); await fake.close();
  });

  it("기록 디렉터리 0700 · 기록 파일 0600", async () => {
    fs.rmSync(logsDir, { recursive: true });
    const fake = await startFakeRealtime();
    const relay = await startRelay({ port: 0, secret: "s", prefix: "/japancall", openaiUrl: fake.url, openaiKey: "k", jobsDir, logsDir, hangup: async () => {}, kickMs: 10_000 });
    expect(fs.statSync(logsDir).mode & 0o777).toBe(0o700);
    const a = await open(relay.port);
    a.tw.send(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CAtest", customParameters: { job: "t1" } } }));
    await waitFor(() => fs.existsSync(join(logsDir, "CAtest.jsonl")));
    expect(fs.statSync(join(logsDir, "CAtest.jsonl")).mode & 0o777).toBe(0o600);
    a.tw.close();
    await relay.close(); await fake.close();
  });

  it("OpenAI 연결 전 대기열은 MAX_PENDING 을 넘지 않는다", () => {
    expect(MAX_PENDING).toBeGreaterThan(50);
    expect(MAX_PENDING).toBeLessThanOrEqual(1000);
  });
});
