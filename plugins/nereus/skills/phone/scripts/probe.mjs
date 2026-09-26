// phone 준비 상태 실측 → judge. 비밀값은 출력하지 않는다.
// 사용: node probe.mjs [--risk read|call] [--job ID] [--approved]
//   --job 을 주면 그 잡(~/.local/share/nereus/phone/jobs/ID.json)의 번호·지시문·현지 시각까지 판정한다.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { judge, countryOf } from "./judge.mjs";
import { readEnv, missingKeys, paths, endpoints } from "./config.mjs";
import { fetchProfiles, fetchBalance, fetchGeo } from "./twilio.mjs";

export function readinessFrom({ profiles, balance, geo } = {}) {
  const statuses = (profiles?.results || []).map((p) => p.status);
  const kyc = statuses.includes("twilio-approved") ? "twilio-approved" : statuses[0] || "unknown";
  return {
    kyc,
    balanceUsd: Number(balance?.balance) || 0,
    geo: (geo?.content || []).filter((c) => c.low_risk_numbers_enabled).map((c) => c.iso_code),
  };
}

export function localHourIn(tz, date = new Date()) {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(date);
  return Number(h);
}

export function parseArgs(argv) {
  const out = { risk: "read", job: null, approved: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--risk") out.risk = argv[++i];
    else if (argv[i] === "--job") out.job = argv[++i];
    else if (argv[i] === "--approved") out.approved = true;
  }
  return out;
}

const ok = async (url) => {
  try { return (await fetch(url, { signal: AbortSignal.timeout(5000) })).ok; } catch { return false; }   // 닫혀 있으면 down — 사유 코드가 relay-*-down 이다
};

// 조회 실패를 kyc unknown 으로만 뭉개지 않는다 — 어느 조회가 왜 실패했는지 errors 에 싣는다.
async function attempt(name, fn, errors) {
  try { return await fn(); } catch (e) { errors.push(`${name}: ${e.message}`); return undefined; }
}

export const loadJob = (id, dir = paths().jobs) => {
  if (!/^[a-z0-9-]+$/.test(id || "")) throw new Error(`잘못된 잡 id: ${id}`);
  return JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), "utf8"));
};

// 실측. 네트워크를 부른다.
const DEFAULT_DEPS = { readEnv, fetchProfiles, fetchBalance, fetchGeo, ok };

export async function collect({ job, deps = {} } = {}) {
  const d = { ...DEFAULT_DEPS, ...deps };
  const errors = [];
  const { env, file } = d.readEnv();
  const envMissing = missingKeys(env);
  const iso = job?.to ? countryOf(job.to)?.iso : null;
  const hasTwilio = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN;
  const [profiles, balance, geo] = hasTwilio
    ? await Promise.all([
      attempt("profiles", () => d.fetchProfiles(env), errors),
      attempt("balance", () => d.fetchBalance(env), errors),
      iso ? attempt("geo", () => d.fetchGeo(env, iso), errors) : undefined,
    ])
    : [];
  let ep = null;
  try { ep = endpoints(env); } catch (e) { errors.push(`endpoints: ${e.message}`); }
  const [relayLocal, relayPublic] = ep ? await Promise.all([d.ok(ep.localHealth), d.ok(ep.publicHealth)]) : [false, false];
  return { envFile: file, envMissing, ...readinessFrom({ profiles, balance, geo }), relayLocal, relayPublic, errors };
}

export function requestFor(args, job, now = new Date()) {
  if (args.risk !== "call") return { risk: args.risk };
  const c = job ? countryOf(job.to) : null;
  return { risk: "call", to: job?.to, job, localHour: c ? localHourIn(c.tz, now) : null, approved: args.approved };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const job = args.job ? loadJob(args.job) : null;
  const probe = await collect({ job });
  const result = judge(probe, requestFor(args, job));
  console.log(JSON.stringify({ probe, ...result }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
