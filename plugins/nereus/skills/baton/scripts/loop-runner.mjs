// reset 루프: 반복마다 새 `claude -p` 세션이 handoff.md·tasks·스펙만 읽고 시작한다. 상태는 파일과 git에만 있다.
// 사용: node loop-runner.mjs --goal "작업" --tasks <path> [--spec <path>] [--max 30] [--gate "<cmd>"] [--timeout <sec>]
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { run, which } from "../../../hooks/scripts/lib/exec.mjs";
import { handoffPath, handoffDir, latestHandoff } from "../../../hooks/scripts/lib/paths.mjs";
import { autonomousGate } from "../../../hooks/scripts/lib/autonomous-gate.mjs";
import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";

// [wave:N] 태그. [flow] 선례를 따라 대소문자·공백을 관대하게 받는다.
// 전역 플래그를 쓰지 않는다 — 공유 정규식에 /g 를 붙이면 lastIndex 가 남아 결과가 흔들린다.
export const WAVE_RE = /\[\s*wave\s*:\s*(\d+)\s*\]\s*/i;

export function parseTasks(text) {
  // 들여쓰기가 가장 얕은 체크박스만 태스크다. nereus:spec 이 만드는 tasks.md 는 태스크마다
  // 중첩 스텝 체크박스(실패 테스트 작성·실패 확인·최소 구현…)를 다는데, 이걸 같이 세면
  // (a) 태스크 8개가 체크박스 49개가 되어 반복마다 스텝 하나씩 처리하고
  // (b) 스텝이 태스크 사이에 끼어 planWaves 의 인접 규칙이 깨져 wave 가 아예 묶이지 않는다.
  // 절대 들여쓰기 0 이 아니라 "최소 들여쓰기"를 쓰는 이유는 목록 전체가 균일하게 들여쓰인
  // 파일도 그대로 받기 위해서다.
  const rows = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.+?)\s*$/);
    if (m) rows.push({ indent: m[1].length, mark: m[2], body: m[3] });
  }
  if (!rows.length) return [];
  const topIndent = Math.min(...rows.map((r) => r.indent));

  const out = [];
  for (const row of rows) {
    if (row.indent !== topIndent) continue;
    let body = row.body;
    let wave = null;
    const w = body.match(WAVE_RE);
    if (w) {
      const n = Number(w[1]);
      if (Number.isInteger(n) && n >= 1) {  // wave 는 1부터. 0·비정수는 오타로 보고 무시한다
        wave = n;
        body = (body.slice(0, w.index) + body.slice(w.index + w[0].length)).trim();
      }
    }
    out.push({ text: body, done: row.mark !== " ", wave });
  }
  return out;
}

/**
 * 미완료 태스크를 실행 그룹으로 나눈다. **인접한** 같은 wave 번호만 묶는다 —
 * 선언 순서에 의존성이 암묵적으로 들어 있어서, 떨어져 있는 같은 번호를 합치면
 * 사이에 있는 태스크를 앞질러 실행한다. 태그가 없으면 단독 그룹(= 기존 순차 동작).
 */
export function planWaves(tasks) {
  const groups = [];
  for (const t of tasks) {
    if (t.done) continue;
    const last = groups[groups.length - 1];
    const joinable = last && t.wave !== null && last[0].wave === t.wave;
    if (joinable) last.push(t);
    else groups.push([t]);
  }
  return groups;
}

const slug = (s, fallback = "task") =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || fallback;

/** 태스크 하나를 격리 실행할 워크트리 계획. 부수 효과 없음. */
export function planWorktree({ task, index, root, base }) {
  const name = `wave-${index}-${slug(task?.text)}`;
  const dir = path.join(root, ".nereus", "worktrees", name);
  const branch = `baton/${name}`;
  return { name, dir, branch, base, args: ["worktree", "add", "-b", branch, dir, base] };
}

