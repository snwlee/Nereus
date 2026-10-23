// Stop: (1) 재진입이 armed 이면 미완료 태스크를 이어가도록 종료를 막는다. (2) 아니면 미커밋 변경·evidence 상태를 알린다(차단 없음).
// 재진입은 기본 꺼짐. `/nereus:continue` 가 .nereus/continue.json 을 만들 때만 동작한다. 컨텍스트는 자동 압축이 맡는다.
import fs from "node:fs";
import path from "node:path";
import { readStdinJson, emit } from "./lib/io.mjs";
import { run } from "./lib/exec.mjs";
import { projectStateDir } from "./lib/paths.mjs";
import { evidenceStatus } from "./lib/evidence.mjs";
import { gateNow } from "../../skills/design/scripts/design-feedback.mjs";
import { taskProgress } from "./lib/tasks.mjs";

const continueFile = (cwd) => path.join(projectStateDir(cwd), "continue.json");

function readContinuation(cwd) {
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

export function handle(input, deps = {}) {
  // Claude Code 가 Stop 훅 때문에 다시 멈춘 경우. 여기서 또 막으면 무한 루프가 된다.
  if (input.stop_hook_active) return null;
  const cwd = input.cwd || process.cwd();
  const cont = (deps.continuation ?? (() => readContinuation(cwd)))();
  const disarm = deps.disarm ?? (() => writeContinuation(cwd, null));
  const notes = [];

  if (cont) {
    const progress = (deps.progress ?? (() => taskProgress(cwd)))();
    if (!progress || progress.complete || (cont.remaining ?? 0) <= 0) {
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
  const ev = (deps.evidence ?? (() => evidenceStatus(cwd)))();
  if (status.trim()) notes.push("미커밋 변경이 있습니다");
  if (status.trim() && ev.status !== "FRESH") notes.push(`테스트 evidence가 ${ev.status === "MISSING" ? "없습니다" : "STALE 입니다(코드가 바뀐 뒤 테스트를 다시 돌리지 않음)"}`);
  else if (ev.status === "FRESH" && !ev.passing) notes.push(`마지막 테스트가 실패 상태입니다(${ev.command})`);
  // 워크플로(finish) 를 안 거치는 즉석 디자인 수정도 세션 끝에는 한 번 알린다. 차단은 하지 않는다.
  const design = (deps.designGate ?? (() => gateNow(cwd)))();
  if (design.findings?.length) notes.push(`디자인 피드백 미이행 ${design.findings.length}건 (${design.findings.map((f) => f.file).slice(0, 3).join(", ")}) — /nereus:design 으로 Gemini 비평을 받으세요`);
  if (!notes.length) return null;
  return { systemMessage: `[Nereus] ${notes.join(". ")}. 작업 단위가 끝났다면 /nereus:finish 로 마무리하세요.` };
}

if (process.argv[1] && /finish-check\.mjs$/.test(process.argv[1])) emit(handle(readStdinJson()));
