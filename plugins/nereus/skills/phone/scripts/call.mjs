// 발신 CLI. 브리프 → 잡 → 실측 → judge → go 일 때만 Twilio 발신.
// 사용: node call.mjs --brief FILE --id JOB_ID [--to E164] [--approved]
//   --to        리허설용: 브리프 번호 대신 이 번호로 건다(예: 본인 휴대폰)
//   --approved  발신 시도. 실제 승인은 사람이 `!` 로 실행한 approve.mjs 의 토큰(잡 지문 · 30분)이다 — 없으면 걸지 않는다
// ask·block 이면 발신하지 않고 판정 JSON 을 출력한 뒤 exit 2.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { judge, countryOf } from "./judge.mjs";
import { buildJob } from "./brief.mjs";
import { localHourIn, collect } from "./probe.mjs";
import { checkApproval, consumeApproval } from "./approval.mjs";

const JOB_ID = /^[a-z0-9-]+$/;
const XML_UNSAFE = /[<>&"']/;

export function buildTwiml({ wss, jobId }) {
  if (!JOB_ID.test(jobId || "")) throw new Error(`잘못된 잡 id: ${jobId}`);
  if (XML_UNSAFE.test(wss)) throw new Error("스트림 주소에 XML 특수문자");
  return `<Response><Connect><Stream url="${wss}"><Parameter name="job" value="${jobId}"/></Stream></Connect></Response>`;
}

const jobFile = (dir, id) => {
  if (!JOB_ID.test(id || "")) throw new Error(`잘못된 잡 id: ${id}`);
  return path.join(dir, `${id}.json`);
};
const readJob = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);

// 보안 리뷰 M4: 발신한 잡(callSid 가 적힌 잡)은 덮어쓰지 않는다 — 중계가 통화 중에 다시 읽기 때문이다.
export function saveJob(dir, id, job) {
  const file = jobFile(dir, id);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  if (readJob(file)?.callSid) throw new Error(`이미 발신한 잡이다: ${id} — 새 id 를 쓴다`);
  fs.writeFileSync(file, JSON.stringify(job, null, 1), { mode: 0o600 });
  return file;
}

// 발신 직후 callSid 를 잡에 적는다. 중계는 이 callSid 와 같은 스트림만 받는다(보안 리뷰 M3).
// 파일을 다시 읽지 않고 판정한 잡(메모리)을 쓴다 — 그 사이 파일이 바뀌어도 승인된 지시문이 나간다(R2 N3).
export function bindCall(dir, id, job, callSid) {
  if (!/^[A-Za-z0-9]+$/.test(callSid || "")) throw new Error(`잘못된 callSid: ${callSid}`);
  fs.writeFileSync(jobFile(dir, id), JSON.stringify({ ...job, callSid }, null, 1), { mode: 0o600 });
}

export function parseCallArgs(argv) {
  const out = { brief: null, id: null, to: null, approved: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--brief") out.brief = argv[++i];
    else if (a === "--id") out.id = argv[++i];
    else if (a === "--to") out.to = argv[++i];
    else if (a === "--approved") out.approved = true;
  }
  return out;
}

// 순수: 실측 결과와 브리프로 잡을 만들고 판정한다.
export function decide({ probe, brief, to = null, approved = false, now = new Date() }) {
  const job = buildJob(to ? { ...brief, to } : brief);
  const c = countryOf(job.to);
  const localHour = c ? localHourIn(c.tz, now) : null;
  return { job, localHour, ...judge(probe, { risk: "call", to: job.to, job, localHour, approved }) };
}

async function main() {
  const args = parseCallArgs(process.argv.slice(2));
  if (!args.brief || !args.id) { console.error("사용: node call.mjs --brief FILE --id JOB_ID [--to E164] [--approved]"); process.exit(1); }
  const { loadEnv, paths, endpoints } = await import("./config.mjs");
  const { twilio } = await import("./twilio.mjs");

  const brief = JSON.parse(fs.readFileSync(args.brief, "utf8"));
  const draft = buildJob(args.to ? { ...brief, to: args.to } : brief);
  const { jobs, home } = paths();
  const approvals = path.join(home, "approvals");
  const approval = args.approved ? checkApproval(approvals, args.id, draft) : { ok: false, reason: "approval-missing" };
  const probe = await collect({ job: draft });
  const d = decide({ probe, brief, to: args.to, approved: approval.ok });
  const file = saveJob(jobs, args.id, d.job);
  if (d.verdict !== "go") {
    const reasons = d.verdict === "ask" ? [approval.reason] : d.reasons;
    const askUser = `! node ${path.join(path.dirname(new URL(import.meta.url).pathname), "approve.mjs")} ${args.id}`;
    console.log(JSON.stringify({ verdict: d.verdict, reasons, to: d.job.to, localHour: d.localHour, job: file, ...(d.verdict === "ask" ? { askUser } : {}) }, null, 2));
    process.exit(2);
  }
  consumeApproval(approvals, args.id);
  const env = loadEnv();
  const { wss } = endpoints(env);
  const call = await twilio(env, "POST", "/Calls.json", {
    To: d.job.to, From: env.TWILIO_FROM, Twiml: buildTwiml({ wss, jobId: args.id }), TimeLimit: String(d.job.timeLimitSec),
  });
  bindCall(jobs, args.id, d.job, call.sid);
  console.log(JSON.stringify({ verdict: "go", call: call.sid, status: call.status, to: d.job.to, job: file }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