/**
 * wave 하나를 실행한다.
 * - 태스크가 1개면 메인 워크트리에서 그대로 돈다(격리 비용 0, 기존 동작과 동일).
 * - 2개 이상이면 **반드시 워크트리로 격리**한다. 같은 워크트리에서 claude -p 를 동시에 띄우면
 *   두 프로세스가 같은 파일을 편집하고 서로의 변경을 커밋한다(실제로 겪은 사고다).
 * - 병합은 순차다. 동시에 merge 하면 인덱스가 깨진다.
 * - 워크트리는 실패해도 반드시 정리한다. 남으면 다음 실행의 add 가 경로 충돌로 실패한다.
 */
export async function runWave(group, opts, deps = {}) {
  const root = opts.root ?? opts.cwd ?? process.cwd();
  const log = deps.log ?? (() => {});
  const runClaudeIn = deps.runClaude ?? ((prompt, cwd) => defaultRunClaude(prompt, cwd, opts.allowedTools ?? LOOP_ALLOWED_TOOLS));
  const prompt = buildPrompt({ ...opts.paths, goal: opts.goal });

  if (group.length === 1) {
    const r = await runClaudeIn(prompt, root);
    return { ok: r.ok !== false, parallel: false, tasks: 1 };
  }

  const base = (deps.head ?? (() => run("git", ["rev-parse", "HEAD"], { cwd: root }).stdout.trim() || null))();
  if (!base) return { ok: false, reason: "git HEAD 를 읽을 수 없어 격리 기준을 정할 수 없습니다", parallel: false };

  const addWorktree = deps.addWorktree ?? ((w) => run("git", w.args, { cwd: root }));
  const removeWorktree = deps.removeWorktree ?? ((w) => run("git", ["worktree", "remove", "--force", w.dir], { cwd: root }));
  const commitIn = deps.commitIn ?? ((cwd, msg) => { run("git", ["add", "-A"], { cwd }); return run("git", ["commit", "-q", "-m", msg], { cwd }); });
  const mergeBranch = deps.mergeBranch ?? ((b) => {
    const r = run("git", ["merge", "--no-ff", "-m", `merge(baton): ${b}`, b], { cwd: root });
    return r.ok ? r : { ...r, conflict: true, branch: b };
  });
  // 충돌을 그대로 두면 MERGE_HEAD 와 UU 가 남아 다음 실행이 깨진다(실측으로 확인).
  // 되돌려 저장소를 깨끗하게 남기고, 태스크 브랜치는 지우지 않는다 — 그 작업을 살릴 수 있어야 한다.
  const abortMerge = deps.abortMerge ?? (() => run("git", ["merge", "--abort"], { cwd: root }));

  const plans = group.map((task, i) => ({ task, w: planWorktree({ task, index: i, root, base }) }));
  const created = [];
  try {
    for (const { w } of plans) {
      const r = addWorktree(w);
      if (r && r.ok === false) return { ok: false, reason: `워크트리 생성 실패: ${w.dir}`, parallel: true };
      created.push(w);
    }
    // 여기서만 병렬이다. 각자 자기 워크트리에서만 쓴다.
    const results = await Promise.all(plans.map(({ w }) => runClaudeIn(prompt, w.dir)));
    // 회수는 워크트리 제거(finally)보다 먼저여야 한다. 실패한 태스크의 handoff 도 가져온다 —
    // 왜 실패했는지가 거기 적혀 있다.
    const collectHandoff = deps.collectHandoff ?? defaultCollectHandoff;
    for (const { w } of plans) {
      try { collectHandoff(w.dir, path.join(wavesDir(root), `${w.name}.md`)); } catch { /* 회수 실패가 결과를 바꾸지 않는다 */ }
    }
    // 커밋은 병합 전에 끝나야 한다 — 커밋 없는 워크트리는 병합해도 아무것도 오지 않는다.
    for (const [i, { w, task }] of plans.entries()) {
      if (results[i] && results[i].ok === false) { log(`태스크 실패, 병합 건너뜀: ${task.text}`); continue; }
      commitIn(w.dir, `chore(baton): wave 태스크 — ${task.text.slice(0, 60)}`);
    }
    for (const [i, { w }] of plans.entries()) {
      if (results[i] && results[i].ok === false) continue;
      const m = mergeBranch(w.branch);
      if (m && m.ok === false) {
        abortMerge();
        return {
          ok: false,
          reason: `병합 충돌(conflict): ${w.branch} — 저장소는 되돌렸고 브랜치는 남겨뒀습니다`,
          branch: w.branch,
          parallel: true,
        };
      }
    }
    const failed = results.filter((r) => r && r.ok === false).length;
    return { ok: failed === 0, parallel: true, tasks: group.length, failed };
  } finally {
    for (const w of created) { try { removeWorktree(w); } catch { /* 정리 실패가 결과를 바꾸지 않는다 */ } }
  }
}

