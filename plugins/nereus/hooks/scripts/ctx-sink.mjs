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

// 실측으로 학습한 컨텍스트 한도의 세션 캐시.
// statusline 의 공식 %와 transcript 토큰 수로 한도를 역산해 두면, 공식 값이 낡아 폴백으로
// 떨어져도 올바른 분모를 쓸 수 있다. transcript 에는 1M 세션임을 알리는 단서가 없다.
// officialRatio 와 달리 별도 파일에 둔다 — sink() 가 매 statusline 갱신마다 덮어쓰기 때문.
export const KNOWN_LIMITS = [200_000, 1_000_000];

export function limitFile(sessionId, dir = path.join(userConfigDir(), "ctx")) {
  return path.join(dir, `${String(sessionId).replace(/[^A-Za-z0-9_-]/g, "_")}.limit.json`);
}

/** 역산값을 알려진 한도 중 가장 가까운 값으로 스냅한다(공식 %가 정수로 반올림되므로 근사치다). */
export function snapLimit(raw) {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  let best = null, bestDistance = Infinity;
  for (const candidate of KNOWN_LIMITS) {
    const distance = Math.abs(Math.log(raw / candidate)); // 비율 거리 — 기하평균이 경계가 된다
    if (distance < bestDistance) { bestDistance = distance; best = candidate; }
  }
  return best;
}

export function saveLimit(sessionId, limit, { writeFile = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }, now = Date.now(), dir } = {}) {
  if (!sessionId || !(limit > 0)) return null;
  const rec = { session_id: sessionId, limit, at: now };
  try { writeFile(limitFile(sessionId, dir), JSON.stringify(rec)); } catch { return null; }
  return rec;
}

/** 한도는 세션 내내 변하지 않으므로 신선도를 따지지 않는다. */
export function cachedLimit(sessionId, { readFile = (p) => fs.readFileSync(p, "utf8"), dir } = {}) {
  if (!sessionId) return null;
  try {
    const rec = JSON.parse(readFile(limitFile(sessionId, dir)));
    return rec.limit > 0 ? rec.limit : null;
  } catch { return null; }
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
