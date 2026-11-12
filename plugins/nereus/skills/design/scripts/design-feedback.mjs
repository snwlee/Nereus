// 디자인 피드백 기록기. 비평은 impeccable 스킬(shape·critique·audit)이 하고, 이 스크립트는 그 결과를
// [SEV][축] 형식으로 옮긴 텍스트를 라운드로 적재한다(.nereus/design-feedback.json). 게이트 판정은 lib/design.mjs 가 한다.
// 2026-11-12 사용자 방침: 디자인 검토 1순위는 impeccable. Gemini 는 이 플러그인에서 무료 이미지 생성에만 쓴다.
//
// 사용:
//   node design-feedback.mjs prompt direction|visual [옵션]                옮길 형식(축·VERDICT)과 체크리스트
//   node design-feedback.mjs record direction --critique-file c.md        방향 라운드 기록 (코드 쓰기 전)
//   node design-feedback.mjs record visual --critique-file c.md --files src/hero.css
//   node design-feedback.mjs status [--base main]                         게이트 현황
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { run } from "../../../hooks/scripts/lib/exec.mjs";
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

const REF_IMAGE = /\.(png|jpe?g|webp)$/i;

/** 레퍼런스 이미지 — 웹세션이 받는 형식이고 실제로 있는 것만. 나머지는 이유와 함께 돌려준다. */
export function validRefImages(paths = [], exists = () => true) {
  const rejected = [];
  const ok = paths.filter((p) => {
    if (!REF_IMAGE.test(p)) return rejected.push({ path: p, reason: "png·jpg·jpeg·webp 만 첨부한다" }) && false;
    if (!exists(p)) return rejected.push({ path: p, reason: "파일이 없다" }) && false;
    return true;
  });
  return { ok, rejected };
}

// 레퍼런스를 텍스트로만 적으면 비평가는 그것이 실재하는지도, 브리프가 무엇을 가져오는지도 모른다.
const refSection = (refImages) => (refImages.length
  ? [
    "\n## 첨부 레퍼런스 (첨부 순서 = 아래 순서)",
    ...refImages.map((p) => `- ${path.basename(p)}`),
    "- 브리프가 각 레퍼런스에서 무엇을 가져오고 무엇을 버리는지 말하는가 — 통째로 베끼는 방향이면 지적하세요",
  ].join("\n")
  : "");