export function wavesDir(root) { return path.join(root, ".nereus", "waves"); }

/** 자식에게 루프 서브세션임을 알린다. SessionStart 훅이 이 값으로 동시 세션 경고를 끈다. */
export function claudeEnv(base = process.env) { return { ...base, NEREUS_LOOP: "1" }; }

/**
 * handoff 파일 경로를 프롬프트에 박지 않는다 — 세션마다 파일이 다르고, 그 경로는
 * SessionStart 훅이 각 서브세션에게 직접 알려준다. 여기서 고정 경로를 주면
 * 두 서브세션이 같은 파일을 쓴다.
 */
export function buildPrompt({ tasks, spec, waves, goal }) {
  return [
    `당신은 Nereus Baton 루프의 한 반복입니다. 목표: ${goal}`,
    "이 세션이 쓸 handoff 파일 경로는 **세션 시작 안내**에 적혀 있습니다. 그 파일만 읽고 쓰고, 디렉터리가 없으면 만드세요.",
    `${tasks} 에서 첫 미완료 태스크 하나를 고르세요. 스펙은 ${spec ?? "(없음)"} 입니다.`,
    "그 태스크만 nereus:build 규칙(TDD)으로 끝내고 체크박스를 채우세요. 다른 태스크는 건드리지 마세요.",
    `${waves} 에 파일이 있으면 직전 wave 서브세션들이 남긴 요약입니다. 읽어서 handoff 에 흡수한 뒤 그 파일을 지우세요.`,
    "끝나면 handoff 를 전체 재작성하고(목표/현재 단계/완료/진행 중/다음/실패한 접근과 이유/결정/열린 질문/테스트 상태), 변경을 conventional commit으로 커밋하세요.",
    "막히면 실패한 접근과 이유를 handoff에 남기고 멈추세요. 완료를 검증 없이 선언하지 마세요.",
  ].join("\n");
}

/**
 * 워크트리가 남긴 handoff 를 메인으로 회수한다. `.nereus/` 는 git 추적 밖이라
 * 커밋으로 따라오지 않고 워크트리 제거와 함께 사라진다 — 복사가 유일한 통로다.
 * paths.mjs 를 순수하게 두기 위해 디렉터리 읽기는 여기서 한다.
 */
function defaultCollectHandoff(worktreeDir, destPath) {
  const dir = handoffDir(worktreeDir);
  let entries = [];
  try {
    entries = fs.readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => ({ name, mtimeMs: fs.statSync(path.join(dir, name)).mtimeMs }));
  } catch { entries = []; }
  const src = latestHandoff({ cwd: worktreeDir, entries, legacyExists: fs.existsSync(handoffPath(worktreeDir)) });
  if (!src) return;                       // 남긴 것이 없으면 조용히 건너뛴다
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(src, destPath);
}

/**
 * 서브세션이 **자기 일을 끝내는 데 필요한 만큼만** 허용하는 목록.
 *
 * `--permission-mode acceptEdits` 는 파일 편집만 자동 승인한다. Bash 는 승인을 묻는데
 * 비대화형 `-p` 세션에서 그 물음은 곧 거부다. 그래서 wave 서브세션이 테스트를 한 번도
 * 돌리지 못하고 tdd-override 로 RED 없이 구현하는 사고가 났다(add-plugin-doctor 사이클).
 *
 * 그렇다고 bypassPermissions 로 올리지 않는다. 루프는 사람이 안 보는 동안 도는데, 거기서
 * 전권을 주면 되돌릴 수 없는 일이 조용히 일어난다. 러너·git 커밋까지만 연다 —
 * **push 는 넣지 않는다.** 원격에 나가는 것은 사람이 보고 결정할 일이다.
 */
