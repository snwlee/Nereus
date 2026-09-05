#!/usr/bin/env node
// PostToolUse(*): 컨텍스트 사용률 측정. warn에서 1회 경고, hard 이상은 매번 하드 스톱 지시.
import fs from "node:fs";
import path from "node:path";
import { readStdinJson, contextPayload, emit } from "./lib/io.mjs";
import { lastAssistantUsage, usageRatio } from "./lib/transcript.mjs";
import { loadConfig } from "./lib/config.mjs";
import { projectStateDir } from "./lib/paths.mjs";

function fileMarks(cwd) {
  const dir = projectStateDir(cwd);
  const file = (k) => path.join(dir, `.baton-${k}`);
  return {
    hasMark: (k) => fs.existsSync(file(k)),
    setMark: (k) => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(k), ""); } catch { /* 무시 */ } },
  };
}

export function handle(input, deps = {}) {
  const cwd = input.cwd || process.cwd();
  const usage = (deps.usage ?? ((p) => lastAssistantUsage(p)))(input.transcript_path);
  if (!usage) return null;
  const cfg = (deps.config ?? (() => loadConfig({ cwd })))();
  const marks = deps.hasMark ? deps : fileMarks(cwd);
  const ratio = usageRatio(usage);
  const pct = Math.round(ratio * 100);
  const sid = input.session_id || "nosession";

  if (ratio >= cfg.baton.hard) {
    return contextPayload("PostToolUse",
      `[Baton 하드 스톱] 컨텍스트 ${pct}% 사용. 더 진행하지 마세요. 지금 즉시 .nereus/handoff.md를 전체 재작성(목표/현재 단계/완료/진행 중/다음/실패한 접근과 이유/결정/열린 질문/테스트 상태)하고, 미커밋 변경이 있으면 커밋한 뒤 사용자에게 새 세션에서 /nereus:resume 하라고 안내하고 멈추세요.`);
  }
  if (ratio >= cfg.baton.warn) {
    const key = `warn-${sid}`;
    if (marks.hasMark(key)) return null;
    marks.setMark(key);
    return contextPayload("PostToolUse",
      `[Baton] 컨텍스트 ${pct}% 사용. 새 작업을 시작하지 말고 현재 태스크만 마무리하세요. 마무리되면 .nereus/handoff.md를 전체 재작성하고 커밋한 뒤 멈추세요. ${Math.round(cfg.baton.hard * 100)}%에 도달하면 강제 정지됩니다.`);
  }
  return null;
}

if (process.argv[1] && /baton-meter\.mjs$/.test(process.argv[1])) {
  emit(handle(readStdinJson()));
}
