// SessionEnd: 관찰 로그를 결정론적으로 집계해 "후보"로 만든다. 규칙 승격은 사용자 승인(/nereus:learn)이 있어야 한다.
// 세션 요약·회상은 claude-mem 의 몫이고 여기서는 만들지 않는다.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readStdinJson, note as defaultNote } from "./lib/io.mjs";
import { readObservations, clearObservations } from "./lib/observe.mjs";
import { detectSignals, mergeCandidates } from "./lib/signals.mjs";
import { projectStateDir } from "./lib/paths.mjs";

export const candidatesPath = (cwd) => path.join(projectStateDir(cwd), "learn", "candidates.json");

export function readCandidates(cwd, { readFile = (p) => fs.readFileSync(p, "utf8") } = {}) {
  try {
    const v = JSON.parse(readFile(candidatesPath(cwd)));
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

export function writeCandidates(cwd, list) {
  const f = candidatesPath(cwd);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(list, null, 2) + "\n");
}

/** 관찰 → 신호 → 후보 병합. 집계한 관찰은 비운다. */
export function aggregate(cwd, deps = {}) {
  const obs = (deps.observations ?? readObservations)(cwd);
  if (!obs.length) return { added: 0, open: (deps.read ?? readCandidates)(cwd).filter((c) => c.status === "open").length };
  const before = (deps.read ?? readCandidates)(cwd);
  const merged = mergeCandidates(before, detectSignals(obs), { now: deps.now ?? Date.now() });
  (deps.write ?? writeCandidates)(cwd, merged);
  (deps.clear ?? clearObservations)(cwd);
  return { added: merged.length - before.length, open: merged.filter((c) => c.status === "open").length };
}

function defaultHasClaudeMem() {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude", "plugins", "installed_plugins.json"), "utf8"));
    return Object.keys(d.plugins ?? {}).some((k) => k.startsWith("claude-mem@"));
  } catch { return false; }
}

export function handle(input, deps = {}) {
  const cwd = input.cwd || process.cwd();
  const note = deps.note ?? defaultNote;
  try {
    const r = (deps.aggregate ?? aggregate)(cwd, deps);
    if (r.added > 0) note(`학습 후보 ${r.added}건 추가 (검토 대기 ${r.open}건). /nereus:learn review 로 확인하세요.`);
  } catch { /* 집계 실패가 세션 종료를 막아서는 안 된다 */ }
  if (!(deps.hasClaudeMem ?? defaultHasClaudeMem)()) note("claude-mem이 없어 세션 요약이 저장되지 않습니다. /nereus:setup 의 동반 플러그인 안내를 참고하세요.");
  return null;
}

if (process.argv[1] && /session-end\.mjs$/.test(process.argv[1])) handle(readStdinJson());
