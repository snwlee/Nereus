// 리뷰 실행기: OCR delegation + 2차 의견(EGM 기본, codex 는 명시할 때만)을 설정대로 계획하고 findings를 병합한다.
// 실제 CLI 호출은 SKILL이 주도하고, 이 스크립트는 계획·파싱·병합·게이트를 담당한다.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { which, run } from "../../../hooks/scripts/lib/exec.mjs";
import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";

const ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const norm = (s) => { const u = String(s ?? "INFO").toUpperCase(); return ORDER.includes(u) ? u : u === "ERROR" ? "HIGH" : u === "WARNING" ? "MEDIUM" : "INFO"; };

// 2차 의견(제3자 검증)은 EGM 이 기본이다 — 대화 맥락 없는 Goldfish 서브에이전트가 diff 와 스펙만 읽고 리뷰한다.
// 2026-11-12 사용자 방침: "EGM 1순위, 그것만으로 충분". Gemini 는 이 플러그인에서 무료 이미지 생성(nereus:image)에만 쓴다.
// 이전 리뷰어 gemini(웹세션)·agy(Antigravity)는 쿠키·할당량 실패가 상시였고(2026-09-12 실측) 이제 정의가 없다.
// codex 는 다른 모델의 시각이 필요할 때 secondOpinion: "codex" 로 명시해 켠다.
export const REVIEWERS = {
  ocr: { bin: "ocr", label: "Open Code Review" },
  egm: { bin: null, label: "EGM (새 맥락 서브에이전트)" },
  codex: { bin: "codex", label: "Codex" },
};

/** EGM 리뷰어가 읽을 goldfish 페르소나. 서브에이전트 프롬프트에 경로만 넘긴다(대화 맥락은 넘기지 않는다). */
const PERSONA_DIR = path.resolve(fileURLToPath(new URL("../../goldfish/personas/", import.meta.url)));
export const EGM_PERSONAS = Object.freeze(["codebase_details.md", "design_critic.md"].map((f) => path.join(PERSONA_DIR, f)));

const SHORTHAND = {
  egm: ["ocr", "egm"],
  codex: ["ocr", "egm", "codex"],
  // 이전 기본값. 직접 적은 사용자는 Codex 를 고른 것이라 말없이 빼지 않고 EGM 뒤(후순위)에 둔다.
  both: ["ocr", "egm", "codex"],
  none: ["ocr"], // 2차 의견 없이 결정론적 리뷰만
};

// 이전 2차 의견 리뷰어는 EGM 으로 바뀌었다. 배열 설정에 남아 있으면 걸러내지 않고 EGM 으로 읽는다 —
// 걸러내면 ["ocr","gemini"] 사용자의 2차 의견이 조용히 사라진다(2026-11-12 실측).
const RETIRED = { gemini: "egm", agy: "egm" };

/**
 * 설정값을 리뷰어 id 배열로 편다. 이전 값(gemini)과 모르는 값은 기본(egm)으로 읽는다 — 사용자 설정을 깨지 않는다.
 * 빈 배열만 의도적인 "리뷰 끄기"다. 모르는 이름뿐인 배열(오타)은 기본으로 읽는다 — 조용히 리뷰를 끄지 않는다.
 */
export function normalizeReviewers(value) {
  if (Array.isArray(value)) {
    if (!value.length) return [];
    const ids = [...new Set(value.map((v) => RETIRED[v] ?? v).filter((v) => v in REVIEWERS))];
    return ids.length ? ids : SHORTHAND.egm;
  }
  if (typeof value === "string" && value in SHORTHAND) return SHORTHAND[value];
  return SHORTHAND.egm;
}

// "PATH 에 있음"과 "쓸 수 있음"은 다르다. agy 는 PATH 에 있으면서 무응답 후 exit 0 을 내고,
// ocr delegate 는 커밋된 diff 를 못 본다. 존재만으로 가용을 단정하면 계획은 초록인데
// 실제로는 아무도 리뷰하지 않는 상태가 된다 — 두 사이클 연속 그렇게 종결했다.
// probe 를 주지 않으면 기존 동작 그대로다(기존 호출부 호환).
export function planRunners(value, available = (b) => !!which(b), probe = null) {
  const want = normalizeReviewers(value);
  const plan = { ocr: false, egm: false, codex: false, skipped: [] };
  for (const id of Object.keys(REVIEWERS)) {
    if (!want.includes(id)) continue;
    const bin = REVIEWERS[id].bin;
    // EGM 은 바이너리가 아니라 이 세션이 띄우는 서브에이전트다. PATH·프로브 대상이 아니다.
    if (bin === null) { plan[id] = true; continue; }
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

// ── 프로브 실체 ─────────────────────────────────────────────────────────────
// codex 는 신뢰되지 않은 cwd 에서 부르면 stderr 로 거부하고 끝난다. 저장소 안에서는 13초에 응답한다(2026-09-12).
// 그래서 프로브는 "실행 여부"가 아니라 **응답 본문**으로 판정한다.
const PROBE_PROMPT = "Reply with exactly: PONG";
const PROBE_ARGS = {
  codex: ["exec", "--sandbox", "read-only", "--skip-git-repo-check", PROBE_PROMPT],
};

/** 프로브 인자. 프로브 대상이 아닌 바이너리는 빈 배열이다. */
export function probeArgs(bin) {
  return PROBE_ARGS[bin] ? [...PROBE_ARGS[bin]] : [];
}

/** 실행 결과를 {ok, why} 로 읽는다. 순수 함수 — 실행은 하지 않는다. */
export function readProbe(bin, result) {
  const stdout = String(result?.stdout ?? "");
  const stderr = String(result?.stderr ?? "");
  if (bin !== "codex") return { ok: true };
  if (/not inside a trusted directory/i.test(stderr + stdout)) {
    return { ok: false, why: "신뢰되지 않은 디렉터리에서 호출됨 — 저장소 루트에서 실행해야 한다" };
  }
  if (!result?.ok) return { ok: false, why: stderr.trim() || `종료 코드 ${result?.status}` };
  return stdout.trim() ? { ok: true } : { ok: false, why: "빈 응답" };
}

/** 러너를 주입해 프로브 함수를 만든다. 기본 러너는 저장소 루트에서, stdin 을 닫고 돈다. */
export function makeProbe(runner = defaultRunner) {
  return (bin) => {
    if (!probeArgs(bin).length) return { ok: true };
    try {
      return readProbe(bin, runner(bin, probeArgs(bin)));
    } catch (e) {
      return { ok: false, why: `프로브 실행 실패: ${e?.message ?? e}` };
    }
  };
}

// stdin 을 비워 주지 않으면 codex 가 파이프 입력을 기다린다 (이전 사이클의 "백그라운드에서 죽음"의 정체).
function defaultRunner(bin, args) {
  return run(bin, args, { cwd: process.cwd(), input: "", timeoutMs: 120000 });
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
  const plan = planRunners(cfg.secondOpinion, undefined, makeProbe());
  process.stdout.write(JSON.stringify({ mode: cfg.secondOpinion, plan, ...(plan.egm ? { egmPersonas: EGM_PERSONAS } : {}) }) + "\n");
}