export const LOOP_ALLOWED_TOOLS = Object.freeze([
  "Bash(node:*)",
  "Bash(npx vitest:*)",
  "Bash(npm test:*)",
  "Bash(npm run:*)",
  "Bash(./gradlew:*)",
  "Bash(mvn test:*)",
  "Bash(flutter test:*)",
  "Bash(flutter analyze:*)",
  "Bash(git add:*)",
  "Bash(git commit:*)",
  "Bash(git status:*)",
  "Bash(git diff:*)",
  "Bash(git log:*)",
]);

// 사용자가 config 로 더해도 **넘길 수 없는 선**. 루프는 사람이 안 보는 동안 돈다.
const FORBIDDEN_IN_EXTRAS = [/git\s+push/i, /bypassPermissions/i, /--dangerously/i];

/**
 * 기본 목록에 프로젝트 설정의 `loop.extraAllowedTools` 를 더한다.
 *
 * 환경마다 명령이 다른 모양으로 나간다 — 이 저장소에서는 rtk 훅이 `git status` 를
 * `rtk git status` 로 재작성해서 기본 목록과 어긋났고, 서브세션이 저장소 상태를 못 봤다.
 * 그런 프록시는 환경 고유라 배포 기본값에 넣지 않는다. 사용자가 더하되, 더하는 것으로
 * push 나 권한 상승을 들여올 수는 없다.
 */
export function resolveAllowedTools(config = {}) {
  const extra = config?.loop?.extraAllowedTools;
  if (!Array.isArray(extra)) return [...LOOP_ALLOWED_TOOLS];
  const safe = extra.filter((e) => typeof e === "string" && !FORBIDDEN_IN_EXTRAS.some((re) => re.test(e)));
  return [...LOOP_ALLOWED_TOOLS, ...safe];
}

/** `claude -p` 인자 조립. 순수 함수라 무엇을 허용했는지 테스트가 직접 검사한다. */
export function claudeArgs(prompt, { allowedTools } = {}) {
  const args = ["-p", prompt, "--permission-mode", "acceptEdits"];
  if (allowedTools?.length) args.push("--allowedTools", allowedTools.join(" "));
  return args;
}

function defaultRunClaude(prompt, cwd, allowedTools = LOOP_ALLOWED_TOOLS) {
  return new Promise((resolve) => {
    const bin = which("claude");
    if (!bin) return resolve({ ok: false, error: "claude CLI 없음" });
    const p = spawn(bin, claudeArgs(prompt, { allowedTools }), { cwd, stdio: ["ignore", "inherit", "inherit"], shell: false, env: claudeEnv() });
    p.on("close", (code) => resolve({ ok: code === 0, code }));
    p.on("error", (e) => resolve({ ok: false, error: String(e) }));
  });
}

/** `--gate "<cmd>"` 를 셸 없이 돌린다. 종료코드 0 만 통과다. */
function defaultGateCmd(cwd, cmd) {
  const [bin, ...args] = String(cmd).trim().split(/\s+/);
  const r = run(bin, args, { cwd, timeoutMs: 10 * 60 * 1000 });
  return { pass: r.ok, reason: r.ok ? undefined : `게이트 명령 실패: ${cmd}` };
}

/**
 * 수렴 검증 명령. 순수 함수라 무엇을 돌리는지 테스트가 직접 본다.
 *
 * 예전에는 `ooo qa --json .` 을 돌렸는데 그런 플래그가 없다(ooo 0.53 기준 exit=2).
 * `ooo qa` 는 **아티팩트 하나**(텍스트나 파일)를 받는 판정기라 저장소 전체 게이트로는 맞지 않는다.
 * 그래서 항상 실패했고, 루프는 수렴하지 못한 채 게이트 3회 실패로 멈췄다. 프로젝트 자신의
 * 테스트 러너를 돌린다 — 증거 파일(.nereus/evidence.json)까지 같은 경로로 남는다.
 */
