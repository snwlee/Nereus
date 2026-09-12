// 리뷰 실행기: OCR delegation + 2차 의견(codex/gemini)을 설정대로 돌리고 findings를 병합한다.
// 실제 CLI 호출은 SKILL이 주도하고, 이 스크립트는 계획·파싱·병합·게이트를 담당한다.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { which, run } from "../../../hooks/scripts/lib/exec.mjs";
import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";

const ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const norm = (s) => { const u = String(s ?? "INFO").toUpperCase(); return ORDER.includes(u) ? u : u === "ERROR" ? "HIGH" : u === "WARNING" ? "MEDIUM" : "INFO"; };

// image 스킬이 들고 있는 Gemini 웹세션 CLI. 리뷰·디자인·이미지가 같은 채널을 공유한다.
// fileURLToPath 를 거친다. URL.pathname 은 Windows 에서 "/C:/..." 를 내놓아 경로가 깨진다
// (메인 개발 환경이 Windows 다). — gemini 웹세션 리뷰 [MEDIUM], 2026-09-12
export const GEMINI_CLI = path.resolve(fileURLToPath(new URL("../../image/scripts/gemini_cli.py", import.meta.url)));

// 리뷰어 정의.
// gemini 2차 의견은 **Gemini 웹세션**(python3 + gemini_cli.py)으로 받는다.
// 2026-09-12 실측: agy(Antigravity CLI)는 할당량 소진(~2026-09-16 리셋), 웹세션은 11,504/12,096 크레딧.
// agy 는 버리지 않고 배열 형식(["ocr","agy"])으로 직접 고를 수 있는 별도 리뷰어로 남긴다.
export const REVIEWERS = {
  ocr: { bin: "ocr", label: "Open Code Review" },
  codex: { bin: "codex", label: "Codex" },
  gemini: { bin: "python3", label: "Gemini (웹세션)", script: GEMINI_CLI },
  agy: { bin: "agy", label: "Gemini (Antigravity)" },
};

/** 웹세션 리뷰 호출 인자. diff 는 argv 길이 제한에 걸리므로 반드시 파일로 넘긴다. */
export function geminiWebArgs(promptFile) {
  return [GEMINI_CLI, "ask", "--prompt-file", String(promptFile)];
}

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

// ── 프로브 실체 ─────────────────────────────────────────────────────────────
// 2026-09-12 조사: 두 CLI 의 실패 양상은 서로 다르고, 둘 다 "도구 결함"이 아니었다.
//  - codex: 신뢰되지 않은 cwd 에서 부르면 stderr 로 거부하고 끝난다. 저장소 안에서는 13초에 응답한다.
//           세 사이클 동안 "무응답"으로 기록한 것은 프로브를 /tmp 에서 돌린 호출 오류였다.
//  - agy  : 기본 text 출력에서는 429 재시도 7회가 전부 삼켜져 "빈 출력 + exit 0" 으로만 보인다.
//           --output-format json 으로 받아야 RESOURCE_EXHAUSTED 가 드러난다.
// 그래서 프로브는 "실행 여부"가 아니라 **응답 본문**으로 판정한다.
const PROBE_PROMPT = "Reply with exactly: PONG";
// 키는 **바이너리 이름**이다(리뷰어 id 가 아니다). python3 항목은 gemini 웹세션 전용이다 —
// 스크립트 경로가 인자 0번에 박혀 있어 어느 채널인지 인자만 봐도 드러난다.
const PROBE_ARGS = {
  codex: ["exec", "--sandbox", "read-only", "--skip-git-repo-check", PROBE_PROMPT],
  agy: ["-p", PROBE_PROMPT, "--output-format", "json", "--print-timeout", "60s"],
  python3: [GEMINI_CLI, "ask", "--prompt", PROBE_PROMPT],
};

/** 프로브 인자. 프로브 대상이 아닌 바이너리는 빈 배열이다. */
export function probeArgs(bin) {
  return PROBE_ARGS[bin] ? [...PROBE_ARGS[bin]] : [];
}

/** 실행 결과를 {ok, why} 로 읽는다. 순수 함수 — 실행은 하지 않는다. */
export function readProbe(bin, result) {
  const stdout = String(result?.stdout ?? "");
  const stderr = String(result?.stderr ?? "");
  if (bin === "codex") {
    if (/not inside a trusted directory/i.test(stderr + stdout)) {
      return { ok: false, why: "신뢰되지 않은 디렉터리에서 호출됨 — 저장소 루트에서 실행해야 한다" };
    }
    if (!result?.ok) return { ok: false, why: stderr.trim() || `종료 코드 ${result?.status}` };
    return stdout.trim() ? { ok: true } : { ok: false, why: "빈 응답" };
  }
  if (bin === "python3") {
    // 웹세션 CLI 는 loguru 로그·쿠키 안내를 전부 stderr 로 내보내고 답변만 stdout 에 찍는다.
    // 그래서 판정은 stdout 본문으로 하고, 사유는 stderr 에서 읽는다.
    const quota = matchQuota(stdout + stderr);
    if (quota) return { ok: false, why: `할당량 소진 — ${quota}` };
    if (/cookie file missing|__Secure-1PSID missing|App-Bound Encryption/i.test(stderr + stdout)) {
      return { ok: false, why: "Gemini 웹세션이 없다 — 쿠키를 넣어야 한다(/nereus:setup, cookies-import.mjs)" };
    }
    if (!result?.ok) return { ok: false, why: stderr.trim().split("\n").slice(-1)[0] || `종료 코드 ${result?.status}` };
    return stdout.trim() ? { ok: true } : { ok: false, why: "빈 응답" };
  }
  if (bin === "agy") {
    // 할당량 판정은 종료 코드보다 먼저다 — agy 는 429 를 내고도 exit 0 을 낸다.
    const quota = matchQuota(stdout + stderr);
    if (quota) return { ok: false, why: `할당량 소진 — ${quota}` };
    const j = agyJson(stdout);
    const err = String(j?.error ?? "").trim();
    if (err) return { ok: false, why: err };
    if (!result?.ok) return { ok: false, why: stderr.trim() || stdout.trim() || `종료 코드 ${result?.status}` };
    // json 을 요구해 놓고 받았으므로, 파싱되지 않는 stdout 은 응답이 아니다.
    if (!j) return { ok: false, why: stdout.trim() ? "json 이 아닌 응답" : "빈 응답 (text 출력이면 오류가 삼켜진다 — json 으로 받는다)" };
    if (String(j.status ?? "").toUpperCase() === "ERROR") return { ok: false, why: "리뷰어가 ERROR 로 끝났다" };
    return String(j.response ?? "").trim() ? { ok: true } : { ok: false, why: "빈 응답" };
  }
  return { ok: true };
}

function matchQuota(text) {
  if (!/RESOURCE_EXHAUSTED|\b429\b|quota reached/i.test(text)) return null;
  const reset = text.match(/Resets in ([0-9hms]+)/i);
  return reset ? `할당량이 ${reset[1]} 뒤에 리셋된다` : "할당량이 리셋될 때까지 쓸 수 없다";
}

function agyJson(stdout) {
  for (const line of stdout.split("\n").map((l) => l.trim()).filter(Boolean).reverse()) {
    try {
      const j = JSON.parse(line);
      if (j && typeof j === "object") return j.result ?? j;
    } catch { /* NDJSON 중간 줄은 건너뛴다 */ }
  }
  return null;
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
  process.stdout.write(JSON.stringify({ mode: cfg.secondOpinion, plan: planRunners(cfg.secondOpinion, undefined, makeProbe()) }) + "\n");
}
