// statusline 한 줄. 태스크 진행률 · 검증 상태 · 컨텍스트 비율.
// "완료라고 보고했지만 검증되지 않은" 상태를 눈에 보이게 하는 것이 목적이다.
// 사용: node hud.mjs [--cwd <path>] [--session <id>]
import { taskProgress } from "../../../hooks/scripts/lib/tasks.mjs";
import { evidenceStatus } from "../../../hooks/scripts/lib/evidence.mjs";
import { officialRatio } from "../../../hooks/scripts/ctx-sink.mjs";

/** 계획 → 작업중 → 미검증(완료 주장) → 검증됨 */
export function badge(progress, evidence) {
  const verified = evidence?.status === "FRESH" && evidence?.passing === true;
  if (!progress) return verified ? "검증됨" : "-";
  if (progress.complete) return verified ? "검증됨" : "미검증";
  return progress.done > 0 ? "작업중" : "계획";
}

export function hudLine({ progress, evidence, ctxPct }) {
  const parts = [];
  if (progress) parts.push(`${progress.done}/${progress.total}`);
  const b = badge(progress, evidence);
  if (b !== "-") parts.push(b);
  if (typeof ctxPct === "number") parts.push(`${Math.round(ctxPct)}%`);
  return "⚓ " + (parts.length ? parts.join(" · ") : "-");
}

if (process.argv[1] && /hud\.mjs$/.test(process.argv[1])) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
  const cwd = arg("--cwd", process.cwd());
  const ratio = officialRatio(arg("--session", process.env.CLAUDE_SESSION_ID));
  process.stdout.write(hudLine({
    progress: taskProgress(cwd),
    evidence: evidenceStatus(cwd),
    ctxPct: ratio === null || ratio === undefined ? null : ratio * 100,
  }) + "\n");
}
