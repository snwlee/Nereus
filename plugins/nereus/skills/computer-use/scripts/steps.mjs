#!/usr/bin/env node
// Saved steps — 검증된 조작을 레시피로 저장해 다음에는 LLM 없이 재실행한다. 깨지면 에이전트에게 돌려준다.
// 출처: milind-soni/OpenMausBot server/saved-steps (Apache-2.0). 기록 대신 cua-driver run_script 레시피를 저장한다:
// run_script 는 {role,name} 대상을 매번 새로 찾으므로 스냅샷 토큰이 낡는 문제가 없다.
//
//   node steps.mjs save <이름> --app <프로세스명> --script <js파일> [--irreversible] [--note "..."]
//   node steps.mjs list
//   node steps.mjs run <이름> [--approved]          종료코드 0 통과 · 3 실패(에이전트가 이어받는다) · 4 승인 필요/차단
//
// 실행 경로는 `cua-driver mcp`(stdio). Windows 에서 데몬 named pipe 가 응답 없이 끊기는 환경이 실측됐고(0.37·0.47),
// bare MCP 는 자체 런타임을 띄워 데몬이 필요 없다.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;
const MAX_SCRIPT = 65536; // run_script input_schema maxLength
const SNAPSHOT_TOKEN = /["'`]s[0-9a-f]{6,}:\d+["'`]/;
const RETURNS_OK = /return\s*\{[^}]*\bok\s*:/;
const FAIL_STREAK = 2;
const RUN_TIMEOUT_MS = 120000;
const KEEP_RUNS = 20;

export const recipePath = (cwd, name) => path.join(cwd, ".nereus", "saved-steps", `${name}.json`);

export function validateRecipe(r) {
  const errors = [];
  if (!NAME.test(String(r?.name ?? ""))) errors.push("이름은 소문자·숫자·하이픈(kebab-case)만");
  if (!String(r?.app ?? "").trim()) errors.push("app(대상 프로세스명)이 필요하다");
  const s = String(r?.script ?? "");
  if (!s.trim()) errors.push("script 가 비었다");
  if (s.length > MAX_SCRIPT) errors.push(`script 가 run_script 한도 ${MAX_SCRIPT}자를 넘는다`);
  if (SNAPSHOT_TOKEN.test(s)) errors.push("스냅샷 element token 은 다음 실행에서 무효다 — {role, name} 대상으로 바꾼다");
  if (!RETURNS_OK.test(s)) errors.push("마지막에 검증 결과를 return {ok: <검증식>, ...} 로 낸다 — run_script 의 ok 는 호출 성공일 뿐이다");
  return errors;
}

export function parseRunResult(msg) {
  if (!msg || typeof msg !== "object") return { ok: false, reason: "응답 없음" };
  if (msg.error) return { ok: false, reason: `MCP 오류: ${msg.error.message ?? msg.error.code}` };
  const sc = msg.result?.structuredContent;
  if (!sc) return { ok: false, reason: "structuredContent 없음" };
  const base = { ms: sc.elapsed_ms ?? null, calls: sc.driver_calls ?? null, value: sc.value ?? null };
  if (sc.ok !== true) {
    const e = sc.error;
    const why = e && typeof e === "object" ? `${e.op ?? "?"}: ${e.message ?? e.code ?? "알 수 없음"}` : e ?? "알 수 없음";
    return { ...base, ok: false, reason: `드라이버 실패: ${why}` };
  }
  if (sc.value?.ok !== true) return { ...base, ok: false, reason: "레시피 검증 실패 (return {ok} 가 true 아님)" };
  return { ...base, ok: true };
}

export function runGate(recipe, { approved = false } = {}) {
  const recent = (recipe.runs ?? []).slice(-FAIL_STREAK);
  if (recent.length === FAIL_STREAK && recent.every((r) => !r.ok)) {
    return { allow: false, reason: `최근 ${FAIL_STREAK}회 연속 실패 — 앱이 바뀌었을 수 있다. 에이전트가 직접 조작하고 성공하면 다시 save 한다` };
  }
  if (recipe.irreversible && !approved) {
    return { allow: false, reason: "되돌리기 어려운 레시피(저장·전송·삭제 등) — 사용자 승인 뒤 --approved 로 실행한다" };
  }
  return { allow: true };
}

// cua-driver mcp 에 JSON-RPC 로 run_script 한 번. 반환은 tools/call 응답 메시지(실패·시간초과면 null).
function callRunScript(script, { bin = "cua-driver", session = "nereus-steps", timeoutMs = RUN_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const p = spawn(bin, ["mcp"], { stdio: ["pipe", "pipe", "ignore"] });
    let buf = "";
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      p.kill();
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs + 5000);
    const send = (m) => p.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
    p.on("error", () => finish(null));
    p.on("exit", () => finish(null));
    p.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        let m;
        try { m = JSON.parse(line); } catch { continue; }
        if (m.id === 1) {
          send({ method: "notifications/initialized" });
          send({ id: 2, method: "tools/call", params: { name: "run_script", arguments: { session, script, timeout_ms: timeoutMs } } });
        } else if (m.id === 2) finish(m);
      }
    });
    send({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "nereus-steps", version: "1" } } });
  });
}

