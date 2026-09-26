// Twilio Media Streams ↔ OpenAI Realtime 중계 서버.
// 기준선: Japan2026/tools/aicall/server.mjs (2026-09-25 리허설 통화까지 동작). 동작은 그대로 두고
// `ws` npm 대신 Twilio 쪽은 ws.mjs, OpenAI 쪽은 Node 내장 WebSocket 을 쓴다.
//
// Twilio 가 wss://<host><prefix>/<CALL_SECRET>/stream 으로 붙으면 통화 오디오(G.711 μ-law)를 그대로 Realtime 에 넘기고
// 모델 음성을 되돌려 보낸다. 대화 기록은 <logs>/<callSid>.jsonl 에 남는다.
// 사용: node relay.mjs   (127.0.0.1:8791, 설정은 config.mjs)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { upgrade } from "./ws.mjs";

export const NO_SPEECH_KICK_MS = 4000;   // 상대가 4초간 말이 없으면 AI 가 먼저 인사한다
export const END_CALL_DELAY_MS = 2500;   // 작별 인사 음성이 다 나간 뒤 끊는다
const MS_PER_PCMU_BYTE = 1 / 8;          // μ-law 8kHz = 8바이트/ms

const JOB_ID = /^[a-z0-9-]+$/;

function loadJob(jobsDir, id) {
  if (!JOB_ID.test(id || "")) throw new Error(`bad job id: ${id}`);
  return JSON.parse(fs.readFileSync(path.join(jobsDir, `${id}.json`), "utf8"));
}

function sessionUpdate(job, voice) {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      instructions: job.instructions,
      audio: {
        input: {
          format: { type: "audio/pcmu" },
          transcription: { model: "gpt-4o-mini-transcribe", language: job.language },
          turn_detection: { type: "server_vad", silence_duration_ms: 700 },
        },
        output: { format: { type: "audio/pcmu" }, voice },
      },
      tools: [{
        type: "function",
        name: "end_call",
        description: "인사를 마치고 통화를 끊는다. 작별 인사를 말한 뒤에만 부른다.",
        parameters: { type: "object", properties: {}, required: [] },
      }],
    },
  };
}

