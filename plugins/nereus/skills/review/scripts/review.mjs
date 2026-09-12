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

// "PATH 에 있음"과 "쓸 수 있음"은 다르다. agy 는 PATH 에 있으면서 무응답 후 exit 0 을 내고,
// ocr delegate 는 커밋된 diff 를 못 본다. 존재만으로 가용을 단정하면 계획은 초록인데
// 실제로는 아무도 리뷰하지 않는 상태가 된다 — 두 사이클 연속 그렇게 종결했다.
// probe 를 주지 않으면 기존 동작 그대로다(기존 호출부 호환).
export function planRunners(value, available = (b) => !!which(b), probe = null) {
  const want = normalizeReviewers(value);
  const plan = { ocr: false, codex: false, gemini: false, skipped: [] };
  for (const id of Object.keys(REVIEWERS)) {
    if (!want.includes(id)) continue;
    const bin = REVIEWERS[id].bin;
    // skipped 는 기존 계약대로 id 문자열 배열을 유지한다. 사유는 probe 를 쓸 때만 reasons 로 덧붙인다.
    if (!available(bin)) { skip(plan, id, bin, "PATH 에 없음", probe); continue; }
    if (probe) {
      const r = probe(bin);
      if (!r?.ok) { skip(plan, id, bin, r?.why ?? "프로브 무응답", probe); continue; }
    }
    plan[id] = true;
  }
  return plan;
}

function skip(plan, id, bin, why, probe) {
  plan.skipped.push(id);
  if (!probe) return;
  plan.reasons = plan.reasons ?? [];
  plan.reasons.push({ id, bin, why });
}

// ocr delegate 는 인자가 없으면 **워크스페이스(미커밋) 모드**로 떨어진다.
// 커밋된 브랜치 변경을 리뷰하려면 범위를 넘겨야 한다.
// 세 사이클 동안 이것을 도구 한계로 오인해 "OCR 은 커밋된 diff 를 못 본다"고 기록했다 — 호출 오류였다.
export function ocrDelegateArgs(base) {
  const b = String(base ?? "").trim();
  return b ? ["--from", b, "--to", "HEAD"] : [];
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

// 수정 루프 상한 (superpowers SDD fix loop 이식).
// completedRound: 방금 끝난 fix 라운드 번호 (초기 리뷰 직후면 0). openBlocking: 남은 CRITICAL/HIGH 수.
// R1-3 resume (같은 맥락 이어서) → R4-5 escalate (fresh + 상위 모델) → 그 이후 breaker (사용자 판정).
// Minor는 루프에 진입하지 않는다 (SKILL이 ledger에 기록).
export const MAX_FIX_ROUNDS = 5;
export function fixLoopStep(completedRound, openBlocking) {
  if (!openBlocking) return { action: "done" };
  const next = completedRound + 1;
  if (next <= 3) return { action: "resume", round: next };
  if (next <= MAX_FIX_ROUNDS) return { action: "escalate", round: next };
  return { action: "breaker" };
}

// 심각도별 액션: CRITICAL/HIGH는 수정 루프 진입, MEDIUM 이하는 연기+ledger, unknown은 defer 기본값.
export function severityAction(severity) {
  const s = String(severity ?? "").toUpperCase();
  if (s === "CRITICAL") return "fix-now";
  if (s === "HIGH") return "must-resolve";
  return "defer-ledger";
}

if (process.argv[1] && /review\.mjs$/.test(process.argv[1])) {
  const cfg = loadConfig();
  process.stdout.write(JSON.stringify({ mode: cfg.secondOpinion, plan: planRunners(cfg.secondOpinion) }) + "\n");
}
