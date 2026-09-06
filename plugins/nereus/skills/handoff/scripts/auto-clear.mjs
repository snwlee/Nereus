// handoff 뒤 /clear 와 재개 프롬프트를 현재 터미널에 스스로 입력한다 (Orca 전용).
//
// 훅 API 에는 컨텍스트를 비우는 출력 필드가 없다. 대신 Orca 는 터미널 핸들을
// ORCA_TERMINAL_HANDLE 로 노출하고 `orca terminal send` 로 그 터미널에 입력을 넣을 수 있다.
// 그래서 사용자가 /handoff 한 번만 치면 clear 와 재개까지 이어진다.
//
// 반드시 백그라운드로 분리해 실행한다 — 현재 턴이 끝나야 TUI 가 입력을 받는다.
import fs from "node:fs";
import path from "node:path";
import { run } from "../../../hooks/scripts/lib/exec.mjs";
import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";

export const DEFAULT_RESUME_PROMPT = "이어서 진행해";
const TURN_END_TIMEOUT_MS = 600_000; // 현재 턴이 끝나기를 기다린다(도구 실행이 길 수 있다)
const CLEAR_TIMEOUT_MS = 60_000;
const QUIET_MS = 3_000;      // 이만큼 출력이 없으면 턴이 끝난 것으로 본다
const POLL_MS = 1_000;
export const LOG_FILE = ".nereus/auto-clear.log";

/**
 * 실행할 orca 명령 단계를 만든다. 부수 효과 없음 — 테스트 가능하게 분리했다.
 * 조건이 하나라도 맞지 않으면 null(아무것도 하지 않음).
 */
export function planSteps({ handle, enabled = true, dirty = false, resumePrompt = DEFAULT_RESUME_PROMPT } = {}) {
  if (!handle) return null;        // Orca 밖 — 자동화할 방법이 없다
  if (!enabled) return null;       // 설정으로 꺼둠
  if (dirty) return null;          // 미커밋 변경이 있으면 지우지 않는다(되돌릴 수 없다)
  const wait = (timeout) => ({ kind: "wait", handle, args: ["terminal", "wait", "--terminal", handle, "--for", "tui-idle", "--timeout-ms", String(timeout), "--json"] });
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

// orca terminal wait 은 조건이 충족되지 않아도 종료코드 0 으로 끝난다(실측: satisfied=false,
// blockedReason=codex-trust-workspace). 종료코드만 보면 대기가 통째로 무력화되고, /clear 가
// 턴 도중에 발사돼 입력이 삼켜진다 — "가끔만 된다"의 원인이었다. 그래서 본문을 직접 읽는다.
export function parseWait(stdout) {
  try { return JSON.parse(stdout)?.result?.wait ?? null; } catch { return null; }
}

// tui-idle 이 막힌 환경(claude 에이전트)에서 쓰는 폴백. 마지막 출력 이후 경과 ms.
export function quietFor(showStdout, now) {
  try {
    const r = JSON.parse(showStdout)?.result;
    const last = r?.terminal?.lastOutputAt ?? r?.lastOutputAt;
    return typeof last === "number" ? now - last : null;
  } catch { return null; }
}

/**
 * 턴이 실제로 끝났는지 확인한다. tui-idle 이 satisfied 를 주면 그것을, 막혀 있으면
 * 출력 정지 구간으로 판정한다. 확인하지 못하면 ok:false — 눈감고 /clear 를 쏘지 않는다.
 */
export function confirmIdle({ handle, exec = run, sleep = sleepSync, now = Date.now, quietMs = QUIET_MS, deadlineMs = TURN_END_TIMEOUT_MS, pollMs = POLL_MS }) {
  const started = now();
  let lastReason = "unknown";
  while (now() - started < deadlineMs) {
    const w = exec("orca", ["terminal", "wait", "--terminal", handle, "--for", "tui-idle", "--timeout-ms", String(pollMs), "--json"], { timeoutMs: pollMs + 30_000 });
    const wait = parseWait(w.stdout);
    if (wait?.satisfied === true) return { ok: true, via: "tui-idle" };
    lastReason = wait?.blockedReason ?? wait?.status ?? (w.ok ? "not-satisfied" : "wait-failed");

    const sh = exec("orca", ["terminal", "show", "--terminal", handle, "--json"], { timeoutMs: 30_000 });
    const quiet = quietFor(sh.stdout, now());
    if (quiet !== null && quiet >= quietMs) return { ok: true, via: "quiet", quiet };
    sleep(pollMs);
  }
  return { ok: false, reason: lastReason };
}

function sleepSync(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

export function appendLog(cwd, line) {
  try {
    const p = path.join(cwd, LOG_FILE);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, `${new Date().toISOString()} ${line}\n`);
  } catch { /* 로그 실패가 본 동작을 막지 않는다 */ }
}

export function execute(steps, { exec = run, confirm = confirmIdle, log = () => {} } = {}) {
  const results = [];
  for (const step of steps ?? []) {
    if (step.kind === "wait") {
      const r = confirm({ handle: step.handle, exec });
      results.push({ kind: "wait", ok: r.ok, aborted: !r.ok });
      if (!r.ok) { log(`유휴 확인 실패(${r.reason}) — /clear 를 보내지 않고 중단`); return results; }
      log(`유휴 확인(${r.via})`);
      continue;
    }
    const r = exec("orca", step.args, { timeoutMs: TURN_END_TIMEOUT_MS + 30_000 });
    results.push({ kind: step.kind, ok: r.ok });
    log(`전송 ${step.args[5]} → ${r.ok ? "ok" : "실패"}`);
    if (!r.ok) break; // 보내기가 실패하면 뒤 단계는 의미가 없다
  }
  return results;
}

if (process.argv[1] && /auto-clear\.mjs$/.test(process.argv[1])) {
  const cwd = process.cwd();
  const log = (line) => { appendLog(cwd, line); console.error(`auto-clear: ${line}`); };
  const opts = resolveOptions();
  const steps = planSteps(opts);
  if (!steps) {
    log(`조건 불충족 — handle=${opts.handle ? "있음" : "없음"} enabled=${opts.enabled} dirty=${opts.dirty} → 아무것도 하지 않음`);
    process.exit(0);
  }
  execute(steps, { log });
}
