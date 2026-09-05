// Stop: (1) 재진입이 armed 이면 미완료 태스크를 이어가도록 종료를 막는다. (2) 아니면 미커밋 변경·오래된 handoff·evidence 상태를 알린다(차단 없음).
// 재진입은 기본 꺼짐. `/nereus:continue` 가 .nereus/continue.json 을 만들 때만 동작하고, 컨텍스트가 경고선을 넘으면 스스로 해제된다.
import fs from "node:fs";
import path from "node:path";
import { readStdinJson, emit } from "./lib/io.mjs";
import { run } from "./lib/exec.mjs";
import { handoffPath, projectStateDir } from "./lib/paths.mjs";
import { evidenceStatus } from "./lib/evidence.mjs";
import { taskProgress } from "./lib/tasks.mjs";
import { loadConfig } from "./lib/config.mjs";
import { officialRatio } from "./ctx-sink.mjs";
import { lastAssistantUsage, usageRatio } from "./lib/transcript.mjs";

const continueFile = (cwd) => path.join(projectStateDir(cwd), "continue.json");

export function readContinuation(cwd) {
  try { return JSON.parse(fs.readFileSync(continueFile(cwd), "utf8")); } catch { return null; }
}
function writeContinuation(cwd, state) {
  const f = continueFile(cwd);
  if (state === null) { try { fs.unlinkSync(f); } catch { /* 이미 없음 */ } return; }
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(state, null, 2));
}

function defaultGitStatus(cwd) {
  const r = run("git", ["status", "--porcelain"], { cwd });
  return r.ok ? r.stdout : "";
}

function defaultHandoffUpdated(cwd, sid) {
  try {
    const h = fs.statSync(handoffPath(cwd)).mtimeMs;
    const marker = path.join(projectStateDir(cwd), `.session-${sid}`);
    let start;
    try { start = fs.statSync(marker).mtimeMs; } catch { fs.mkdirSync(projectStateDir(cwd), { recursive: true }); fs.writeFileSync(marker, ""); return true; }
    return h >= start;
  } catch { return false; }
}

function defaultCtxRatio(input) {
  const official = officialRatio(input.session_id);
  if (official !== null && official !== undefined) return official;
  const usage = lastAssistantUsage(input.transcript_path);
  return usage ? usageRatio(usage) : 0;
}

export function handle(input, deps = {}) {
  // Claude Code 가 Stop 훅 때문에 다시 멈춘 경우. 여기서 또 막으면 무한 루프가 된다.
  if (input.stop_hook_active) return null;
  const cwd = input.cwd || process.cwd();
  const cont = (deps.continuation ?? (() => readContinuation(cwd)))();
  const disarm = deps.disarm ?? (() => writeContinuation(cwd, null));
  const notes = [];

  if (cont) {
    const cfg = (deps.config ?? (() => loadConfig({ cwd })))();
    const ratio = (deps.ctxRatio ?? (() => defaultCtxRatio(input)))();
    const progress = (deps.progress ?? (() => taskProgress(cwd)))();
    if (ratio >= cfg.baton.warn) {
      disarm();
      notes.push(`컨텍스트 ${Math.round(ratio * 100)}% 라 자동 계속을 해제했습니다. handoff.md 를 쓰고 새 세션에서 /nereus:resume 하세요`);
    } else if (!progress || progress.complete || (cont.remaining ?? 0) <= 0) {
      disarm();
    } else {
      (deps.decrement ?? (() => writeContinuation(cwd, { ...cont, remaining: cont.remaining - 1 })))();
      return {
        decision: "block",
        reason: `[nereus:continue] 아직 태스크가 남았습니다 (${progress.done}/${progress.total}). 다음 태스크를 nereus:build 규칙대로 이어서 끝내세요: "${progress.next}". 끝내면 체크박스를 채우고 커밋하세요. 남은 자동 계속 ${cont.remaining - 1}회. 멈추려면 사용자가 /nereus:continue off 를 실행합니다.`,
      };
    }
  }

  const status = (deps.gitStatus ?? defaultGitStatus)(cwd);
  const updated = (deps.handoffUpdatedThisSession ?? defaultHandoffUpdated)(cwd, input.session_id || "nosession");
  const ev = (deps.evidence ?? (() => evidenceStatus(cwd)))();
  if (status.trim()) notes.push("미커밋 변경이 있습니다");
  if (!updated) notes.push(".nereus/handoff.md가 이 세션에서 갱신되지 않았습니다");
  if (status.trim() && ev.status !== "FRESH") notes.push(`테스트 evidence가 ${ev.status === "MISSING" ? "없습니다" : "STALE 입니다(코드가 바뀐 뒤 테스트를 다시 돌리지 않음)"}`);
  else if (ev.status === "FRESH" && !ev.passing) notes.push(`마지막 테스트가 실패 상태입니다(${ev.command})`);
  if (!notes.length) return null;
  return { systemMessage: `[Nereus] ${notes.join(". ")}. 작업 단위가 끝났다면 /nereus:finish 로 마무리하세요.` };
}

if (process.argv[1] && /finish-check\.mjs$/.test(process.argv[1])) emit(handle(readStdinJson()));
