// PreCompact: 자동 압축 직전. handoff.md가 없거나 30분 넘게 갱신되지 않았으면 작성 지시.
import fs from "node:fs";
import { readStdinJson, contextPayload, emit } from "./lib/io.mjs";
import { handoffPath } from "./lib/paths.mjs";

const STALE_MS = 30 * 60 * 1000;

export function handle(input, deps = {}) {
  const cwd = input.cwd || process.cwd();
  const mtime = deps.mtime ?? ((p) => { try { return fs.statSync(p).mtimeMs; } catch { return null; } });
  const now = deps.now ?? Date.now();
  const m = mtime(handoffPath(cwd));
  if (m !== null && now - m < STALE_MS) return null;
  return contextPayload("PreCompact", "[Baton] 컨텍스트 압축이 시작됩니다. 압축 후 잃을 수 있는 상태를 지금 .nereus/handoff.md에 전체 재작성하세요(목표/현재 단계/완료/진행 중/다음/실패한 접근과 이유/결정/열린 질문/테스트 상태).");
}

if (process.argv[1] && /pre-compact\.mjs$/.test(process.argv[1])) emit(handle(readStdinJson()));
