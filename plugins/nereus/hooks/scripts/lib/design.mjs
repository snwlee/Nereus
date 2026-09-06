// 디자인 피드백 게이트. "디자인 표면을 만졌으면 Gemini 비평을 받았다"는 증거를 요구한다.
// evidence.mjs 와 같은 모양이지만 무결성 판정을 파일 단위로 한다 — 백엔드 수정이 디자인 비평을 무효화하면 안 되기 때문.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { projectStateDir } from "./paths.mjs";
import { globToRegExp } from "../tdd-guard.mjs";

const MAX_ROUNDS = 20; // 파일이 무한히 커지지 않도록 최근 라운드만 남긴다

const STYLESHEET = /\.(css|scss|sass|less|styl|pcss)$/i;
const SURFACE = /\.(html|htm|vue|svelte|astro|tsx|jsx|dart)$/i;
const TOKENS = /(tailwind\.config\.[a-z]+$|(^|\/)(theme|tokens|design-system|palette|typography)[.\-/])/i;
const TEST_FILE = /(^|\/)(test|tests|__tests__|spec)\/|(_test|Test|Tests|\.test|\.spec)\.[a-z]+$/;
const SKIP_DIR = /(^|\/)(node_modules|vendor|dist|build|\.next|coverage|generated)\//;
const DOC_EXT = /\.(md|mdx|txt|rst|adoc)$/i;

// 시각적 결정이 담긴 라인. 로직만 바뀐 컴포넌트 편집을 디자인 작업으로 오탐하지 않기 위한 필터.
const VISUAL_SIGNAL = new RegExp([
  "class(Name)?\\s*=", "style\\s*=", "styled\\.", "css`", "tw`", "@apply", "sx\\s*=",
  "<(div|section|header|footer|main|nav|aside|article|button|h[1-6]|span|ul|li|img|svg|form|input|label|table)\\b",
  ":root", "--[a-z][a-z0-9-]*\\s*:", "@media", "@keyframes", "keyframes",
  "(grid-template|flex-direction|font-size|font-family|line-height|letter-spacing|padding|margin|border-radius|box-shadow|background|opacity|transform|transition|z-index|gap)\\s*:",
  "(TextStyle|BoxDecoration|EdgeInsets|BorderRadius|ThemeData|TextTheme|ColorScheme|Color\\(0x)",
].join("|"), "i");

/** diff 를 파싱하되 "새 파일인가"까지 판정한다. 미추적 파일의 가짜 diff(--- 헤더 없음)도 신규로 본다. */
export function parseDesignDiff(text) {
  const files = [];
  let cur = null;
  for (const line of String(text ?? "").split("\n")) {
    const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (m) { cur = { file: m[2], added: [], removed: [], created: false, _sawMinus: false }; files.push(cur); continue; }
    if (!cur) continue;
    if (/^new file mode/.test(line)) { cur.created = true; continue; }
    if (line.startsWith("--- ")) { cur._sawMinus = true; if (line.includes("/dev/null")) cur.created = true; continue; }
    if (line.startsWith("+++")) continue;
    if (line.startsWith("+")) cur.added.push(line.slice(1));
    else if (line.startsWith("-")) cur.removed.push(line.slice(1));
  }
  return files.map(({ _sawMinus, ...f }) => ({ ...f, created: f.created || !_sawMinus }));
}

/** diff 에서 디자인 표면 변경만 골라낸다. 스타일시트는 무조건, 컴포넌트는 시각 신호가 있을 때만. */
export function designTouched(diff, { exclude = [] } = {}) {
  const res = exclude.map(globToRegExp);
  const out = [];
  for (const f of parseDesignDiff(diff)) {
    if (TEST_FILE.test(f.file) || SKIP_DIR.test(f.file) || DOC_EXT.test(f.file)) continue;
    if (res.some((re) => re.test(f.file))) continue;
    const why = STYLESHEET.test(f.file) ? "stylesheet"
      : TOKENS.test(f.file) ? "design-tokens"
      : SURFACE.test(f.file) && f.added.some((l) => VISUAL_SIGNAL.test(l)) ? "visual-markup"
      : null;
    if (why) out.push({ file: f.file, why, created: f.created });
  }
  return out;
}

export function fileHashes(cwd, files, readFile = (p) => fs.readFileSync(p, "utf8")) {
  const out = {};
  for (const f of files) {
    let body = null;
    try { body = readFile(path.join(cwd, f)); } catch { body = null; }
    out[f] = body === null ? "" : createHash("sha256").update(body).digest("hex").slice(0, 16);
  }
  return out;
}

const roundsFile = (cwd) => path.join(projectStateDir(cwd), "design-feedback.json");

export function readRounds(cwd, deps = {}) {
  const readFile = deps.readFile ?? ((p) => fs.readFileSync(p, "utf8"));
  try {
    const j = JSON.parse(readFile(roundsFile(cwd)));
    return Array.isArray(j.rounds) ? j.rounds : [];
  } catch { return []; }
}

export function recordRound(cwd, { phase, source, verdict, files = {}, notes = "" }, deps = {}) {
  const writeFile = deps.writeFile ?? ((p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); });
  const rec = { phase, source, verdict, files, notes, at: deps.now ?? Date.now() };
  const rounds = [...readRounds(cwd, deps), rec].slice(-MAX_ROUNDS);
  writeFile(roundsFile(cwd), JSON.stringify({ rounds }, null, 2));
  return rec;
}

/**
 * 디자인 게이트. touched 의 각 파일은 현재 해시를 덮는 visual 라운드가 verdict OK 여야 한다.
 * 신규 디자인 파일이 있으면 방향(direction) 라운드도 최소 1건 요구한다.
 */
export function designGate({ touched = [], hashes = {}, created = [], rounds = [], enforce = "block" } = {}) {
  const findings = [];
  if (touched.length) {
    const visual = rounds.filter((r) => r.phase === "visual");
    for (const t of touched) {
      const hash = hashes[t.file] ?? "";
      const covering = [...visual].reverse().find((r) => r.files?.[t.file] === hash);
      if (covering) {
        if (covering.verdict !== "OK") {
          findings.push({ category: "design_feedback_unaddressed", file: t.file, message: `Gemini 가 REVISE 로 판정했고 그 뒤 이 파일이 바뀌지 않았습니다 — ${String(covering.notes || "").slice(0, 200) || "지적 사항 미반영"}` });
        }
        continue;
      }
      const anyRound = visual.some((r) => t.file in (r.files ?? {}));
      findings.push(anyRound
        ? { category: "design_feedback_stale", file: t.file, message: "비평 이후 파일이 바뀌었습니다 — 렌더 결과로 다시 비평받으세요 (design-feedback.mjs visual)" }
        : { category: "design_feedback_missing", file: t.file, message: `디자인 표면 변경(${t.why})에 Gemini 미감 피드백이 없습니다 (design-feedback.mjs visual)` });
    }
    if (created.length && !rounds.some((r) => r.phase === "direction")) {
      findings.push({ category: "design_direction_missing", file: created[0], message: `신규 디자인 파일 ${created.length}건 — 방향을 코드 이전에 비평받은 기록이 없습니다 (design-feedback.mjs direction)` });
    }
  }
  return { pass: enforce === "block" ? findings.length === 0 : true, findings, enforce };
}
