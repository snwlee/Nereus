// Goldfish 리뷰의 결정론 부분. 리뷰 자체(서브에이전트)는 SKILL.md 절차가 하고, 여기는 판단이 필요 없는 일만 한다:
// 대상 해석 → 기능/구현 범위 분할 → 리뷰어 맥락 링크 수집 → 보고서 파싱 → 라운드 수렴 판정.
// 출처: google/elephant-goldfish-model (Apache-2.0) skills/egm-review·egm-review-loop 의 규칙을 코드로 옮겼다.
// 사용: node goldfish.mjs plan <대상> [--mode full|feature|implementation] [--size small|medium|large]
//       node goldfish.mjs parse <보고서.md>
//       node goldfish.mjs judge <원장.json> <보고서.md> [--not-run a,b]
//       node goldfish.mjs settle <원장.json> [--settle 키]... [--fixed 키]...
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { modelsFor, resolveSize } from "../../spec/scripts/model-tiers.mjs";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PERSONAS = path.join(SKILL_DIR, "personas");
const STANDARDS = path.join(SKILL_DIR, "standards");

export const MAX_ROUNDS = 5;
const CLEAN_ROUNDS_TO_CONVERGE = 2;

const BOUNDARY_RE = /^##\s+(detailed implementation plan|implementation plan|work breakdown|implementation steps|tasks|상세 구현 계획|구현 계획|태스크|작업 분해)\s*$/i;

const PERSONA_FILES = Object.freeze({
  "egm-zoom-out": "zoom_out.md",
  "egm-inventive-catalyst": "inventive_catalyst.md",
  "egm-comprehension": "comprehension.md",
  "egm-design": "design_critic.md",
  "egm-structural": "structural.md",
  "egm-style": "style.md",
  "egm-implementation-readiness": "implementation_readiness.md",
  "egm-codebase-details": "codebase_details.md",
});

const r = (name, standard = null) => ({ name, standard });

// 단계 번호는 원본(egm-review)의 5~9 를 그대로 쓴다 — 원본 문서와 대조할 때 번호가 같아야 한다.
const STAGES = Object.freeze([
  { n: 5, name: "Initial Zoom Out", scope: "full", context: true, direct: false, report: "zoom_out_report.md",
    reviewers: [r("egm-zoom-out", "zoom-out-standard"), r("egm-inventive-catalyst")] },
  { n: 6, name: "Comprehension Test", scope: "feature+detailed", context: false, direct: true, report: "comprehension_report.md",
    reviewers: [r("egm-comprehension")] },
  { n: 7, name: "Critic Review", scope: "feature", context: true, direct: false, report: "critic_report.md", loop: true,
    reviewers: [r("egm-design", "feature-spec-standard"), r("egm-structural", "feature-spec-standard"), r("egm-style")] },
  { n: 8, name: "Intermediate Zoom Out", scope: "full", context: true, direct: false, report: "intermediate_zoom_out_report.md",
    reviewers: [r("egm-zoom-out", "zoom-out-standard")] },
  { n: 9, name: "Implementation Readiness", scope: "detailed", context: true, direct: false, report: "implementation_readiness_report.md", loop: true,
    reviewers: [r("egm-implementation-readiness", "implementation-readiness-standard"), r("egm-codebase-details", "implementation-readiness-standard"), r("egm-style")] },
]);

const MODES = Object.freeze({ full: [5, 6, 7, 8, 9], feature: [5, 6, 7, 8], implementation: [9] });

export function stagesFor(mode) {
  const ns = MODES[mode];
  if (!ns) throw new Error(`모르는 모드: ${mode} (full|feature|implementation)`);
  return STAGES.filter((s) => ns.includes(s.n));
}

export function findSplit(text) {
  const lines = String(text).split("\n");
  const hits = [];
  let fenced = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return; }
    if (!fenced && BOUNDARY_RE.test(line.trim())) hits.push(i + 1);
  });
  const end = lines.length;
  if (!hits.length) return { feature: [1, end], detailed: null, boundary: null, ambiguous: false };
  const b = hits[0];
  return { feature: [1, b - 1], detailed: [b, end], boundary: b, ambiguous: hits.length > 1 };
}

const walkSpecs = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walkSpecs(p);
      return e.name === "spec.md" ? [p] : [];
    });
};

const whole = (file) => ({ file, lines: null });
const existing = (dir, names) => names.map((n) => path.join(dir, n)).filter((p) => fs.existsSync(p));

