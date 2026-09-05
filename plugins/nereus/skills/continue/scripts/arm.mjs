// Stop 재진입 켜기/끄기/상태. 켜져 있는 동안만 Stop 훅이 미완료 태스크를 이어간다.
// 사용: node arm.mjs on [--max 5] [--goal "..."] | node arm.mjs off | node arm.mjs status
import fs from "node:fs";
import path from "node:path";
import { projectStateDir } from "../../../hooks/scripts/lib/paths.mjs";
import { taskProgress } from "../../../hooks/scripts/lib/tasks.mjs";

export const DEFAULT_MAX = 5;
export const HARD_MAX = 20;

export function file(cwd) { return path.join(projectStateDir(cwd), "continue.json"); }

export function arm(cwd, { max = DEFAULT_MAX, goal = "" } = {}, { write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }, now = Date.now() } = {}) {
  const remaining = Math.max(1, Math.min(Number(max) || DEFAULT_MAX, HARD_MAX));
  const state = { remaining, goal, armedAt: now };
  write(file(cwd), JSON.stringify(state, null, 2));
  return state;
}

export function disarm(cwd, { remove = (p) => { try { fs.unlinkSync(p); } catch { /* 이미 없음 */ } } } = {}) {
  remove(file(cwd));
}

export function status(cwd, { read = (p) => fs.readFileSync(p, "utf8") } = {}) {
  try { return JSON.parse(read(file(cwd))); } catch { return null; }
}

if (process.argv[1] && /arm\.mjs$/.test(process.argv[1])) {
  const cwd = process.cwd();
  const cmd = process.argv[2] ?? "status";
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
  if (cmd === "on") {
    const p = taskProgress(cwd);
    if (!p) { console.error("tasks 파일을 찾지 못했습니다. 먼저 /nereus:spec 으로 태스크를 만드세요."); process.exit(2); }
    if (p.complete) { console.error("남은 태스크가 없습니다."); process.exit(2); }
    const s = arm(cwd, { max: arg("--max", DEFAULT_MAX), goal: arg("--goal", "") });
    console.log(`자동 계속 ON — 최대 ${s.remaining}회. 남은 태스크 ${p.total - p.done}개, 다음: ${p.next}`);
    console.log("끄려면: /nereus:continue off (컨텍스트가 경고선을 넘으면 자동으로 꺼집니다)");
  } else if (cmd === "off") {
    disarm(cwd); console.log("자동 계속 OFF");
  } else {
    const s = status(cwd);
    console.log(s ? `자동 계속 ON — 남은 ${s.remaining}회${s.goal ? ` (목표: ${s.goal})` : ""}` : "자동 계속 OFF");
  }
}
