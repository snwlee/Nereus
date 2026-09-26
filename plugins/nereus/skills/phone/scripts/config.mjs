// phone 설정·경로. 비밀값은 env 파일에만 있고 여기서 출력하지 않는다.
//
// env 파일 순서: ~/.config/nereus/phone/env → ~/.config/japancall/env (Japan2026 에서 먼저 만든 위치)
// 데이터: ~/.local/share/nereus/phone/{jobs,logs} — 잡·기록에 개인 정보가 들어가 저장소 밖에 둔다.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const REQUIRED_KEYS = Object.freeze(["OPENAI_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "CALL_SECRET", "TWILIO_FROM"]);

export const DEFAULTS = Object.freeze({
  port: 8791,
  prefix: "/japancall",                              // nginx location ^~ /japancall/ → 127.0.0.1:8791
  publicHost: "snuri.duckdns.org",
  model: "gpt-realtime-2.1",
  voice: "marin",
});

export function envFiles(home = os.homedir()) {
  return [path.join(home, ".config/nereus/phone/env"), path.join(home, ".config/japancall/env")];
}

export function readEnv(files = envFiles()) {
  const file = files.find((f) => fs.existsSync(f)) || null;
  const env = {};
  if (!file) return { env, file };
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return { env, file };
}

export const missingKeys = (env, required = REQUIRED_KEYS) => required.filter((k) => !env[k]);

export function loadEnv({ required = REQUIRED_KEYS, files = envFiles() } = {}) {
  const { env, file } = readEnv(files);
  const missing = missingKeys(env, required);
  if (missing.length) throw new Error(`${file || files.join(" · ")} 에 없음: ${missing.join(", ")}`);
  return env;
}

export function paths(proc = process.env) {
  const home = proc.NEREUS_PHONE_HOME || path.join(os.homedir(), ".local/share/nereus/phone");
  return { home, jobs: path.join(home, "jobs"), logs: path.join(home, "logs") };
}

// 공개 wss 스트림 주소와 health 주소. env 의 PHONE_PUBLIC_HOST·PHONE_PREFIX 가 기본값을 이긴다.
export function endpoints(env) {
  const host = env.PHONE_PUBLIC_HOST || DEFAULTS.publicHost;
  const prefix = env.PHONE_PREFIX || DEFAULTS.prefix;
  const port = Number(env.PHONE_PORT || DEFAULTS.port);
  return {
    port,
    prefix,
    streamPath: `${prefix}/${env.CALL_SECRET}/stream`,
    wss: `wss://${host}${prefix}/${env.CALL_SECRET}/stream`,
    localHealth: `http://127.0.0.1:${port}/health`,
    publicHealth: `https://${host}${prefix}/health`,
  };
}
