// 디자인 피드백 실행기. 방향(텍스트)·렌더 결과(스크린샷 첨부) 모두 Gemini 웹세션 CLI 로 비평받고
// 결과를 .nereus/design-feedback.json 에 라운드로 적재한다. 게이트 판정은 lib/design.mjs 가 한다.
//
// 사용:
//   node design-feedback.mjs direction --brief brief.md            방향 비평 (코드 쓰기 전)
//   node design-feedback.mjs visual --shot 320:a.png --shot 1440:b.png --files src/hero.css
//   node design-feedback.mjs status [--base main]                  게이트 현황
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { run, which } from "../../../hooks/scripts/lib/exec.mjs";
import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";
import { designTouched, fileHashes, recordRound, readRounds, designGate } from "../../../hooks/scripts/lib/design.mjs";

/** 여덟 축. 키는 비평 줄에 태그로 붙는다 — `- [HIGH][a11y] …`. */
export const AXES = {
  hierarchy: "계층: 스케일 대비로 시선 순서가 강제되는가, 아니면 전부 같은 무게인가",
  rhythm: "리듬: 여백·배치가 의도적인가, 모든 곳에 같은 패딩인가 (열 수·폭·빈 공간도 이 축)",
  depth: "깊이: 겹침·그림자·표면·모션으로 층이 생기는가",
  type: "타이포: 폰트 페어링에 의도가 있는가, 기본 스택을 그냥 쓴 것인가",
  color: "색: 의미로 쓰였는가, 장식용 액센트 하나로 때웠는가",
  states: "상태: hover/focus/active 가 설계된 느낌인가",
  template: "템플릿티: 기본 Tailwind·shadcn 템플릿, 중앙 정렬 히어로+그라데이션 blob, 균일 카드 그리드로 보이는가",
  a11y: "접근성: 대비, 키보드 포커스 가시성, reduced-motion",
};

/**
 * 게이트를 실제로 막는 축.
 *
 * ## 왜 셋뿐인가 (2026-09-13 googleplay-control)
 *
 * 같은 두 파일에 visual 라운드가 다섯 번 돌았고 전부 REVISE 였다. 요구가 라운드마다
 * 뒤집혔다 — "320px 은 세로 1열로" 다음 라운드가 "세로 스택이 너무 크다, 인라인으로",
 * "1440px 은 2열로" 다음이 "2열은 높이가 안 맞으니 세로 리스트로". 비평가는 매번 처음
 * 보는 사람이라 직전에 자기가 시킨 것을 모른다. 그래서 고칠수록 다시 걸렸다.
 *
 * 뒤집힌 것은 **전부 배치·표면 취향**이었다(rhythm·depth·template). 재면 답이 나오는 축은
 * 뒤집히지 않는다 — 대비는 숫자고, 포커스 링은 있거나 없고, 계층은 스케일 차이다.
 * 그 셋만 막고 나머지는 권고로 남긴다. 취향으로 사람을 무한히 막지 않는다.
 */
export const BLOCKING_AXES = Object.freeze(["a11y", "hierarchy", "states"]);

const CHECKLIST = Object.entries(AXES).map(([key, text], i) => `${i + 1}. [${key}] ${text}`);