function bridge(twilio, opts) {
  const { openaiUrl, openaiKey, model, voice, jobsDir, logsDir, hangup, kickMs, endCallDelayMs } = opts;
  const state = { streamSid: null, callSid: null, log: null, heardCaller: false, kick: null, lastItem: null, playedMs: 0 };
  const pending = [];
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

  const write = (rec) => state.log && fs.appendFileSync(state.log, JSON.stringify({ t: new Date().toISOString(), ...rec }) + "\n");
  const toTwilio = (obj) => twilio.open && twilio.send(JSON.stringify(obj));
  const endCall = (why) => hangup(state.callSid).catch((e) => write({ who: "system", text: `hangup 실패 ${e.message} (${why})` }));

  const ai = new WebSocket(`${openaiUrl}?model=${encodeURIComponent(model)}`, { headers: { Authorization: `Bearer ${openaiKey}` } });
  const sendAi = (obj) => (ai.readyState === WebSocket.OPEN ? ai.send(JSON.stringify(obj)) : pending.push(obj));
  ai.onopen = () => pending.splice(0).forEach((o) => ai.send(JSON.stringify(o)));

  function onAi(ev) {
    switch (ev.type) {
      case "response.output_audio.delta":
        if (!state.streamSid) break;
        state.lastItem = ev.item_id;
        state.playedMs += Buffer.from(ev.delta, "base64").length * MS_PER_PCMU_BYTE;
        toTwilio({ event: "media", streamSid: state.streamSid, media: { payload: ev.delta } });
        break;
      case "input_audio_buffer.speech_started":
        state.heardCaller = true;
        clearTimeout(state.kick);
        if (state.lastItem) {   // 상대가 끼어들면 AI 말을 멈춘다
          toTwilio({ event: "clear", streamSid: state.streamSid });
          sendAi({ type: "conversation.item.truncate", item_id: state.lastItem, content_index: 0, audio_end_ms: Math.floor(state.playedMs) });
          state.lastItem = null;
        }
        break;
      case "response.created":
        state.playedMs = 0;
        break;
      case "conversation.item.input_audio_transcription.completed":
        write({ who: "상대", text: ev.transcript });
        break;
      case "response.output_audio_transcript.done":
        write({ who: "AI", text: ev.transcript });
        break;
      case "response.done":
        if ((ev.response?.output || []).some((it) => it.type === "function_call" && it.name === "end_call")) {
          write({ who: "system", text: "end_call" });
          later(() => endCall("end_call"), endCallDelayMs);
        }
        break;
      case "error":
        write({ who: "system", text: `openai error ${JSON.stringify(ev.error)}` });
        break;
    }
  }
  ai.onmessage = (e) => onAi(JSON.parse(String(e.data)));

  function onStart(start) {
    state.streamSid = start.streamSid;
    state.callSid = start.callSid;
    if (!/^[A-Za-z0-9]+$/.test(state.callSid || "")) return twilio.close();
    state.log = path.join(logsDir, `${state.callSid}.jsonl`);
    const jobId = start.customParameters?.job;
    write({ who: "system", text: `start job=${jobId}` });
    try {
      sendAi(sessionUpdate(loadJob(jobsDir, jobId), voice));
      state.kick = setTimeout(() => { if (!state.heardCaller) sendAi({ type: "response.create" }); }, kickMs);
    } catch (e) {
      write({ who: "system", text: `job 로드 실패 ${e.message}` });
      endCall("job");
    }
  }

  twilio.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.event === "start") onStart(msg.start);
    else if (msg.event === "media") sendAi({ type: "input_audio_buffer.append", audio: msg.media.payload });
    else if (msg.event === "stop") { write({ who: "system", text: "stop" }); ai.close(); }
  });

  const cleanup = () => { clearTimeout(state.kick); ai.close(); };
  twilio.on("close", cleanup);
  ai.onclose = () => twilio.open && twilio.close();
  ai.onerror = (e) => write({ who: "system", text: `openai ws ${e.message || "error"}` });
  return () => { cleanup(); timers.forEach(clearTimeout); };
}

export async function startRelay({
  port, secret, prefix, openaiUrl = "wss://api.openai.com/v1/realtime", openaiKey,
  model = "gpt-realtime-2.1", voice = "marin", jobsDir, logsDir, hangup,
  kickMs = NO_SPEECH_KICK_MS, endCallDelayMs = END_CALL_DELAY_MS,
}) {
  fs.mkdirSync(logsDir, { recursive: true });
  const streamPath = `${prefix}/${secret}/stream`;
  const disposers = new Set();
  const server = http.createServer((req, res) => res.writeHead(req.url.endsWith("/health") ? 200 : 404).end());
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== streamPath) return socket.destroy();
    const conn = upgrade(req, socket, head);
    const dispose = bridge(conn, { openaiUrl, openaiKey, model, voice, jobsDir, logsDir, hangup, kickMs, endCallDelayMs });
    disposers.add(dispose);
    conn.on("close", () => disposers.delete(dispose));
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return {
    port: server.address().port,
    close: () => new Promise((r) => { disposers.forEach((d) => d()); server.closeAllConnections?.(); server.close(r); }),
  };
}

async function main() {
  const { loadEnv, paths, endpoints, DEFAULTS } = await import("./config.mjs");
  const { hangup } = await import("./twilio.mjs");
  const env = loadEnv({ required: ["OPENAI_API_KEY", "CALL_SECRET"] });   // Twilio 토큰은 끊을 때만 다시 읽는다
  const { jobs, logs } = paths();
  const ep = endpoints(env);
  const relay = await startRelay({
    port: ep.port, secret: env.CALL_SECRET, prefix: ep.prefix, openaiKey: env.OPENAI_API_KEY,
    model: env.PHONE_MODEL || DEFAULTS.model, voice: env.PHONE_VOICE || DEFAULTS.voice, jobsDir: jobs, logsDir: logs,
    hangup: (sid) => hangup(loadEnv({ required: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"] }), sid),
  });
  console.log(`phone relay on 127.0.0.1:${relay.port}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
