// Stop 재진입 켜기/끄기/상태. 켜져 있는 동안만 Stop 훅이 미완료 태스크를 이어간다.
// 사용: node arm.mjs on [--max 5] [--goal "..."] | node arm.mjs off | node arm.mjs status
import fs from "node:fs";
import path from "node:path";
import { prepareSessionState, sessionStateDir } from "../../../hooks/scripts/lib/session-documents.mjs";
import { sessionTaskProgress } from "../../../hooks/scripts/lib/tasks.mjs";

export const DEFAULT_MAX = 5;
const HARD_MAX = 20;

export function file(cwd, sessionId) { return path.join(sessionStateDir(cwd, sessionId), "continue.json"); }

export function arm(cwd, { max = DEFAULT_MAX, goal = "", sessionId, tasks } = {}, { write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }, now = Date.now() } = {}) {
  const remaining = Math.max(1, Math.min(Number(max) || DEFAULT_MAX, HARD_MAX));
  const state = { remaining, goal, armedAt: now, ...(tasks ? { tasks } : {}) };
  write(file(cwd, sessionId), JSON.stringify(state, null, 2));
  return state;
}

export function disarm(cwd, { sessionId, remove = (p) => { try { fs.unlinkSync(p); } catch { /* 이미 없음 */ } } } = {}) {
  remove(file(cwd, sessionId));
}

export function status(cwd, { sessionId, read = (p) => fs.readFileSync(p, "utf8") } = {}) {
  try { return JSON.parse(read(file(cwd, sessionId))); } catch { return null; }
}

if (process.argv[1] && /arm\.mjs$/.test(process.argv[1])) {
  const cwd = process.cwd();
  const cmd = process.argv[2] ?? "status";
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
  const sessionId = arg("--session", process.env.CLAUDE_SESSION_ID);
  if (!sessionId || sessionId === "nosession") {
    console.error("현재 Nereus 세션 ID를 --session 으로 지정하세요.");
    process.exit(2);
  }
  if (cmd === "on") {
    const p = sessionTaskProgress(cwd, sessionId);
    if (!p) { console.error("현재 세션의 tasks 파일이 없습니다. /nereus:spec 또는 session-work.mjs claim으로 작업을 등록하세요."); process.exit(2); }
    if (p.complete) { console.error("남은 태스크가 없습니다."); process.exit(2); }
    prepareSessionState(cwd, sessionId);
    const s = arm(cwd, { max: arg("--max", DEFAULT_MAX), goal: arg("--goal", ""), sessionId, tasks: p.file });
    console.log(`자동 계속 ON — 최대 ${s.remaining}회. 남은 태스크 ${p.total - p.done}개, 다음: ${p.next}`);
    console.log("끄려면: /nereus:continue off (컨텍스트는 자동 압축이 맡습니다. 횟수를 다 쓰거나 태스크가 끝나면 꺼집니다)");
  } else if (cmd === "off") {
    disarm(cwd, { sessionId }); console.log("자동 계속 OFF");
  } else {
    const s = status(cwd, { sessionId });
    console.log(s ? `자동 계속 ON — 남은 ${s.remaining}회${s.goal ? ` (목표: ${s.goal})` : ""}` : "자동 계속 OFF");
  }
}