const VERDICT_RULE = [
  "출력 형식(이 형식만, 서론·요약문 없이):",
  "- [CRITICAL|HIGH|MEDIUM|LOW][축] 한 줄 지적 — 무엇을 어떻게 바꿔야 하는지 구체적으로",
  `축은 다음 중 하나를 그대로 씁니다: ${Object.keys(AXES).join(" | ")}`,
  "예) - [HIGH][a11y] 비활성 버튼 텍스트 대비가 2.4:1 로 WCAG AA 미달 — 명도를 올릴 것",
  "축을 빼지 마세요. 축이 없는 지적은 권고로만 기록되고 반영 여부를 추적할 수 없습니다.",
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

export function visualPrompt({ shots = [], context = "", previous = "" } = {}) {
  const list = shots.map((s) => `- ${s.width}px 폭: ${path.basename(s.path)}`).join("\n");
  // 비평가는 매번 처음 보는 사람이다. 직전에 자기가 시킨 것을 모르면 그것을 되돌리라고
  // 요구하고, 화면은 두 요구 사이를 오간다(2026-09-13 다섯 라운드). 기억을 실어 준다.
  const memory = String(previous || "").trim();
  return [
    "당신은 까다로운 시니어 프로덕트 디자이너입니다. 첨부한 렌더 스크린샷의 **미감과 완성도**를 비평하세요.",
    context ? `\n## 화면 맥락\n${context.trim()}` : "",
    memory ? `\n## 직전 라운드에서 당신이 요구한 것\n${memory}\n\n지금 화면은 이 요구를 반영한 결과입니다. 반영됐으면 그 항목은 다시 지적하지 마세요.\n그 요구가 틀렸다고 판단해 되돌려야 한다면, 새 지적이 아니라 **철회**입니다 — 줄 맨 앞에 [REVERSAL] 을 붙이고 이전 판단의 무엇이 틀렸는지 적으세요.` : "",
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

const SEV = /^\s*[-*]?\s*\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*(?:\[([A-Za-z0-9_-]+)\])?\s*(.+)$/i;

/** 지적 줄의 축. 태그가 없거나 모르는 이름이면 null(권고로만 센다). */
export function axisOf(line) {
  const m = String(line ?? "").match(SEV);
  const key = m && m[2] ? m[2].toLowerCase() : "";
  return key && key in AXES ? key : null;
}

/**
 * 비평 텍스트를 읽는다.
 *
 * `verdict` 는 예전 그대로다 — 기록에는 남는다. **게이트가 보는 것은 `blocking`** 이다.
 * 차단은 (a) 차단 축의 CRITICAL·HIGH, (b) 축을 안 붙인 CRITICAL 뿐이다. 배치·표면 취향은
 * 아무리 세게 적혀도 권고로 남는다 — 그 축들이 라운드마다 서로 반대를 요구했다.
 */
export function parseCritique(text, { blockingAxes = BLOCKING_AXES } = {}) {
  const raw = String(text ?? "");
  const axes = new Set(blockingAxes);
  const items = [];
  for (const line of raw.split("\n")) {
    const m = line.match(SEV);
    if (!m) continue;
    const severity = m[1].toUpperCase();
    const tag = m[2] ? m[2].toLowerCase() : "";
    const axis = tag && tag in AXES ? tag : null;
    const severe = severity === "CRITICAL" || severity === "HIGH";
    // 되돌리기 요구는 사람이 판단할 몫이다. 자동으로 막지 않는다.
    const reversal = /\[REVERSAL\]/i.test(line);
    items.push({
      severity,
      axis,
      message: m[3].trim(),
      blocking: severe && !reversal && (axis ? axes.has(axis) : severity === "CRITICAL"),
    });
  }
  const vm = raw.match(/VERDICT:\s*(OK|REVISE)/i);
  const severe = items.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH");
  const blocking = items.filter((i) => i.blocking);
  const advisory = severe.filter((i) => !i.blocking);
  const untagged = items.filter((i) => i.axis === null).length;
  // fail-closed: verdict 줄이 없으면 통과로 치지 않는다. HIGH 이상이 하나라도 있으면 OK 주장을 무시한다.
  const verdict = vm && vm[1].toUpperCase() === "OK" && severe.length === 0 ? "OK" : "REVISE";
  const label = (i) => `[${i.severity}]${i.axis ? `[${i.axis}]` : ""} ${i.message}`;
  const summary = (severe.length ? severe : items).map(label).join(" / ").slice(0, 600)
    || raw.trim().slice(0, 300);
  return { verdict, items, blocking, advisory, untagged, summary, raw };
}

// URL.pathname 은 Windows 에서 "/C:/..." 를 내놓는다 — fileURLToPath 를 거쳐야 한다.
const GEMINI_CLI = () => path.resolve(fileURLToPath(new URL("../../image/scripts/gemini_cli.py", import.meta.url)));

export function planRunner({ phase, shots = [], promptFile = "", has = (b) => !!which(b) } = {}) {
  if (phase === "direction") {
    // 웹세션이 먼저다. 2026-09-12 실측: agy 는 할당량 소진(~2026-09-16 리셋), 웹세션은 살아 있다.
    // agy 는 웹세션이 없을 때의 대체 경로로 남긴다.
    if (has("python3")) return { bin: "python3", args: [GEMINI_CLI(), "ask", "--prompt-file", promptFile], source: "gemini-web" };
    if (has("agy")) return { bin: "agy", args: ["-p", "@" + promptFile], source: "gemini-agy", stdinPrompt: true };
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

// browser MCP 로 Gemini 웹을 직접 조작한 라운드. agy·웹세션 CLI 와 구분해 남긴다 —
// 나중에 어느 채널이 판정했는지 추적할 수 있어야 한다.
export const MCP_SOURCE = "gemini-mcp";

const PHASES = ["direction", "visual"];

/** MCP 로 Gemini 에 넣을 프롬프트. planRunner 를 타지 않는 경로여서 프롬프트만 따로 뽑는다. */
export function promptFor({ phase, brief = "", target = "web", refs = "", shots = [], context = "", previous = "" } = {}) {
  if (!PHASES.includes(phase)) throw new Error(`phase 는 direction 또는 visual 이어야 합니다 (받은 값: ${phase})`);
  if (phase === "direction") return directionPrompt({ brief, target, refs });
  if (!shots.length) throw new Error("visual 프롬프트에는 스크린샷이 최소 1장 필요합니다 (--shot 320:path.png)");
  return visualPrompt({ shots, context, previous });
}

/** 직전 visual 라운드의 지적. 프롬프트에 실어 같은 것을 되풀이하거나 뒤집지 않게 한다. */
export function previousNotes(rounds = [], { phase = "visual" } = {}) {
  const last = [...rounds].reverse().find((r) => r.phase === phase && String(r.notes || "").trim());
  return last ? String(last.notes).trim() : "";
}

/**
 * MCP 에서 받아온 비평 텍스트를 라운드 레코드로 만든다. verdict 판정은 기존 parseCritique 를
 * 그대로 쓴다 — MCP 경로가 게이트를 느슨하게 만들면 안 된다(VERDICT 줄이 없으면 REVISE).
 */
export function planRecord({ phase, critique = "", files = [], hashOf } = {}) {
  if (!PHASES.includes(phase)) throw new Error(`phase 는 direction 또는 visual 이어야 합니다 (받은 값: ${phase})`);
  if (!String(critique).trim()) throw new Error("비평 내용이 비어 있습니다 — 빈 기록은 게이트를 우회합니다");
  const parsed = parseCritique(critique);
  const list = phase === "visual" ? files.map((f) => String(f).trim()).filter(Boolean) : [];
  const round = {
    phase,
    source: MCP_SOURCE,
    verdict: parsed.verdict,
    // 게이트가 보는 숫자. verdict 는 기록용이다 - 취향 축의 REVISE 로는 막지 않는다.
    blocking: parsed.blocking.length,
    files: list.length ? hashOf(list) : {},
    notes: parsed.summary,
  };
  const warning = phase === "visual" && !list.length
    ? "--files 를 주지 않아 어떤 파일도 이 비평으로 커버되지 않습니다. 게이트는 계속 차단합니다."
    : null;
  return { round, parsed, warning };
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

  // MCP 경로: prompt 로 내보내고 record 로 들여온다. 스크립트는 MCP 도구를 부를 수 없으므로
  // 에이전트가 그 사이에서 browser MCP 로 Gemini 웹을 조작한다.
  if (cmd === "prompt" || cmd === "record") {
    const phase = argv[1];
    try {
      if (cmd === "prompt") {
        const bf = flag(argv, "--brief");
        process.stdout.write(promptFor({
          phase,
          brief: bf ? fs.readFileSync(bf, "utf8") : flag(argv, "--text", "") ?? "",
          target: flag(argv, "--target", "web") ?? "web",
          refs: flag(argv, "--refs", "") ?? "",
          shots: parseShots(argv),
          context: flag(argv, "--context", "") ?? "",
          previous: previousNotes(readRounds(cwd)),
        }) + "\n");
        process.exit(0);
      }
      const cf = flag(argv, "--critique-file");
      const { round, parsed, warning } = planRecord({
        phase,
        critique: cf ? fs.readFileSync(cf, "utf8") : flag(argv, "--critique", "") ?? "",
        files: (flag(argv, "--files", "") ?? "").split(",").map((x) => x.trim()).filter(Boolean),
        hashOf: (list) => fileHashes(cwd, list),
      });
      recordRound(cwd, round);
      process.stdout.write(
        `[design] ${phase} 라운드 기록 (${MCP_SOURCE}) — verdict=${round.verdict}, 차단 ${round.blocking}건 · 권고 ${parsed.advisory.length}건, 대상 ${Object.keys(round.files).length}개 파일\n`,
      );
      if (warning) process.stderr.write(`[design] 경고: ${warning}\n`);
      process.exit(round.blocking === 0 ? 0 : 1);
    } catch (e) {
      process.stderr.write(`${e.message}\n`);
      process.exit(2);
    }
  }

  if (cmd !== "direction" && cmd !== "visual") {
    process.stderr.write("사용: design-feedback.mjs direction|visual|prompt|record|status [옵션]\n");
    process.exit(2);
  }

  const briefFile = flag(argv, "--brief");
  const brief = briefFile ? fs.readFileSync(briefFile, "utf8") : flag(argv, "--text", "") ?? "";
  const shots = parseShots(argv);
  const context = flag(argv, "--context", "") ?? "";
  const prompt = cmd === "direction"
    ? directionPrompt({ brief, target: flag(argv, "--target", "web"), refs: flag(argv, "--refs", "") ?? "" })
    : visualPrompt({ shots, context, previous: previousNotes(readRounds(cwd)) });

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
  recordRound(cwd, {
    phase: cmd, source: plan.source, verdict: critique.verdict,
    blocking: critique.blocking.length, files, notes: critique.summary,
  });

  process.stdout.write(critique.raw.trim() + "\n\n");
  process.stdout.write(
    `[design] ${cmd} 라운드 기록 — verdict=${critique.verdict}, 차단 ${critique.blocking.length}건 · 권고 ${critique.advisory.length}건, 대상 ${Object.keys(files).length}개 파일\n`,
  );
  if (critique.untagged) {
    process.stderr.write(`[design] 축을 안 붙인 지적 ${critique.untagged}건 — CRITICAL 만 차단으로 셉니다.\n`);
  }
  if (cmd === "visual" && !Object.keys(files).length) {
    process.stderr.write("[design] 경고: --files 를 주지 않아 어떤 파일도 이 비평으로 커버되지 않습니다. 게이트는 계속 차단합니다.\n");
  }
  process.exit(critique.blocking.length === 0 ? 0 : 1);
}