export function evaluateCmd({ cwd, moduleUrl = import.meta.url } = {}) {
  // fileURLToPath 를 쓴다. URL.pathname 은 win32 에서 `/C:/...` 를 줘서 경로가 깨진다.
  const here = path.dirname(fileURLToPath(moduleUrl));
  return { bin: "node", args: [path.resolve(here, "..", "..", "build", "scripts", "run-tests.mjs")], cwd };
}

async function defaultEvaluate(cwd) {
  const cmd = evaluateCmd({ cwd });
  const r = run(cmd.bin, cmd.args, { cwd, timeoutMs: 10 * 60 * 1000 });
  return { pass: r.ok, output: String(r.stdout ?? "").slice(-2000) };
}

export async function runLoop(opts, deps = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const readTasks = deps.readTasks ?? (() => fs.readFileSync(path.resolve(cwd, opts.paths.tasks), "utf8"));
  const allowedTools = deps.allowedTools ?? resolveAllowedTools((deps.config ?? (() => loadConfig({ cwd })))());
  const runClaude = deps.runClaude ?? ((prompt) => defaultRunClaude(prompt, cwd, allowedTools));
  const gitDirty = deps.gitDirty ?? (() => run("git", ["status", "--porcelain"], { cwd }).stdout.trim() !== "");
  const commit = deps.commit ?? ((msg) => { run("git", ["add", "-A"], { cwd }); run("git", ["commit", "-q", "-m", msg], { cwd }); });
  const evaluate = deps.evaluate ?? (() => defaultEvaluate(cwd));
  const log = deps.log ?? ((m) => process.stderr.write(`[baton-loop] ${m}\n`));
  // 게이트는 반복마다 도는 검증이다. `--gate` 가 없으면 수렴 판정과 같은 evaluate 를 쓴다
  // (ooo 가 없으면 defaultEvaluate 가 skipped:true 로 통과시키므로 기존 동작이 유지된다).
  const gate = deps.gate ?? (() => (opts.gateCmd ? defaultGateCmd(cwd, opts.gateCmd) : evaluate()));
  // autonomousGate 는 개수만 본다. gitDirty 를 통해 흐르게 해서 주입 지점을 하나로 유지한다.
  const changedFiles = deps.changedFiles ?? (() => (gitDirty() ? ["<dirty>"] : []));
  const now = deps.now ?? (() => Date.now());
  const deadline = opts.timeoutMs ? now() + opts.timeoutMs : null;

  // wave 를 쓰려면 runWave 를 거쳐야 한다. 그룹 크기 1이면 runWave 가 메인 워크트리에서
  // 그대로 돌므로 태그 없는 tasks 는 기존 순차 동작과 동일하다(하위 호환).
  const wave = deps.runWave ?? ((group) => runWave(group, { ...opts, root: cwd, allowedTools }, { ...deps, runClaude: deps.runClaude }));

  let sameTaskFails = 0;
  let lastTask = null;
  // 게이트 실패는 태스크가 아니라 저장소 상태의 문제다. sameTaskFails 는 "같은 태스크" 키로 세는데
  // 서브세션이 체크박스를 채우면 키가 매번 바뀌어 리셋된다 — 깨진 채로 max 까지 걸어가게 된다.
  // 그래서 연속 게이트 실패는 따로 센다.
  let gateFails = 0;
  for (let i = 1; i <= opts.max; i++) {
    const before = parseTasks(readTasks());
    const groups = planWaves(before);
    const group = groups[0] ?? null;
    const current = group?.[0] ?? null;
    if (!current) {
      const ev = await evaluate();
      if (ev.pass) return { status: "converged", iterations: i - 1 };
      log(`태스크는 전부 체크됐지만 evaluate 실패. 반복 계속.`);
    }
    const label = group ? group.map((t) => t.text).join(" | ") : "(evaluate 재시도)";
    log(`반복 ${i}/${opts.max}${group && group.length > 1 ? ` [wave ${current.wave}, ${group.length}개 병렬]` : ""}: ${label}`);
    if (group) {
      const wr = await wave(group);
      // 병합 충돌은 열린 재시도로 덮지 않는다 — 사람이 브랜치를 보고 풀어야 한다.
      if (wr && wr.ok === false && wr.branch) return { status: "conflict", iterations: i, reason: wr.reason, branch: wr.branch };
    }
    // 자율 게이트(출처: Prime Agent autonomous gate). 무변경이면 게이트를 아예 돌리지 않는다.
    const changed = changedFiles();
    const gateResult = changed.length ? await gate() : { pass: true };
    const decision = autonomousGate({
      gateResult,
      changedFiles: changed,
      // 턴 소진은 루프의 max 가 이미 max_reached 로 처리한다. 여기서는 시간 바운드만 본다.
      budget: { turnsLeft: opts.max - i + 1, timedOut: deadline !== null && now() > deadline },
    });
    if (decision.decision === "return-bounded" && decision.reason === "budget-exhausted") {
      log(`시간 바운드 소진. 미커밋 변경은 그대로 둡니다 — 사람이 보고 판단하세요.`);
      return { status: "budget_exhausted", iterations: i };
    }
    // 게이트 실패는 커밋을 막지 않는다(작업 유실이 더 나쁘다). 대신 메시지에 남기고,
    // 아래에서 이 반복을 "진행"으로 세지 않는다 — 체크박스 자기신고를 믿지 않는 지점이다.
    const gateFailed = decision.decision === "return-bounded";
    gateFails = gateFailed ? gateFails + 1 : 0;
    if (gateFailed) log(`게이트 실패(${decision.reason}). 이 반복은 진행으로 세지 않습니다. (연속 ${gateFails}회)`);
    if (gitDirty()) {
      commit(gateFailed ? `chore(baton): 반복 ${i} 체크포인트 (게이트 실패: ${decision.reason})` : `chore(baton): 반복 ${i} 체크포인트`);
    }

    const after = parseTasks(readTasks());
    const progressed = !gateFailed && after.filter((t) => t.done).length > before.filter((t) => t.done).length;
    if (!current) continue;
    if (progressed) { sameTaskFails = 0; lastTask = null; }
    else {
      const key = group ? group.map((t) => t.text).join("|") : current.text;
      sameTaskFails = lastTask === key ? sameTaskFails + 1 : 1;
      lastTask = key;
      if (sameTaskFails >= 3) {
        log(`같은 태스크 3회 실패: ${current.text}. ooo unstuck 후 사람에게 인계.`);
        return { status: "stuck", iterations: i, task: current.text };
      }
    }
    // stuck 이 먼저다 — 기존 판정을 바꾸지 않는다. 여기 오는 건 체크박스는 넘어가는데
    // 게이트만 계속 깨지는 경우다(자기신고 진행). 저장소가 깨진 채로 max 까지 걸어가지 않는다.
    if (gateFails >= 3) {
      log(`게이트 3회 연속 실패(${decision.reason}). 저장소가 깨진 채로 더 돌지 않습니다.`);
      return { status: "gate_blocked", iterations: i, reason: decision.reason };
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
  const timeoutSec = parseInt(arg("--timeout", "0"), 10);
  const result = await runLoop({ cwd, max: parseInt(arg("--max", "30"), 10), goal: arg("--goal", "tasks 완료"), gateCmd: arg("--gate", undefined), timeoutMs: Number.isFinite(timeoutSec) && timeoutSec > 0 ? timeoutSec * 1000 : undefined, paths: { waves: path.relative(cwd, wavesDir(cwd)), tasks: arg("--tasks", "tasks.md"), spec: arg("--spec", undefined) } });
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exit(result.status === "converged" ? 0 : 2);
}
