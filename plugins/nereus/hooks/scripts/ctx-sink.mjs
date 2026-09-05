// statusline 보조: Claude Code가 statusline에 주는 공식 context_window.used_percentage 를 세션별 파일로 남긴다.
// baton-meter 가 이 값을 우선 사용해 statusline 숫자와 핸드오프 기준을 일치시킨다.
// statusline 스크립트에서:  printf '%s' "$input" | node "<plugin>/hooks/scripts/ctx-sink.mjs" &
import fs from "node:fs";
import path from "node:path";
import { readStdinJson } from "./lib/io.mjs";
import { userConfigDir } from "./lib/paths.mjs";

export const FRESH_MS = 90_000;

export function ctxFile(sessionId, dir = path.join(userConfigDir(), "ctx")) {
  return path.join(dir, `${String(sessionId).replace(/[^A-Za-z0-9_-]/g, "_")}.json`);
}

export function sink(input, { writeFile = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }, now = Date.now(), dir } = {}) {
  const pct = input?.context_window?.used_percentage;
  const sid = input?.session_id;
  if (typeof pct !== "number" || !sid) return null;
  const rec = { session_id: sid, used_percentage: pct, at: now };
  writeFile(ctxFile(sid, dir), JSON.stringify(rec));
  return rec;
}

export function officialRatio(sessionId, { readFile = (p) => fs.readFileSync(p, "utf8"), now = Date.now(), dir } = {}) {
  if (!sessionId) return null;
  try {
    const rec = JSON.parse(readFile(ctxFile(sessionId, dir)));
    if (now - rec.at > FRESH_MS) return null;
    return rec.used_percentage / 100;
  } catch { return null; }
}

if (process.argv[1] && /ctx-sink\.mjs$/.test(process.argv[1])) {
  sink(readStdinJson());
}
