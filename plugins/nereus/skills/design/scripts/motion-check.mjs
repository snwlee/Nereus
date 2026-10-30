// 모션 정적 검사. Gemini 는 정지 스크린샷만 본다 — `transition: all`, `scale(0)` 등장, `ease-in` 진입,
// 레이아웃 속성 애니메이션, reduced-motion 누락은 화면으로는 안 보인다. diff 의 추가 줄에서 결정적으로 잡는다.
//
// 권고다. design 게이트를 막지 않는다 — 취향으로 사람을 막지 않는다는 원칙(design-feedback.mjs BLOCKING_AXES).
// 규칙 근거: Emil Kowalski 의 공개 애니메이션 원칙(github.com/emilkowalski/skills, MIT — 코드 차용 없음),
// 사용자 전역 규칙 web/coding-style "compositor 속성만 애니메이션".
//
// 사용: node motion-check.mjs [--base main] [--strict]
import { spawnSync } from "node:child_process";
import { collectDiff } from "./design-feedback.mjs";

export const MOTION_RULES = Object.freeze({
  "transition-all": "`transition: all` — 바뀌는 속성을 명시한다(`transition: transform 200ms, opacity 200ms`). all 은 색·레이아웃까지 끌고 간다",
  "layout-prop": "width·height·top·left·margin·padding 전환 — 레이아웃을 다시 계산한다. transform·opacity 로 바꾼다",
  "scale-zero": "`scale(0)` 에서 등장 — 현실에서 무(無)에서 나타나는 것은 없다. `scale(0.95)` + `opacity: 0` 에서 시작한다",
  "ease-in": "`ease-in` — 진입·반응에 쓰면 굼뜨게 느껴진다. 들어오는 것은 `ease-out`(또는 커스텀 곡선)",
  "long-duration": "500ms 초과 — UI 반응은 150–300ms 가 기본이다. 긴 모션이 필요한 이유가 없으면 줄인다",
  "no-reduced-motion": "모션을 추가했는데 reduced-motion 처리가 없다 — `@media (prefers-reduced-motion: reduce)` 또는 `motion-reduce:` 를 둔다",
});

const TARGET_EXT = /\.(css|scss|sass|less|tsx|jsx|vue|svelte|astro|html)$/i;
const MAX_UI_MS = 500;
const LAYOUT = "(width|height|top|left|right|bottom|margin|padding)";
const CLASS = (name) => new RegExp(`(^|[\\s"'\`{])${name}(?=[\\s"'\`}]|$)`);

const TESTS = [
  ["transition-all", (l) => /transition\s*:\s*all\b/i.test(l) || CLASS("transition-all").test(l)],
  ["layout-prop", (l) => new RegExp(`transition(-property)?\\s*:[^;]*\\b${LAYOUT}\\b`, "i").test(l) || new RegExp(`transition-\\[[^\\]]*\\b${LAYOUT}\\b`).test(l)],
  ["scale-zero", (l) => /scale[XY]?\(\s*0(\.0+)?\s*[,)]/.test(l) || CLASS("scale-0").test(l)],
  ["ease-in", (l) => /\bease-in\b(?!-out)/.test(l)],
  ["long-duration", (l) => longDuration(l)],
];

const MOTION = /\btransition\b|\banimation\b|@keyframes|(^|[\s"'`])animate-/;
const REDUCE = /prefers-reduced-motion|motion-reduce:|motion-safe:|useReducedMotion/;

function longDuration(line) {
  if (!/transition|animation|duration/i.test(line)) return false;
  const ms = [...line.matchAll(/(\d+(?:\.\d+)?)ms\b/g)].some((m) => Number(m[1]) > MAX_UI_MS);
  const sec = [...line.matchAll(/(?<![\w.-])(\d*\.?\d+)s\b/g)].some((m) => Number(m[1]) * 1000 > MAX_UI_MS);
  const tw = [...line.matchAll(/(?:^|[\s"'`])duration-(\d+)(?=[\s"'`]|$)/g)].some((m) => Number(m[1]) > MAX_UI_MS);
  return ms || sec || tw;
}

/** unified diff → 파일별 { file, added: [{line, text}], context: [text] }. 새 파일 기준 줄 번호. */
function parseDiff(diff) {
  const files = [];
  let cur = null;
  let n = 1;
  for (const raw of String(diff ?? "").split("\n")) {
    const file = raw.match(/^\+\+\+ b\/(.+)$/);
    if (file) { cur = { file: file[1], added: [], context: [] }; files.push(cur); n = 1; continue; }
    if (!cur || raw.startsWith("--- ") || raw.startsWith("diff --git")) continue;
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) { n = Number(hunk[1]); continue; }
    if (raw.startsWith("+")) { cur.added.push({ line: n, text: raw.slice(1) }); n += 1; continue; }
    if (raw.startsWith(" ")) { cur.context.push(raw.slice(1)); n += 1; }
  }
  return files;
}

// 전역 처리(globals.css 의 `@media (prefers-reduced-motion)`)가 있으면 파일마다 묻지 않는다 — 그런 저장소에서는 전부 오탐이다.
export function checkMotion(diff, { reducedMotionHandled = false } = {}) {
  return parseDiff(diff)
    .filter((f) => TARGET_EXT.test(f.file))
    .flatMap(({ file, added, context }) => {
      const hits = added.flatMap(({ line, text }) =>
        TESTS.filter(([, test]) => test(text)).map(([rule]) => ({ file, line, rule, message: MOTION_RULES[rule] })));
      const firstMotion = added.find(({ text }) => MOTION.test(text));
      const handled = [...added.map((a) => a.text), ...context].some((t) => REDUCE.test(t));
      const reduce = firstMotion && !handled && !reducedMotionHandled
        ? [{ file, line: firstMotion.line, rule: "no-reduced-motion", message: MOTION_RULES["no-reduced-motion"] }]
        : [];
      return [...hits, ...reduce];
    });
}

export function motionReport(findings) {
  const lines = ["## 모션 검사 (권고)", ""];
  if (!findings.length) return [...lines, "- 모션 지적 없음"].join("\n");
  for (const rule of Object.keys(MOTION_RULES)) {
    const hits = findings.filter((f) => f.rule === rule);
    if (!hits.length) continue;
    lines.push(`### ${rule} — ${MOTION_RULES[rule]}`, ...hits.map((f) => `- ${f.file}:${f.line}`), "");
  }
  lines.push("권고다 — 반영하거나, 의도한 것이면 이유를 남긴다. 사람이 직접 보려면 `/review-animations`(Emil Kowalski 스킬).");
  return lines.join("\n");
}

if (process.argv[1] && /motion-check\.mjs$/.test(process.argv[1])) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--base");
  const base = i > -1 ? argv[i + 1] : null;
  // 추적 중인 파일 어딘가에 reduced-motion 처리가 있으면 저장소 전역 처리로 본다.
  // 스타일·마크업 파일만 본다 — README 에 적힌 "prefers-reduced-motion" 은 처리가 아니다.
  const specs = ["css", "scss", "sass", "less", "tsx", "jsx", "ts", "js", "vue", "svelte", "astro", "html"].map((e) => `*.${e}`);
  const grep = spawnSync("git", ["grep", "-q", "-E", REDUCE.source, "--", ...specs], { cwd: process.cwd() });
  const findings = checkMotion(collectDiff(process.cwd(), base), { reducedMotionHandled: grep.status === 0 });
  process.stdout.write(`${motionReport(findings)}\n`);
  process.exit(argv.includes("--strict") && findings.length ? 1 : 0);
}
