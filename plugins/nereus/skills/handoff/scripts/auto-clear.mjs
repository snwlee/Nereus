// handoff 뒤 /clear 와 재개 프롬프트를 현재 터미널에 스스로 입력한다 (Orca 전용).
//
// 훅 API 에는 컨텍스트를 비우는 출력 필드가 없다. 대신 Orca 는 터미널 핸들을
// ORCA_TERMINAL_HANDLE 로 노출하고 `orca terminal send` 로 그 터미널에 입력을 넣을 수 있다.
// 그래서 사용자가 /handoff 한 번만 치면 clear 와 재개까지 이어진다.
//
// 반드시 백그라운드로 분리해 실행한다 — 현재 턴이 끝나야 TUI 가 입력을 받는다.
import { run } from "../../../hooks/scripts/lib/exec.mjs";
import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";

export const DEFAULT_RESUME_PROMPT = "이어서 진행해";
const TURN_END_TIMEOUT_MS = 600_000; // 현재 턴이 끝나기를 기다린다(도구 실행이 길 수 있다)
const CLEAR_TIMEOUT_MS = 60_000;

/**
 * 실행할 orca 명령 단계를 만든다. 부수 효과 없음 — 테스트 가능하게 분리했다.
 * 조건이 하나라도 맞지 않으면 null(아무것도 하지 않음).
 */
export function planSteps({ handle, enabled = true, dirty = false, resumePrompt = DEFAULT_RESUME_PROMPT } = {}) {
  if (!handle) return null;        // Orca 밖 — 자동화할 방법이 없다
  if (!enabled) return null;       // 설정으로 꺼둠
  if (dirty) return null;          // 미커밋 변경이 있으면 지우지 않는다(되돌릴 수 없다)
  const wait = (timeout) => ({ kind: "wait", args: ["terminal", "wait", "--terminal", handle, "--for", "tui-idle", "--timeout-ms", String(timeout), "--json"] });
  const send = (text) => ({ kind: "send", args: ["terminal", "send", "--terminal", handle, "--text", text, "--enter", "--json"] });
  return [
    wait(TURN_END_TIMEOUT_MS),  // 현재 턴 종료 대기 — 먼저 보내면 입력이 큐에 쌓인다
    send("/clear"),
    wait(CLEAR_TIMEOUT_MS),     // clear 처리 완료 대기
    send(resumePrompt),         // SessionStart 주입만으로는 턴이 시작되지 않는다
  ];
}

/**
 * 실행 환경에서 planSteps 의 입력을 모은다. 주입 가능하게 분리 — 테스트가 실제 git·설정을 건드리지 않는다.
 * git status 가 실패하면 dirty 로 본다: 상태를 모르는 채 지우면 되돌릴 수 없다.
 */
export function resolveOptions({ env = process.env, config = loadConfig(), gitStatus = () => run("git", ["status", "--porcelain"]) } = {}) {
  const ac = config.autoClear ?? {};
  const st = gitStatus();
  return {
    handle: env.ORCA_TERMINAL_HANDLE ?? "",
    enabled: ac.enabled !== false,
    dirty: !st.ok || st.stdout.trim() !== "",
    resumePrompt: ac.prompt ?? DEFAULT_RESUME_PROMPT,
  };
}

export function execute(steps, { exec = run } = {}) {
  const results = [];
  for (const step of steps ?? []) {
    const r = exec("orca", step.args, { timeoutMs: TURN_END_TIMEOUT_MS + 30_000 });
    results.push({ kind: step.kind, ok: r.ok });
    if (!r.ok && step.kind === "send") break; // 보내기가 실패하면 뒤 단계는 의미가 없다
  }
  return results;
}

if (process.argv[1] && /auto-clear\.mjs$/.test(process.argv[1])) {
  const steps = planSteps(resolveOptions());
  if (!steps) {
    console.error("auto-clear: 조건 불충족(Orca 밖·설정 off·미커밋 변경) — 아무것도 하지 않음");
    process.exit(0);
  }
  execute(steps);
}
