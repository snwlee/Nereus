// 리뷰 실행기: OCR delegation + 2차 의견(codex/gemini)을 설정대로 돌리고 findings를 병합한다.
// 실제 CLI 호출은 SKILL이 주도하고, 이 스크립트는 계획·파싱·병합·게이트를 담당한다.
import { which } from "../../../hooks/scripts/lib/exec.mjs";
import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";

const ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const norm = (s) => { const u = String(s ?? "INFO").toUpperCase(); return ORDER.includes(u) ? u : u === "ERROR" ? "HIGH" : u === "WARNING" ? "MEDIUM" : "INFO"; };

// 리뷰어 정의. gemini 2차 의견은 Antigravity CLI(agy)로 실행한다.
export const REVIEWERS = {
  ocr: { bin: "ocr", label: "Open Code Review" },
  codex: { bin: "codex", label: "Codex" },
  gemini: { bin: "agy", label: "Gemini (Antigravity)" },
};

const SHORTHAND = {
  both: ["ocr", "codex", "gemini"],
  codex: ["ocr", "codex"],
  gemini: ["ocr", "gemini"],
  none: ["ocr"], // 2차 의견 없이 결정론적 리뷰만
};

/** 설정값을 리뷰어 id 배열로 편다. 문자열 단축형과 배열을 모두 받는다. */
export function normalizeReviewers(value) {
  if (Array.isArray(value)) return value.filter((v) => v in REVIEWERS);
  if (typeof value === "string" && value in SHORTHAND) return SHORTHAND[value];
  return SHORTHAND.both;
}

export function planRunners(value, available = (b) => !!which(b)) {
  const want = normalizeReviewers(value);
  const plan = { ocr: false, codex: false, gemini: false, skipped: [] };
  for (const id of Object.keys(REVIEWERS)) {
    if (!want.includes(id)) continue;
    if (available(REVIEWERS[id].bin)) plan[id] = true; else plan.skipped.push(id);
  }
  return plan;
}

export function parseOcrJson(raw) {
  try {
    const j = JSON.parse(raw);
    const items = j.comments ?? j.findings ?? j.results ?? [];
    return items.map((c) => ({ source: "ocr", file: c.file ?? c.path ?? "", line: c.line ?? c.start_line ?? 0, severity: norm(c.severity ?? c.level), message: c.content ?? c.message ?? c.body ?? "" }));
  } catch { return []; }
}

export function mergeFindings(findings) {
  const sorted = [...findings].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity) || String(a.file).localeCompare(String(b.file)) || (a.line ?? 0) - (b.line ?? 0));
  if (!sorted.length) return "## 리뷰 결과\n\n발견된 문제 없음.";
  const lines = ["## 리뷰 결과", ""];
  let cur = null;
  for (const f of sorted) {
    if (f.severity !== cur) { cur = f.severity; lines.push(`### ${cur}`); }
    lines.push(`- [${f.source}] ${f.file}:${f.line} — ${f.message}`);
  }
  return lines.join("\n");
}

export function gate(findings) {
  const blocking = findings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH").length;
  return { pass: blocking === 0, blocking };
}

if (process.argv[1] && /review\.mjs$/.test(process.argv[1])) {
  const cfg = loadConfig();
  process.stdout.write(JSON.stringify({ mode: cfg.secondOpinion, plan: planRunners(cfg.secondOpinion) }) + "\n");
}
