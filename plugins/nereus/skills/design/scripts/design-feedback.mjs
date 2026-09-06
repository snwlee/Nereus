// 디자인 피드백 실행기. 방향(텍스트)은 agy, 렌더 결과(스크린샷 첨부)는 Gemini 웹세션 CLI 로 비평받고
// 결과를 .nereus/design-feedback.json 에 라운드로 적재한다. 게이트 판정은 lib/design.mjs 가 한다.
//
// 사용:
//   node design-feedback.mjs direction --brief brief.md            방향 비평 (코드 쓰기 전)
//   node design-feedback.mjs visual --shot 320:a.png --shot 1440:b.png --files src/hero.css
//   node design-feedback.mjs status [--base main]                  게이트 현황
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run, which } from "../../../hooks/scripts/lib/exec.mjs";
import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";
import { designTouched, fileHashes, recordRound, readRounds, designGate } from "../../../hooks/scripts/lib/design.mjs";

const CHECKLIST = [
  "1. 계층: 스케일 대비로 시선 순서가 강제되는가, 아니면 전부 같은 무게인가",
  "2. 리듬: 여백이 의도적으로 다른가, 아니면 모든 곳에 같은 패딩인가",
  "3. 깊이: 겹침·그림자·표면·모션으로 층이 생기는가",
  "4. 타이포: 폰트 페어링에 의도가 있는가, 기본 스택을 그냥 쓴 것인가",
  "5. 색: 의미로 쓰였는가, 장식용 액센트 하나로 때웠는가",
  "6. 상태: hover/focus/active 가 설계된 느낌인가",
  "7. 템플릿티: 기본 Tailwind·shadcn 템플릿, 중앙 정렬 히어로+그라데이션 blob, 균일 카드 그리드로 보이는가",
  "8. 접근성: 대비, 키보드 포커스 가시성, reduced-motion",
];

const VERDICT_RULE = [
  "출력 형식(이 형식만, 서론·요약문 없이):",
  "- [CRITICAL|HIGH|MEDIUM|LOW] 한 줄 지적 — 무엇을 어떻게 바꿔야 하는지 구체적으로",
  "마지막 줄에 정확히: VERDICT: OK   (고칠 게 없을 때)  또는  VERDICT: REVISE",
  "실제 제품 스크린샷으로 통할 수준이 아니면 봐주지 말고 REVISE 를 주세요.",
].join("\n");

export function directionPrompt({ brief = "", target = "web", refs = "" } = {}) {
  return [
    `당신은 까다로운 시니어 프로덕트 디자이너입니다. 아래 ${target} UI 의 **디자인 방향**을 코드 작성 전에 비평하세요.`,
    "",
    "## 방향 브리프",
    brief.trim() || "(브리프 없음 — 방향이 비어 있다는 것 자체를 지적하세요)",
    refs ? `\n## 레퍼런스\n${refs.trim()}` : "",
    "",
    "## 볼 것",
    "- 방향이 '깔끔하고 미니멀' 같은 무색 기본값인가, 특정 스타일 방향(에디토리얼·네오브루탈·라이트 럭셔리·벤토·스크롤리텔링 등)으로 결정됐는가",
    "- 팔레트가 의미 단위로 정의됐는가, 타이포 페어링에 전략이 있는가",
    "- 이 방향이 제품의 목적·톤과 맞는가, 레퍼런스가 실재하는가",
    CHECKLIST.slice(0, 5).join("\n"),
    "",
    VERDICT_RULE,
  ].filter(Boolean).join("\n");
}

export function visualPrompt({ shots = [], context = "" } = {}) {
  const list = shots.map((s) => `- ${s.width}px 폭: ${path.basename(s.path)}`).join("\n");
  return [
    "당신은 까다로운 시니어 프로덕트 디자이너입니다. 첨부한 렌더 스크린샷의 **미감과 완성도**를 비평하세요.",
    context ? `\n## 화면 맥락\n${context.trim()}` : "",
    "",
    "## 첨부 (첨부 순서 = 아래 순서)",
    list || "(없음)",
    "",
    "## 체크리스트",
    CHECKLIST.join("\n"),
    "",
    "폭마다 무너진 지점이 있으면 어느 폭인지 함께 적으세요.",
    "",
    VERDICT_RULE,
  ].filter(Boolean).join("\n");
}

const SEV = /^\s*[-*]?\s*\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*(.+)$/i;

export function parseCritique(text) {
  const raw = String(text ?? "");
  const items = [];
  for (const line of raw.split("\n")) {
    const m = line.match(SEV);
    if (m) items.push({ severity: m[1].toUpperCase(), message: m[2].trim() });
  }
  const vm = raw.match(/VERDICT:\s*(OK|REVISE)/i);
  const blocking = items.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH");
  // fail-closed: verdict 줄이 없으면 통과로 치지 않는다. HIGH 이상이 하나라도 있으면 OK 주장을 무시한다.
  const verdict = vm && vm[1].toUpperCase() === "OK" && blocking.length === 0 ? "OK" : "REVISE";
  const summary = (blocking.length ? blocking : items).map((i) => `[${i.severity}] ${i.message}`).join(" / ").slice(0, 600)
    || raw.trim().slice(0, 300);
  return { verdict, items, summary, raw };
}

const GEMINI_CLI = () => path.resolve(new URL("../../image/scripts/gemini_cli.py", import.meta.url).pathname);

