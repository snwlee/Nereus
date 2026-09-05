// PreToolUse(Bash|Edit|Write|MultiEdit): 규칙(regex)에 걸리는 명령·편집을 차단하고 규칙 문구를 되돌린다. fail-open.
// 규칙: 플러그인 기본(rules.default.json) + 사용자(~/.config/nereus/rules.json) + 프로젝트(.nereus/rules.json). 같은 id는 뒤가 덮어씀. enabled:false 로 끈다.
// git commit 이면 스테이징 내용도 검사한다(시크릿, .env, console.log).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readStdinJson } from "./lib/io.mjs";
import { userConfigDir, projectStateDir } from "./lib/paths.mjs";
import { run } from "./lib/exec.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_RULES = JSON.parse(fs.readFileSync(path.join(HERE, "..", "rules.default.json"), "utf8"));

function readRules(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; } }

export function loadRules(cwd) {
  const merged = new Map();
  for (const r of [...DEFAULT_RULES, ...readRules(path.join(userConfigDir(), "rules.json")), ...readRules(path.join(projectStateDir(cwd), "rules.json"))]) merged.set(r.id, r);
  return [...merged.values()].filter((r) => r.enabled !== false);
}

const SECRET_RE = /AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}/;
const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|dart|java|kt)$/;
const TEST_RE = /(\.test|\.spec|_test|Test)\.[a-z]+$|(^|\/)(test|tests|__tests__)\//;

export function checkCommitQuality({ files, diff }) {
  const out = [];
  for (const f of files) if (/(^|\/)\.env(\..*)?$/.test(f)) out.push({ category: "env_file", detail: f });
  const hasSource = files.some((f) => SOURCE_RE.test(f) && !TEST_RE.test(f));
  for (const line of diff.split("\n")) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    if (SECRET_RE.test(line)) out.push({ category: "secret", detail: line.slice(0, 60) });
    if (hasSource && /\bconsole\.log\(|\bprint\(\s*["']DEBUG|\bdebugPrint\(/.test(line)) out.push({ category: "debug_log", detail: line.trim().slice(0, 80) });
  }
  return out;
}

function defaultStaged(cwd) {
  const files = run("git", ["diff", "--cached", "--name-only"], { cwd }).stdout.split("\n").filter(Boolean);
  const diff = run("git", ["diff", "--cached"], { cwd }).stdout;
  return { files, diff };
}

export function handle(input, deps = {}) {
  const cwd = input.cwd || process.cwd();
  const tool = input.tool_name;
  const target = tool === "Bash" ? input.tool_input?.command ?? "" : input.tool_input?.file_path ?? "";
  if (!target) return null;
  const rules = (deps.rules ?? (() => loadRules(cwd)))();
  for (const r of rules) {
    if (r.tools && !r.tools.includes(tool)) continue;
    let re;
    try { re = new RegExp(r.pattern); } catch { continue; } // 잘못된 규칙은 무시(fail-open)
    if (re.test(target)) return { decision: "block", reason: `[nereus:${r.id}] ${r.message}` };
  }
  if (tool === "Bash" && /\bgit\s+commit\b/.test(target)) {
    const q = checkCommitQuality((deps.staged ?? (() => defaultStaged(cwd)))());
    if (q.length) return { decision: "block", reason: `[nereus:commit-quality] 스테이징에 문제: ${q.map((x) => `${x.category}(${x.detail})`).join(", ")}. 제거하거나 unstage 한 뒤 다시 커밋하세요.` };
  }
  return null;
}

if (process.argv[1] && /pre-tool-guard\.mjs$/.test(process.argv[1])) {
  const r = handle(readStdinJson());
  if (r) { process.stderr.write(r.reason + "\n"); process.exit(2); }
}