export function resolveTarget(target, cwd = process.cwd()) {
  const abs = path.resolve(cwd, target);
  if (!fs.existsSync(abs)) throw new Error(`대상이 없다: ${target}`);
  if (fs.statSync(abs).isFile()) {
    const split = findSplit(fs.readFileSync(abs, "utf8"));
    return {
      kind: "file",
      feature: [{ file: abs, lines: split.feature }],
      detailed: split.detailed ? [{ file: abs, lines: split.detailed }] : [],
      ambiguous: split.ambiguous,
    };
  }
  if (fs.existsSync(path.join(abs, "proposal.md"))) {
    return {
      kind: "openspec",
      feature: [...existing(abs, ["proposal.md", "design.md"]), ...walkSpecs(path.join(abs, "specs"))].map(whole),
      detailed: existing(abs, ["tasks.md"]).map(whole),
      ambiguous: false,
    };
  }
  if (fs.existsSync(path.join(abs, "spec.md"))) {
    return {
      kind: "spec-kit",
      feature: existing(abs, ["spec.md", "plan.md"]).map(whole),
      detailed: existing(abs, ["tasks.md"]).map(whole),
      ambiguous: false,
    };
  }
  throw new Error(`리뷰할 문서가 없다(proposal.md·spec.md 없음): ${target}`);
}

const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

