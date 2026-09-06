// 관찰층. 훅이 여기서 판정하지 않고 최소 사실만 적재한다. 판정은 signals.mjs 가 나중에 결정론적으로 한다.
// 설계 출처: ECC continuous-learning-v2 의 "훅은 무판정 적재" 구조(MIT). LLM 데몬은 쓰지 않는다.
import fs from "node:fs";
import path from "node:path";
import { projectStateDir } from "./paths.mjs";
import { isCorrection } from "./learnings.mjs";

export const MAX_LINES = 2000;
export const SIG_MAX = 120;
export const EXCERPT_MAX = 200;

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
    return { ...base, tool: "Bash", ok: exit === undefined ? true : exit === 0, sig: redact(String(cmd)).slice(0, SIG_MAX) };
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

export function observationsPath(cwd) { return path.join(projectStateDir(cwd), "learn", "observations.jsonl"); }

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