export function directionPrompt({ brief = "", target = "web", refs = "", refImages = [] } = {}) {
  return [
    `당신은 까다로운 시니어 프로덕트 디자이너입니다. 아래 ${target} UI 의 **디자인 방향**을 코드 작성 전에 비평하세요.`,
    "",
    "## 방향 브리프",
    brief.trim() || "(브리프 없음 — 방향이 비어 있다는 것 자체를 지적하세요)",
    refs ? `\n## 레퍼런스\n${refs.trim()}` : "",
    refSection(refImages),
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
  // 지적이 하나도 없고 OK 판정도 없으면 비평이 아니다 — 거절문("도와드릴 수 없습니다")이 여기로 온다.
  // 이걸 라운드로 남기면 차단 0 이라 게이트가 통과한다(2026-09-22 SayTheWord 에서 두 라운드가 그랬다).
  const isCritique = items.length > 0 || verdict === "OK";
  return { verdict, items, blocking, advisory, untagged, summary, raw, isCritique };
}

const NOT_CRITIQUE = "비평이 아닙니다 — 형식에 맞는 지적도 VERDICT: OK 도 없습니다(거절문일 수 있음). 기록하지 않습니다. impeccable 보고서를 [SEV][축] 줄과 VERDICT 줄로 옮겼는지 확인하세요";

// 라운드 출처. 어느 채널이 판정했는지 추적한다(이전 기록의 gemini-web·gemini-agy·gemini-mcp 는 그대로 읽힌다).
export const RECORD_SOURCE = "impeccable";

const PHASES = ["direction", "visual"];

/** impeccable 결과를 옮길 형식·체크리스트. 비평 서브에이전트에 줄 수도 있다. */
export function promptFor({ phase, brief = "", target = "web", refs = "", refImages = [], shots = [], context = "", previous = "" } = {}) {
  if (!PHASES.includes(phase)) throw new Error(`phase 는 direction 또는 visual 이어야 합니다 (받은 값: ${phase})`);
  if (phase === "direction") return directionPrompt({ brief, target, refs, refImages });
  if (!shots.length) throw new Error("visual 프롬프트에는 스크린샷이 최소 1장 필요합니다 (--shot 320:path.png)");
  return visualPrompt({ shots, context, previous });
}

/** 직전 visual 라운드의 지적. 프롬프트에 실어 같은 것을 되풀이하거나 뒤집지 않게 한다. */
export function previousNotes(rounds = [], { phase = "visual" } = {}) {
  const last = [...rounds].reverse().find((r) => r.phase === phase && String(r.notes || "").trim());
  return last ? String(last.notes).trim() : "";
}

/**
 * impeccable 비평을 옮긴 텍스트를 라운드 레코드로 만든다. verdict 판정은 parseCritique 를
 * 그대로 쓴다 — 옮기는 과정이 게이트를 느슨하게 만들면 안 된다(VERDICT 줄이 없으면 REVISE).
 */
export function planRecord({ phase, critique = "", files = [], hashOf, report = null, reportPath = "" } = {}) {
  if (!PHASES.includes(phase)) throw new Error(`phase 는 direction 또는 visual 이어야 합니다 (받은 값: ${phase})`);
  if (!String(critique).trim()) throw new Error("비평 내용이 비어 있습니다 — 빈 기록은 게이트를 우회합니다");
  // 옮기는 주체가 코드를 쓴 세션이라 자기 신고가 된다. 원본 보고서를 해시로 묶어 대조할 수 있게 하고,
  // 격리가 깨진 impeccable 보고서(DEGRADED)는 새 맥락 비평이 아니므로 받지 않는다. — EGM 리뷰 [MEDIUM], 2026-11-12
  if (report !== null && /DEGRADED/.test(String(report))) {
    throw new Error("impeccable 보고서가 DEGRADED 입니다 — 서브에이전트 격리가 깨진 비평은 기록하지 않습니다. 다시 받으세요");
  }
  const parsed = parseCritique(critique);
  if (!parsed.isCritique) throw new Error(NOT_CRITIQUE);
  const list = phase === "visual" ? files.map((f) => String(f).trim()).filter(Boolean) : [];
  const round = {
    phase,
    source: RECORD_SOURCE,
    verdict: parsed.verdict,
    // 게이트가 보는 숫자. verdict 는 기록용이다 - 취향 축의 REVISE 로는 막지 않는다.
    blocking: parsed.blocking.length,
    files: list.length ? hashOf(list) : {},
    notes: parsed.summary,
    ...(report !== null ? { report: { path: reportPath, hash: createHash("sha256").update(String(report)).digest("hex").slice(0, 16) } } : {}),
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
  lines.push("", pass ? "**판정: 통과**" : "**판정: 차단** — impeccable 비평을 받고 반영한 뒤 다시 실행.");
  return lines.join("\n");
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const flag = (argv, name, fallback = null) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : fallback; };
const flags = (argv, name) => argv.reduce((acc, v, i) => (v === name && argv[i + 1] ? [...acc, argv[i + 1]] : acc), []);

// --ref-image 를 검사한다. 하나라도 못 쓰면 멈춘다 — 레퍼런스를 빠뜨린 채 비평받으면 방향이 틀어진다.
function parseRefImages(argv) {
  const { ok, rejected } = validRefImages(flags(argv, "--ref-image"), fs.existsSync);
  if (rejected.length) {
    process.stderr.write(rejected.map((r) => `[design] --ref-image ${r.path}: ${r.reason}`).join("\n") + "\n");
    process.exit(2);
  }
  return ok;
}

function parseShots(argv) {
  return flags(argv, "--shot").map((v) => {
    const m = String(v).match(/^(\d+):(.+)$/);
    return m ? { width: Number(m[1]), path: m[2] } : { width: 0, path: v };
  });
}

export function collectDiff(cwd, base) {
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

  // 비평은 에이전트가 impeccable 스킬로 받는다(스크립트는 스킬을 부를 수 없다). prompt 로 옮길 형식을 받고 record 로 들여온다.
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
          refImages: parseRefImages(argv),
          shots: parseShots(argv),
          context: flag(argv, "--context", "") ?? "",
          previous: previousNotes(readRounds(cwd)),
        }) + "\n");
        process.exit(0);
      }
      const cf = flag(argv, "--critique-file");
      const rp = flag(argv, "--report");
      if (!rp || !fs.existsSync(rp)) {
        throw new Error("--report <impeccable 원본 보고서 파일> 이 필요합니다 — 옮긴 비평을 원본과 대조할 수 있어야 합니다");
      }
      const { round, parsed, warning } = planRecord({
        phase,
        critique: cf ? fs.readFileSync(cf, "utf8") : flag(argv, "--critique", "") ?? "",
        files: (flag(argv, "--files", "") ?? "").split(",").map((x) => x.trim()).filter(Boolean),
        hashOf: (list) => fileHashes(cwd, list),
        report: fs.readFileSync(rp, "utf8"),
        reportPath: rp,
      });
      recordRound(cwd, round);
      process.stdout.write(
        `[design] ${phase} 라운드 기록 (${RECORD_SOURCE}) — verdict=${round.verdict}, 차단 ${round.blocking}건 · 권고 ${parsed.advisory.length}건, 대상 ${Object.keys(round.files).length}개 파일\n`,
      );
      if (warning) process.stderr.write(`[design] 경고: ${warning}\n`);
      process.exit(round.blocking === 0 ? 0 : 1);
    } catch (e) {
      process.stderr.write(`${e.message}\n`);
      process.exit(2);
    }
  }

  if (cmd === "direction" || cmd === "visual") {
    process.stderr.write([
      `[design] ${cmd} 비평은 impeccable 스킬로 받는다 — Gemini 채널은 없어졌다(2026-11-12).`,
      cmd === "direction"
        ? "  1) /impeccable shape <대상> 으로 방향을 잡고 비평받는다"
        : "  1) /impeccable critique <대상> (+ 필요하면 audit) 로 렌더 결과를 비평받는다",
      `  2) 결과를 [SEV][축] 형식으로 옮긴다:  node design-feedback.mjs prompt ${cmd} …  (형식·체크리스트)`,
      `  3) node design-feedback.mjs record ${cmd} --critique-file <파일>${cmd === "visual" ? " --files <파일들>" : ""}`,
    ].join("\n") + "\n");
    process.exit(2);
  }
  process.stderr.write("사용: design-feedback.mjs prompt|record|status [옵션]\n");
  process.exit(2);
}
