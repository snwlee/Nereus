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
  try { return (await fetch(url, { signal: AbortSignal.timeout(5000) })).ok; } catch { return false; }
};
const safe = async (fn) => { try { return await fn(); } catch { return undefined; } };

export const loadJob = (id, dir = paths().jobs) => {
  if (!/^[a-z0-9-]+$/.test(id || "")) throw new Error(`잘못된 잡 id: ${id}`);
  return JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), "utf8"));
};

// 실측. 네트워크를 부른다.
export async function collect({ job } = {}) {
  const { env, file } = readEnv();
  const envMissing = missingKeys(env);
  const iso = job?.to ? countryOf(job.to)?.iso : null;
  const hasTwilio = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN;
  const [profiles, balance, geo] = hasTwilio
    ? await Promise.all([safe(() => fetchProfiles(env)), safe(() => fetchBalance(env)), iso ? safe(() => fetchGeo(env, iso)) : undefined])
    : [];
  const ep = endpoints(env);
  const [relayLocal, relayPublic] = await Promise.all([ok(ep.localHealth), ok(ep.publicHealth)]);
  return { envFile: file, envMissing, ...readinessFrom({ profiles, balance, geo }), relayLocal, relayPublic };
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