const readRecipe = (cwd, name) => JSON.parse(fs.readFileSync(recipePath(cwd, name), "utf8"));
const writeRecipe = (cwd, r) => {
  const p = recipePath(cwd, r.name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(r, null, 2) + "\n");
};

const flag = (argv, name) => {
  const i = argv.indexOf(name);
  return i > -1 ? argv[i + 1] : undefined;
};

function list(cwd) {
  const dir = path.dirname(recipePath(cwd, "x"));
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
  return files.map((f) => {
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    return { name: r.name, app: r.app, irreversible: Boolean(r.irreversible), note: r.note ?? "", lastRun: r.runs?.at(-1) ?? null };
  });
}

function save(cwd, name, argv) {
  const file = flag(argv, "--script");
  if (!file || !fs.existsSync(file)) return [{ error: "--script <js파일> 이 필요하다" }, 2];
  const recipe = {
    name, app: flag(argv, "--app") ?? "", script: fs.readFileSync(file, "utf8"),
    irreversible: argv.includes("--irreversible"), note: flag(argv, "--note") ?? "",
    savedAt: new Date().toISOString(), runs: [],
  };
  const errors = validateRecipe(recipe);
  if (errors.length) return [{ error: "저장 거절", errors }, 2];
  writeRecipe(cwd, recipe);
  return [{ saved: recipePath(cwd, name) }, 0];
}

async function run(cwd, name, argv) {
  if (!NAME.test(String(name ?? ""))) return [{ error: "레시피 이름이 필요하다" }, 2];
  if (!fs.existsSync(recipePath(cwd, name))) return [{ error: `레시피 없음: ${name}` }, 2];
  const recipe = readRecipe(cwd, name);
  const gate = runGate(recipe, { approved: argv.includes("--approved") });
  if (!gate.allow) return [{ name, ran: false, reason: gate.reason }, 4];
  const res = parseRunResult(await callRunScript(recipe.script, { session: `nereus-steps-${name}` }));
  const entry = { at: new Date().toISOString(), ok: res.ok, ms: res.ms, reason: res.reason };
  writeRecipe(cwd, { ...recipe, runs: [...(recipe.runs ?? []), entry].slice(-KEEP_RUNS) });
  return [{ name, ran: true, ...res }, res.ok ? 0 : 3];
}

async function main(argv, cwd = process.cwd()) {
  const [cmd, name] = argv;
  if (cmd === "list") return [list(cwd), 0];
  if (cmd === "save") return save(cwd, name, argv);
  if (cmd === "run") return run(cwd, name, argv);
  return [{ error: "사용: steps.mjs save|list|run" }, 2];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).then(([body, code]) => {
    console.log(JSON.stringify(body, null, 2));
    process.exit(code);
  });
}
