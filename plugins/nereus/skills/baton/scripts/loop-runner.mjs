// reset 루프: 반복마다 새 `claude -p` 세션이 handoff.md·tasks·스펙만 읽고 시작한다. 상태는 파일과 git에만 있다.
// 사용: node loop-runner.mjs --goal "작업" --tasks <path> [--spec <path>] [--max 30]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { run, which } from "../../../hooks/scripts/lib/exec.mjs";
import { handoffPath } from "../../../hooks/scripts/lib/paths.mjs";

export function parseTasks(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*-\s*\[([ xX])\]\s*(.+?)\s*$/);
    if (m) out.push({ text: m[2], done: m[1] !== " " });
  }
  return out;
}

export function buildPrompt({ handoff, tasks, spec, goal }) {
  return [
    `당신은 Nereus Baton 루프의 한 반복입니다. 목표: ${goal}`,
    `먼저 ${handoff} 를 읽고(있다면), ${tasks} 에서 첫 미완료 태스크 하나를 고르세요. 스펙은 ${spec ?? "(없음)"} 입니다.`,
    "그 태스크만 nereus:build 규칙(TDD)으로 끝내고 체크박스를 채우세요. 다른 태스크는 건드리지 마세요.",
    `끝나면 ${handoff} 를 전체 재작성하고(목표/현재 단계/완료/진행 중/다음/실패한 접근과 이유/결정/열린 질문/테스트 상태), 변경을 conventional commit으로 커밋하세요.`,
    "막히면 실패한 접근과 이유를 handoff에 남기고 멈추세요. 완료를 검증 없이 선언하지 마세요.",
  ].join("\n");
}

function defaultRunClaude(prompt, cwd) {
  return new Promise((resolve) => {
    const bin = which("claude");
    if (!bin) return resolve({ ok: false, error: "claude CLI 없음" });
    const p = spawn(bin, ["-p", prompt, "--permission-mode", "acceptEdits"], { cwd, stdio: ["ignore", "inherit", "inherit"], shell: false });
    p.on("close", (code) => resolve({ ok: code === 0, code }));
    p.on("error", (e) => resolve({ ok: false, error: String(e) }));
  });
}

async function defaultEvaluate(cwd) {
  if (!which("ooo")) return { pass: true, skipped: "ooo 없음" };
  const r = run("ooo", ["qa", "--json", "."], { cwd, timeoutMs: 10 * 60 * 1000 });
  return { pass: r.ok, output: r.stdout.slice(-2000) };
}

export async function runLoop(opts, deps = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const readTasks = deps.readTasks ?? (() => fs.readFileSync(path.resolve(cwd, opts.paths.tasks), "utf8"));
  const runClaude = deps.runClaude ?? ((prompt) => defaultRunClaude(prompt, cwd));
  const gitDirty = deps.gitDirty ?? (() => run("git", ["status", "--porcelain"], { cwd }).stdout.trim() !== "");
  const commit = deps.commit ?? ((msg) => { run("git", ["add", "-A"], { cwd }); run("git", ["commit", "-q", "-m", msg], { cwd }); });
  const evaluate = deps.evaluate ?? (() => defaultEvaluate(cwd));
  const log = deps.log ?? ((m) => process.stderr.write(`[baton-loop] ${m}\n`));

  let sameTaskFails = 0;
  let lastTask = null;
  for (let i = 1; i <= opts.max; i++) {
    const before = parseTasks(readTasks());
    const current = before.find((t) => !t.done);
    if (!current) {
      const ev = await evaluate();
      if (ev.pass) return { status: "converged", iterations: i - 1 };
      log(`태스크는 전부 체크됐지만 evaluate 실패. 반복 계속.`);
    }
    log(`반복 ${i}/${opts.max}: ${current?.text ?? "(evaluate 재시도)"}`);
    await runClaude(buildPrompt({ ...opts.paths, goal: opts.goal }));
    if (gitDirty()) commit(`chore(baton): 반복 ${i} 체크포인트`);

    const after = parseTasks(readTasks());
    const progressed = after.filter((t) => t.done).length > before.filter((t) => t.done).length;
    if (!current) continue;
    if (progressed) { sameTaskFails = 0; lastTask = null; }
    else {
      sameTaskFails = lastTask === current.text ? sameTaskFails + 1 : 1;
      lastTask = current.text;
      if (sameTaskFails >= 3) {
        log(`같은 태스크 3회 실패: ${current.text}. ooo unstuck 후 사람에게 인계.`);
        return { status: "stuck", iterations: i, task: current.text };
      }
    }
    if (!after.some((t) => !t.done)) {
      const ev = await evaluate();
      if (ev.pass) return { status: "converged", iterations: i };
    }
  }
  return { status: "max_reached", iterations: opts.max };
}

if (process.argv[1] && /loop-runner\.mjs$/.test(process.argv[1])) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
  const cwd = process.cwd();
  const result = await runLoop({ cwd, max: parseInt(arg("--max", "30"), 10), goal: arg("--goal", "tasks 완료"), paths: { handoff: path.relative(cwd, handoffPath(cwd)), tasks: arg("--tasks", "tasks.md"), spec: arg("--spec", undefined) } });
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exit(result.status === "converged" ? 0 : 2);
}
