// Stop: 미커밋 변경이나 이 세션에서 갱신되지 않은 handoff를 알린다. 차단하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { readStdinJson, emit } from "./lib/io.mjs";
import { run } from "./lib/exec.mjs";
import { handoffPath, projectStateDir } from "./lib/paths.mjs";
import { evidenceStatus } from "./lib/evidence.mjs";

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

export function handle(input, deps = {}) {
  if (input.stop_hook_active) return null;
  const cwd = input.cwd || process.cwd();
  const status = (deps.gitStatus ?? defaultGitStatus)(cwd);
  const updated = (deps.handoffUpdatedThisSession ?? defaultHandoffUpdated)(cwd, input.session_id || "nosession");
  const notes = [];
  if (status.trim()) notes.push("미커밋 변경이 있습니다");
  const ev = (deps.evidence ?? (() => evidenceStatus(cwd)))();
  if (status.trim() && ev.status !== "FRESH") notes.push(`테스트 evidence가 ${ev.status === "MISSING" ? "없습니다" : "STALE 입니다(코드가 바뀐 뒤 테스트를 다시 돌리지 않음)"}`);
  else if (ev.status === "FRESH" && !ev.passing) notes.push(`마지막 테스트가 실패 상태입니다(${ev.command})`);
  if (!updated) notes.push(".nereus/handoff.md가 이 세션에서 갱신되지 않았습니다");
  if (!notes.length) return null;
  return { systemMessage: `[Nereus] ${notes.join(". ")}. 작업 단위가 끝났다면 /nereus:finish 로 마무리하세요.` };
}

if (process.argv[1] && /finish-check\.mjs$/.test(process.argv[1])) emit(handle(readStdinJson()));
