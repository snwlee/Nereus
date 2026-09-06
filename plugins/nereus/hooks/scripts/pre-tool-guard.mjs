// PreToolUse(Bash|Edit|Write|MultiEdit): 규칙(regex)에 걸리는 명령·편집을 차단하고 규칙 문구를 되돌린다. fail-open.
// 규칙: 플러그인 기본(rules.default.json) + 사용자(~/.config/nereus/rules.json) + 프로젝트(.nereus/rules.json). 같은 id는 뒤가 덮어씀. enabled:false 로 끈다.
// git commit 이면 스테이징 내용도 검사한다(시크릿, .env, console.log).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readStdinJson, note } from "./lib/io.mjs";
import { userConfigDir, projectStateDir } from "./lib/paths.mjs";
import { run } from "./lib/exec.mjs";
import { parseDiff } from "./lib/integrity.mjs";
import { globToRegExp } from "./tdd-guard.mjs";
import { loadConfig } from "./lib/config.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_RULES = JSON.parse(fs.readFileSync(path.join(HERE, "..", "rules.default.json"), "utf8"));

function readRules(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; } }

/** 병합된 전체 규칙(비활성 포함). 비활성 여부는 쓰는 쪽에서 판단한다. */
export function loadRules(cwd) {
  const merged = new Map();
  for (const r of [...DEFAULT_RULES, ...readRules(path.join(userConfigDir(), "rules.json")), ...readRules(path.join(projectStateDir(cwd), "rules.json"))]) merged.set(r.id, r);
  return [...merged.values()];
}

export const isEnabled = (r) => r.enabled !== false;

const SECRET_RE = /AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}/;
const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|dart|java|kt|py|go|rs)$/;
const TEST_RE = /(\.test|\.spec|_test|Test)\.[a-z]+$|(^|\/)(test|tests|__tests__)\//;
const DEBUG_RE = /\bconsole\.log\(|\bprint\(\s*["']DEBUG|\bdebugPrint\(/;

// 안전 문제(secret, env_file)만 차단한다. 스타일 문제(debug_log)는 경고에 그친다.
// 벤더 코드나 템플릿을 처음 커밋할 때 로그 수백 건으로 커밋이 막히는 것은 도움이 아니라 방해다.
export const COMMIT_DEFAULTS = { block: ["secret", "env_file"], warn: ["debug_log"], exclude: [], maxReport: 8 };

export function checkCommitQuality({ files, diff }) {
  const out = [];
  for (const f of files) if (/(^|\/)\.env(\..*)?$/.test(f)) out.push({ category: "env_file", file: f, detail: f });
  for (const f of parseDiff(diff)) {
    const isSource = SOURCE_RE.test(f.file) && !TEST_RE.test(f.file);
    for (const line of f.added) {
      if (SECRET_RE.test(line)) out.push({ category: "secret", file: f.file, detail: line.trim().slice(0, 60) });
      if (isSource && DEBUG_RE.test(line)) out.push({ category: "debug_log", file: f.file, detail: line.trim().slice(0, 80) });
    }
  }
  return out;
}

/** 설정에 따라 차단할 것과 경고만 할 것으로 나눈다. exclude(glob) 에 걸린 파일은 제외한다. */
export function partitionQuality(findings, cfg = COMMIT_DEFAULTS) {
  const globs = (cfg.exclude ?? []).map(globToRegExp);
  const kept = findings.filter((f) => !globs.some((re) => re.test(f.file ?? "")));
  return {
    blocking: kept.filter((f) => (cfg.block ?? []).includes(f.category)),
    warnings: kept.filter((f) => (cfg.warn ?? []).includes(f.category)),
  };
}

export function summarize(findings, max = COMMIT_DEFAULTS.maxReport) {
  const shown = findings.slice(0, max).map((f) => `${f.category}(${f.file ?? ""}${f.detail && f.detail !== f.file ? `: ${f.detail}` : ""})`);
  const rest = findings.length - shown.length;
  return shown.join(", ") + (rest > 0 ? ` 외 ${rest}건` : "");
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
    if (!isEnabled(r)) continue;
    if (r.tools && !r.tools.includes(tool)) continue;
    let re;
    try { re = new RegExp(r.pattern); } catch { continue; } // 잘못된 규칙은 무시(fail-open)
    if (re.test(target)) return { decision: "block", reason: `[nereus:${r.id}] ${r.message}` };
  }
  if (tool === "Bash" && /\bgit\s+commit\b/.test(target)) {
    // rules.json 에 {"id":"commit-quality","enabled":false} 를 넣으면 통째로 끌 수 있다
    if (rules.some((r) => r.id === "commit-quality" && !isEnabled(r))) return null;
    const cfg = { ...COMMIT_DEFAULTS, ...((deps.config ?? (() => loadConfig({ cwd })))().commitQuality ?? {}) };
    const staged = (deps.staged ?? (() => defaultStaged(cwd)))();
    const { blocking, warnings } = partitionQuality(checkCommitQuality(staged), cfg);
    if (warnings.length) (deps.note ?? note)(`커밋 품질 경고 ${warnings.length}건: ${summarize(warnings, cfg.maxReport)}`);
    if (blocking.length) return { decision: "block", reason: `[nereus:commit-quality] 스테이징에 안전 문제 ${blocking.length}건: ${summarize(blocking, cfg.maxReport)}. 제거하거나 unstage 한 뒤 다시 커밋하세요. 이 검사를 끄려면 .nereus/rules.json 에 {"id":"commit-quality","enabled":false} 를 넣으세요.` };
  }
  return null;
}

if (process.argv[1] && /pre-tool-guard\.mjs$/.test(process.argv[1])) {
  const r = handle(readStdinJson());
  if (r) { process.stderr.write(r.reason + "\n"); process.exit(2); }
}
