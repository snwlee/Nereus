// PreCompact: 자동 압축 직전. handoff.md가 없거나 30분 넘게 갱신되지 않았으면 작성 지시.
import fs from "node:fs";
import { readStdinJson, contextPayload, emit } from "./lib/io.mjs";
import { handoffPath } from "./lib/paths.mjs";

const STALE_MS = 30 * 60 * 1000;

// 압축 요약에 반드시 남길 다섯 섹션. MUST NOT(실패한 접근·금지 사항)이 빠지면 압축 뒤 같은 실수를 반복한다.
export const COMPACT_INSTRUCTION = [
  "[Baton] 컨텍스트 압축이 시작됩니다. 먼저 .nereus/handoff.md를 전체 재작성하세요.",
  "압축 요약에는 다음 다섯 섹션을 이 제목 그대로 반드시 포함하세요:",
  "1. 원문 요청 — 사용자가 처음 요청한 문장 그대로",
  "2. 최종 목표 — 이 작업 단위가 끝나면 참이 되는 것",
  "3. 완료한 작업 — 파일·커밋 단위",
  "4. 남은 작업 — 다음에 할 순서대로",
  "5. MUST NOT — 시도했다가 실패한 접근과 이유, 사용자가 금지한 것, 건드리면 안 되는 파일",
].join("\n");

export function handle(input, deps = {}) {
  const cwd = input.cwd || process.cwd();
  const mtime = deps.mtime ?? ((p) => { try { return fs.statSync(p).mtimeMs; } catch { return null; } });
  const now = deps.now ?? Date.now();
  const m = mtime(handoffPath(cwd));
  if (m !== null && now - m < STALE_MS) return null;
  return contextPayload("PreCompact", COMPACT_INSTRUCTION);
}

if (process.argv[1] && /pre-compact\.mjs$/.test(process.argv[1])) emit(handle(readStdinJson()));
