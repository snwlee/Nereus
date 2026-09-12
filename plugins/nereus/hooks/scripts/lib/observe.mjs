// 관찰층. 훅이 여기서 판정하지 않고 최소 사실만 적재한다. 판정은 signals.mjs 가 나중에 결정론적으로 한다.
// 설계 출처: ECC continuous-learning-v2 의 "훅은 무판정 적재" 구조(MIT). LLM 데몬은 쓰지 않는다.
import fs from "node:fs";
import path from "node:path";
import { projectStateDir } from "./paths.mjs";
import { isCorrection } from "./learnings.mjs";

const MAX_LINES = 2000;
const SIG_MAX = 120;
const EXCERPT_MAX = 200;

const SECRET_RE = [
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /sk-[A-Za-z0-9_-]{16,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{3,}\.[A-Za-z0-9_-]{3,}/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
];

export function redact(text) {
  let out = String(text ?? "");
  for (const re of SECRET_RE) out = out.replace(re, "[REDACTED]");
  return out;
}

// 세션마다 달라지는 임시 경로. 그대로 서명에 들어가면 재발 불가한 명령이 "반복"으로 승격된다.
const TMP_PATH = [
  [/(?:\/private)?\/tmp\/claude-[0-9]+\/[^\s/]+\/[0-9a-f-]{8,}\/scratchpad/g, "$SCRATCH"],
  [/(?:\/private)?\/var\/folders\/[^\s]*/g, "$TMP"],
  [/(?:\/private)?\/tmp\/[^\s]*/g, "$TMP"],
];

// 명령 앞머리의 노이즈. 이것들이 SIG_MAX 를 잡아먹어 정작 실행한 명령이 잘렸다.
const LEADING_NOISE = [
  /^\s*cd\s+\S+\s*&&\s*/,        // cd <path> && <실제 명령>
  /^\s*[A-Za-z_][A-Za-z0-9_]*=\S*\s+/, // FOO=1 <실제 명령>
  /^\s*[A-Za-z_][A-Za-z0-9_]*=\S*\n+/, // VAR=값 개행 후 실제 명령
];

/** 반복·인과 판정에 쓸 명령 서명. 시크릿 제거 + 임시 경로 정규화 + 앞머리 노이즈 제거 후 상한 적용. */
export function commandSignature(cmd) {
  let out = redact(String(cmd ?? ""));
  for (const [re, to] of TMP_PATH) out = out.replace(re, to);
  // 접두가 겹쳐 붙을 수 있으므로(VAR=… 뒤에 또 cd …) 더 벗겨지지 않을 때까지 반복한다
  for (let i = 0; i < 5; i++) {
    const before = out;
    for (const re of LEADING_NOISE) out = out.replace(re, "");
    if (out === before) break;
  }
  return out.trim().slice(0, SIG_MAX);
}

// 관찰하지 않는 경로: 우리 상태 파일, 메모리 플러그인, 잠금·빌드 산출물
const SKIP_PATH = /(^|\/)(\.nereus|\.claude-mem|node_modules|dist|build|coverage|\.git)(\/|$)/;
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

function relative(cwd, file) {
  const f = String(file).replace(/\\/g, "/");
  const c = String(cwd ?? "").replace(/\\/g, "/").replace(/\/$/, "");
  return c && f.startsWith(c + "/") ? f.slice(c.length + 1) : f;
}

export function toolObservation(input, { now = Date.now() } = {}) {
  const tool = input?.tool_name;
  const base = { k: "tool", t: now, s: input?.session_id ?? "" };
  if (tool === "Bash") {
    const cmd = input?.tool_input?.command;
    if (!cmd) return null;
    const exit = input?.tool_response?.exit_code ?? input?.tool_response?.exitCode;
    return { ...base, tool: "Bash", ok: exit === undefined ? true : exit === 0, sig: commandSignature(cmd) };
  }
  if (EDIT_TOOLS.has(tool)) {
    const fp = input?.tool_input?.file_path;
    if (!fp) return null;
    const rel = relative(input?.cwd, fp);
    if (SKIP_PATH.test(rel)) return null;
    return { ...base, tool, ok: true, file: rel };
  }
  return null; // Read/Grep/Glob 등 읽기 도구는 신호가 되지 않는다
}

export function promptObservation(input, { now = Date.now() } = {}) {
  const prompt = input?.prompt ?? "";
  if (!isCorrection(prompt)) return null;
  return { k: "correction", t: now, s: input?.session_id ?? "", excerpt: redact(prompt).replace(/\s+/g, " ").trim().slice(0, EXCERPT_MAX) };
}

export function rotate(text, maxLines = MAX_LINES) {
  const lines = String(text ?? "").split("\n").filter(Boolean);
  return lines.slice(-maxLines).join("\n");
}

function observationsPath(cwd) { return path.join(projectStateDir(cwd), "learn", "observations.jsonl"); }

export function appendObservation(cwd, rec, { maxLines = MAX_LINES } = {}) {
  if (!rec) return null;
  const file = observationsPath(cwd);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(rec) + "\n");
    const stat = fs.statSync(file);
    if (stat.size > 512 * 1024) fs.writeFileSync(file, rotate(fs.readFileSync(file, "utf8"), maxLines) + "\n");
  } catch { return null; } // 관찰 실패가 작업을 막아서는 안 된다
  return rec;
}

export function readObservations(cwd, { readFile = (p) => fs.readFileSync(p, "utf8") } = {}) {
  try {
    return readFile(observationsPath(cwd)).split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

export function clearObservations(cwd) {
  try { fs.unlinkSync(observationsPath(cwd)); } catch { /* 이미 없음 */ }
}
