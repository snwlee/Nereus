// finish/review 게이트: 완료 무결성(diff 분류) + 테스트 evidence(FRESH/STALE/MISSING)를 한 번에 판정한다.
// 사용: node gate.mjs [--base main]   종료코드 0=통과, 1=차단. 출력은 markdown.
import { run } from "../../../hooks/scripts/lib/exec.mjs";
import { checkIntegrity, parseDiff } from "../../../hooks/scripts/lib/integrity.mjs";
import { checkWiring } from "../../../hooks/scripts/lib/wiring.mjs";
import { evidenceStatus } from "../../../hooks/scripts/lib/evidence.mjs";
import { designTouched, fileHashes, readRounds, designGate } from "../../../hooks/scripts/lib/design.mjs";
import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";
import { globToRegExp } from "../../../hooks/scripts/tdd-guard.mjs";
import fs from "node:fs";
import path from "node:path";

// 미추적 파일은 git diff 에 안 나오므로 전체를 추가 라인으로 간주한 가짜 diff 를 만든다.
export function untrackedAsDiff(cwd, files, readFile = (p) => fs.readFileSync(p, "utf8")) {
  return files.map((f) => {
    let body = ""; try { body = readFile(path.join(cwd, f)); } catch { return ""; }
    if (body.length > 200000) return "";
    return [`diff --git a/${f} b/${f}`, `+++ b/${f}`, ...body.split("\n").map((l) => "+" + l)].join("\n");
  }).filter(Boolean).join("\n");
}

// gate.exclude(glob) 는 diff 를 잘라내지 않고 findings 만 거른다.
// diff 에서 파일을 통째로 빼면 "테스트도 함께 바뀌었다" 같은 문맥까지 사라져 정당한 변경이 오탐된다.
export function excludeFindings(findings, globs = []) {
  if (!globs.length) return findings;
  const res = globs.map(globToRegExp);
  return findings.filter((f) => !res.some((re) => re.test(f.file)));
}

// 저장소에서 "여기 연결됐나"를 볼 만한 파일만 모은다. 테스트는 참조로 치지 않으므로 제외한다.
const REF_FILE = /(SKILL\.md$|hooks\.json$|\.claude-plugin\/.*\.json$|\.mjs$|config.*\.json$)/;
export function listRepoRefs(cwd, tracked, readFile = (p) => fs.readFileSync(p, "utf8")) {
  return tracked.filter((f) => REF_FILE.test(f) && !/(^|\/)tests?\//.test(f))
    .map((f) => { try { return { file: f, text: readFile(path.join(cwd, f)) }; } catch { return null; } })
    .filter(Boolean);
}

export function gateReport({ diff, evidence, exclude = [], listRefs = null, readHandoff = () => null, design = null }) {
  const found = checkIntegrity(diff);
  const wiring = listRefs ? checkWiring({ files: parseDiff(diff), listRefs, readHandoff }) : { findings: [] };
  const findings = excludeFindings([...found.findings, ...wiring.findings], exclude);
  const integrity = { pass: findings.length === 0, findings };
  const lines = ["## 완료 게이트", ""];
  lines.push(`- 테스트 evidence: **${evidence.status}**${evidence.status === "MISSING" ? " (run-tests.mjs 로 테스트를 실행해 기록하세요)" : evidence.status === "STALE" ? " (코드가 바뀐 뒤 테스트를 다시 돌리지 않았음)" : evidence.passing ? ` (${evidence.command} 통과)` : ` (${evidence.command} **실패**)`}`);
  lines.push(`- 완료 무결성: **${integrity.pass ? "통과" : `${integrity.findings.length}건 발견`}**`);
  for (const f of integrity.findings) lines.push(`  - [${f.category}] ${f.file}${f.line ? `: \`${f.line}\`` : ""} — ${f.message}`);
  if (design && (design.findings?.length || design.pass === false)) {
    lines.push(`- 디자인 피드백: **${design.pass ? `${design.findings.length}건 (경고, enforce=${design.enforce ?? "warn"})` : `${design.findings.length}건 미이행`}**`);
    for (const f of design.findings ?? []) lines.push(`  - [${f.category}] ${f.file} — ${f.message}`);
  }
  const pass = integrity.pass && evidence.status === "FRESH" && evidence.passing === true && design?.pass !== false;
  lines.push("", pass ? "**판정: 통과** — finish 로 진행 가능." : "**판정: 차단** — 위 항목을 해결한 뒤 다시 실행.");
  return { pass, integrity, evidence, markdown: lines.join("\n") };
}

if (process.argv[1] && /gate\.mjs$/.test(process.argv[1])) {
  const cwd = process.cwd();
  const i = process.argv.indexOf("--base");
  const base = i > -1 ? process.argv[i + 1] : null;
  const diffArgs = base ? ["diff", `${base}...HEAD`] : ["diff", "HEAD"];
  let diff = run("git", diffArgs, { cwd }).stdout;
  if (!base) {
    diff += run("git", ["diff", "--cached"], { cwd }).stdout;
    const untracked = run("git", ["ls-files", "--others", "--exclude-standard"], { cwd }).stdout.split("\n").filter(Boolean);
    diff += "\n" + untrackedAsDiff(cwd, untracked);
  }
  const cfg = loadConfig({ cwd });
  const tracked = run("git", ["ls-files"], { cwd }).stdout.split("\n").filter(Boolean);
  // 디자인 표면을 만졌으면 Gemini 피드백 라운드를 요구한다 (design.enforce="block" 기본).
  const touched = designTouched(diff, { exclude: cfg.design?.exclude ?? [] });
  const design = designGate({
    touched,
    hashes: fileHashes(cwd, touched.map((t) => t.file)),
    created: touched.filter((t) => t.created).map((t) => t.file),
    rounds: readRounds(cwd),
    enforce: cfg.design?.enforce ?? "block",
  });
  const r = gateReport({ diff, evidence: evidenceStatus(cwd), exclude: cfg.gate?.exclude ?? [], design, listRefs: () => listRepoRefs(cwd, tracked), readHandoff: () => { try { return fs.readFileSync(path.join(cwd, ".nereus/handoff.md"), "utf8"); } catch { return null; } } });
  process.stdout.write(r.markdown + "\n");
  process.exit(r.pass ? 0 : 1);
}