export function planRunner({ phase, shots = [], promptFile = "", has = (b) => !!which(b) } = {}) {
  if (phase === "direction") {
    if (has("agy")) return { bin: "agy", args: ["-p", "@" + promptFile], source: "gemini-agy", stdinPrompt: true };
    if (has("python3")) return { bin: "python3", args: [GEMINI_CLI(), "ask", "--prompt-file", promptFile], source: "gemini-web" };
    return { error: "Gemini 채널이 없습니다 — agy(Antigravity CLI) 또는 python3 + Gemini 웹세션이 필요합니다. /nereus:setup 을 실행하세요." };
  }
  if (phase === "visual") {
    if (!shots.length) return { error: "visual 라운드에는 스크린샷이 최소 1장 필요합니다 (--shot 320:path.png)" };
    if (!has("python3")) return { error: "스크린샷 첨부 비평에는 python3 + Gemini 웹세션이 필요합니다 (agy 는 이미지 첨부를 받지 않습니다)." };
    const args = [GEMINI_CLI(), "ask", "--prompt-file", promptFile];
    for (const s of shots) args.push("--file", s.path);
    return { bin: "python3", args, source: "gemini-web" };
  }
  return { error: `알 수 없는 phase: ${phase}` };
}

export function feedbackReport({ pass, findings = [] }) {
  const lines = ["## 디자인 피드백 게이트", ""];
  if (!findings.length) lines.push("- 미이행 없음");
  for (const f of findings) lines.push(`- [${f.category}] ${f.file} — ${f.message}`);
  lines.push("", pass ? "**판정: 통과**" : "**판정: 차단** — Gemini 피드백을 받고 반영한 뒤 다시 실행.");
  return lines.join("\n");
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const flag = (argv, name, fallback = null) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : fallback; };
const flags = (argv, name) => argv.reduce((acc, v, i) => (v === name && argv[i + 1] ? [...acc, argv[i + 1]] : acc), []);

function parseShots(argv) {
  return flags(argv, "--shot").map((v) => {
    const m = String(v).match(/^(\d+):(.+)$/);
    return m ? { width: Number(m[1]), path: m[2] } : { width: 0, path: v };
  });
}

function collectDiff(cwd, base) {
  const args = base ? ["diff", `${base}...HEAD`] : ["diff", "HEAD"];
  let diff = run("git", args, { cwd }).stdout;
  if (!base) {
    diff += run("git", ["diff", "--cached"], { cwd }).stdout;
    const untracked = run("git", ["ls-files", "--others", "--exclude-standard"], { cwd }).stdout.split("\n").filter(Boolean);
    for (const f of untracked) {
      let body = ""; try { body = fs.readFileSync(path.join(cwd, f), "utf8"); } catch { continue; }
      if (body.length > 200000) continue;
      diff += `\ndiff --git a/${f} b/${f}\n+++ b/${f}\n` + body.split("\n").map((l) => "+" + l).join("\n");
    }
  }
  return diff;
}

export function gateNow(cwd, { base = null, cfg = null } = {}) {
  const conf = cfg ?? loadConfig({ cwd });
  const touched = designTouched(collectDiff(cwd, base), { exclude: conf.design?.exclude ?? [] });
  const hashes = fileHashes(cwd, touched.map((t) => t.file));
  const created = touched.filter((t) => t.created).map((t) => t.file);
  return { ...designGate({ touched, hashes, created, rounds: readRounds(cwd), enforce: conf.design?.enforce ?? "block" }), touched };
}

if (process.argv[1] && /design-feedback\.mjs$/.test(process.argv[1])) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const cwd = process.cwd();
  const cfg = loadConfig({ cwd });

  if (cmd === "status") {
    const r = gateNow(cwd, { base: flag(argv, "--base"), cfg });
    process.stdout.write(feedbackReport(r) + "\n");
    process.exit(r.pass ? 0 : 1);
  }

  if (cmd !== "direction" && cmd !== "visual") {
    process.stderr.write("사용: design-feedback.mjs direction|visual|status [옵션]\n");
    process.exit(2);
  }

  const briefFile = flag(argv, "--brief");
  const brief = briefFile ? fs.readFileSync(briefFile, "utf8") : flag(argv, "--text", "") ?? "";
  const shots = parseShots(argv);
  const context = flag(argv, "--context", "") ?? "";
  const prompt = cmd === "direction"
    ? directionPrompt({ brief, target: flag(argv, "--target", "web"), refs: flag(argv, "--refs", "") ?? "" })
    : visualPrompt({ shots, context });

  const promptFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "nereus-design-")), "prompt.txt");
  fs.writeFileSync(promptFile, prompt);

  const plan = planRunner({ phase: cmd, shots, promptFile });
  if (plan.error) { process.stderr.write(plan.error + "\n"); process.exit(2); }

  const args = plan.stdinPrompt ? ["-p", prompt] : plan.args;
  const r = run(plan.bin, args, { cwd, timeout: 300000 });
  if (!r.ok && !r.stdout.trim()) {
    process.stderr.write(`Gemini 호출 실패 (${plan.bin}): ${r.stderr.slice(0, 500)}\n`);
    process.exit(2);
  }

  const critique = parseCritique(r.stdout);
  const files = cmd === "visual"
    ? fileHashes(cwd, (flag(argv, "--files", "") ?? "").split(",").map((s) => s.trim()).filter(Boolean))
    : {};
  recordRound(cwd, { phase: cmd, source: plan.source, verdict: critique.verdict, files, notes: critique.summary });

  process.stdout.write(critique.raw.trim() + "\n\n");
  process.stdout.write(`[design] ${cmd} 라운드 기록 — verdict=${critique.verdict}, 대상 ${Object.keys(files).length}개 파일\n`);
  if (cmd === "visual" && !Object.keys(files).length) {
    process.stderr.write("[design] 경고: --files 를 주지 않아 어떤 파일도 이 비평으로 커버되지 않습니다. 게이트는 계속 차단합니다.\n");
  }
  process.exit(critique.verdict === "OK" ? 0 : 1);
}
