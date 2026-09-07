// PostToolUse(*): 컨텍스트 사용률 측정. warn에서 1회 경고, hard 이상은 매번 하드 스톱 지시.
import fs from "node:fs";
import path from "node:path";
import { readStdinJson, contextPayload, emit } from "./lib/io.mjs";
import { lastAssistantUsage, usageRatio } from "./lib/transcript.mjs";
import { loadConfig } from "./lib/config.mjs";
import { projectStateDir } from "./lib/paths.mjs";
import { officialRatio, cachedLimit, saveLimit, snapLimit } from "./ctx-sink.mjs";

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
  // statusline 이 남긴 공식 비율이 있으면 그것을, 없으면 transcript 추정치를 쓴다.
  const official = (deps.official ?? officialRatio)(input.session_id);
  const usage = (deps.usage ?? ((p) => lastAssistantUsage(p)))(input.transcript_path);
  let ratio = official;
  if (ratio === null || ratio === undefined) {
    if (!usage) return null;
    // 학습해 둔 실제 한도가 있으면 그것을 쓴다. 모델 표는 1M 세션을 200k 로 오판한다.
    ratio = usageRatio(usage, { limit: (deps.loadLimit ?? cachedLimit)(input.session_id) });
  } else if (usage && official > 0) {
    // 공식 값이 살아있는 동안 실제 한도를 역산해 캐시한다 — 이후 폴백이 정확해진다.
    const learned = snapLimit(usage.inputTotal / official);
    if (learned) (deps.saveLimit ?? saveLimit)(input.session_id, learned);
  }
  const cfg = (deps.config ?? (() => loadConfig({ cwd })))();
  const marks = deps.hasMark ? deps : fileMarks(cwd);
  const pct = Math.round(ratio * 100);
  const sid = input.session_id || "nosession";

  // 절차를 여기서 서술하지 않고 nereus:handoff 스킬로 넘긴다 — 서술하면 SKILL 의 마지막 단계
  // (auto-clear: /clear·재개 자동 입력)가 빠진다. 실제로 그래서 auto-clear 가 한 번도 돌지 않았다.
  if (ratio >= cfg.baton.hard) {
    return contextPayload("PostToolUse",
      `[Baton 하드 스톱 ${pct}%] 진행 중단. 새 작업을 시작하지 말고 지금 Skill 로 nereus:handoff 를 불러 그 절차를 끝까지 따르세요 — handoff.md 전체 재작성 → 커밋 → auto-clear(/clear·재개 자동 입력)까지. 절차를 기억으로 재현하지 마세요.`);
  }
  if (ratio >= cfg.baton.warn) {
    const key = `warn-${sid}`;
    if (marks.hasMark(key)) return null;
    marks.setMark(key);
    return contextPayload("PostToolUse",
      `[Baton ${pct}%] 새 태스크 시작 금지. 현재 태스크를 끝낸 뒤 Skill 로 nereus:handoff 를 부르세요. ${Math.round(cfg.baton.hard * 100)}%에서 강제 정지합니다.`);
  }
  return null;
}

if (process.argv[1] && /baton-meter\.mjs$/.test(process.argv[1])) {
  emit(handle(readStdinJson()));
}