const isInside = (root, p) => {
  const rel = path.relative(root, p);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

export function collectLinks(docPath, text, cwd = process.cwd()) {
  const root = fs.realpathSync(cwd);
  const out = { inside: new Set(), outside: new Set(), urls: new Set(), missing: new Set() };
  for (const m of String(text).matchAll(LINK_RE)) {
    const raw = m[1];
    if (raw.startsWith("#")) continue;
    if (SCHEME_RE.test(raw)) { out.urls.add(raw); continue; }
    const rel = raw.split("#")[0];
    const lexical = path.resolve(path.dirname(docPath), rel);
    if (!isInside(root, lexical)) { out.outside.add(raw); continue; }
    if (!fs.existsSync(lexical)) { out.missing.add(rel); continue; }
    const real = fs.realpathSync(lexical);
    if (!isInside(root, real)) { out.outside.add(raw); continue; }
    out.inside.add(real);
  }
  return { inside: [...out.inside], outside: [...out.outside], urls: [...out.urls], missing: [...out.missing] };
}

const mergeLinks = (parts) => {
  const keys = ["inside", "outside", "urls", "missing"];
  return Object.fromEntries(keys.map((k) => [k, [...new Set(parts.flatMap((p) => p[k]))]]));
};

const reviewerPaths = (rv) => ({
  name: rv.name,
  persona: path.join(PERSONAS, PERSONA_FILES[rv.name]),
  standard: rv.standard ? path.join(STANDARDS, `${rv.standard}.md`) : null,
});

export function planReview(target, { cwd = process.cwd(), mode = "full", size } = {}) {
  const sz = resolveSize(size);
  const t = resolveTarget(target, cwd);
  const notes = [];
  let effective = mode;
  if (!t.detailed.length && mode !== "feature") {
    if (mode === "implementation") throw new Error("구현 범위(Detailed)가 없어 implementation 모드를 돌릴 수 없다");
    effective = "feature";
    notes.push("구현 범위(Detailed)가 없어 full 을 feature 로 낮췄다 — 9단계(Implementation Readiness)를 건너뛴다");
  }
  if (t.ambiguous) notes.push("구현 계획 헤더가 여럿이다 — 첫 헤더로 나눴다. 경계가 틀렸으면 문서를 고친 뒤 다시 돌린다");
  const files = [...new Set([...t.feature, ...t.detailed].map((x) => x.file))];
  const context = mergeLinks(files.map((f) => collectLinks(f, fs.readFileSync(f, "utf8"), cwd)));
  if (context.outside.length || context.urls.length) {
    notes.push("작업 디렉터리 밖 링크·URL 은 자동으로 넣지 않는다 — URL 은 파일로 저장해 절대 경로로 넘긴다");
  }
  return {
    target: path.resolve(cwd, target),
    kind: t.kind,
    mode: effective,
    feature: t.feature,
    detailed: t.detailed,
    context,
    synthesizer: path.join(PERSONAS, "synthesizer.md"),
    stages: stagesFor(effective).map((s) => ({ ...s, reviewers: s.reviewers.map(reviewerPaths) })),
    reviewerModel: modelsFor(sz.size).reviewer,
    size: sz.size,
    sizeAssumed: sz.assumed,
    notes,
  };
}

const HEADING_RE = /^###\s+(.+?)\s+-\s+Severity:\s*([A-Za-z]+)/i;
const STATUS_RE = /^\|\s*`?([\w-]+)`?\s*\|\s*(completed|not run)\s*\|/i;
const field = (block, label) => {
  const m = block.match(new RegExp(`\\*\\*${label}:?\\*\\*:?\\s*(.+)`, "i"));
  return m ? m[1].replace(/`/g, "").trim() : "";
};

const findingKey = (scope, title) => `${scope.toLowerCase()}|${title.toLowerCase()}`;

export function parseReport(md) {
  const lines = String(md).split("\n");
  const reviewers = lines.map((l) => l.match(STATUS_RE)).filter(Boolean)
    .map((m) => ({ name: m[1], status: m[2].toLowerCase() }));
  const findings = [];
  const unparsed = [];
  let cur = null;
  let inFindings = false;
  const flush = () => {
    if (!cur) return;
    const scope = field(cur.body, "Affected Scope");
    findings.push({
      title: cur.title, severity: cur.severity, reviewer: field(cur.body, "Reviewer Lens"), scope, key: findingKey(scope, cur.title),
    });
  };
  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m) { flush(); cur = { title: m[1].trim(), severity: m[2].toLowerCase(), body: "" }; continue; }
    if (/^##\s/.test(line)) inFindings = /finding/i.test(line);
    // 발견 절의 ### 제목인데 형식이 어긋났다 — 버리면 발견 0개로 읽혀 clean 으로 통과한다.
    if (inFindings && /^###\s/.test(line)) unparsed.push(line.replace(/^###\s+/, "").trim());
    if (/^#{1,3}\s/.test(line)) { flush(); cur = null; continue; }
    if (cur) cur.body += line + "\n";
  }
  flush();
  return { reviewers, findings, unparsed };
}

const SEVERITY = Object.freeze({ blocker: "CRITICAL", major: "HIGH", nit: "LOW" });
export const toSeverity = (sev) => SEVERITY[String(sev).toLowerCase()] ?? "MEDIUM";

export const emptyLedger = () => ({ round: 0, cleanStreak: 0, settled: [], fixed: [] });

// 막지 않는 심각도만 열거한다. 모르는 값(Critical·High·오타)은 막는 쪽으로 센다 — 반대면 조용히 통과한다.
const NON_BLOCKING = new Set(["nit", "minor", "low"]);

// 원본 egm-review-loop §2.4: 정착(CONTEST·DECLINE·수용 위험)된 발견은 다시 열지 않고,
// 고친 발견이 같은 범위에서 다시 나오면 수정이 실패한 것이므로 다시 연다. 연속 2회 clean 이 수렴이다.
export function judgeRound(ledger, { findings = [], notRun = [], unparsed = 0 } = {}) {
  const settled = new Set(ledger.settled);
  const fixed = new Set(ledger.fixed);
  const blocking = findings.filter((x) => !NON_BLOCKING.has(x.severity) && !settled.has(x.key));
  const reopened = blocking.filter((x) => fixed.has(x.key));
  const clean = blocking.length === 0 && notRun.length === 0 && unparsed === 0;
  const round = ledger.round + 1;
  const cleanStreak = clean ? ledger.cleanStreak + 1 : 0;
  const converged = cleanStreak >= CLEAN_ROUNDS_TO_CONVERGE;
  const capped = !converged && round >= MAX_ROUNDS;
  const next = converged ? "converged" : capped ? "cap" : "continue";
  return {
    clean, converged, capped, next, blocking, reopened,
    ledger: { ...ledger, round, cleanStreak, settled: [...ledger.settled], fixed: [...ledger.fixed] },
  };
}

const readLedger = (file) => (fs.existsSync(file) ? { ...emptyLedger(), ...JSON.parse(fs.readFileSync(file, "utf8")) } : emptyLedger());
const writeJson = (file, v) => fs.writeFileSync(file, JSON.stringify(v, null, 2) + "\n");

const optAll = (args, flag) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]] : []));
const opt = (args, flag) => optAll(args, flag)[0];

function main(argv) {
  const [cmd, ...args] = argv;
  if (cmd === "plan" && args[0]) return planReview(args[0], { cwd: process.cwd(), mode: opt(args, "--mode") ?? "full", size: opt(args, "--size") });
  if (cmd === "parse" && args[0]) return parseReport(fs.readFileSync(args[0], "utf8"));
  if (cmd === "judge" && args[1]) {
    const report = parseReport(fs.readFileSync(args[1], "utf8"));
    const extra = (opt(args, "--not-run") ?? "").split(",").filter(Boolean);
    const notRun = [...new Set([...report.reviewers.filter((x) => x.status === "not run").map((x) => x.name), ...extra])];
    const res = judgeRound(readLedger(args[0]), { findings: report.findings, notRun, unparsed: report.unparsed.length });
    writeJson(args[0], res.ledger);
    const sev = (x) => ({ ...x, nereusSeverity: toSeverity(x.severity) });
    return { ...res, notRun, unparsed: report.unparsed, blocking: res.blocking.map(sev), reopened: res.reopened.map(sev) };
  }
  if (cmd === "settle" && args[0]) {
    const l = readLedger(args[0]);
    const next = {
      ...l,
      settled: [...new Set([...l.settled, ...optAll(args, "--settle")])],
      fixed: [...new Set([...l.fixed, ...optAll(args, "--fixed")])],
    };
    writeJson(args[0], next);
    return next;
  }
  return null;
}

if (process.argv[1] && /goldfish\.mjs$/.test(process.argv[1])) {
  try {
    const out = main(process.argv.slice(2));
    if (out === null) {
      process.stderr.write("사용: goldfish.mjs plan <대상> [--mode m] [--size s] | parse <보고서> | judge <원장> <보고서> [--not-run a,b] | settle <원장> [--settle k] [--fixed k]\n");
      process.exit(2);
    }
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  } catch (e) {
    process.stderr.write(`goldfish: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
