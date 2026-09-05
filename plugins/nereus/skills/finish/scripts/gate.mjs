// finish/review 게이트: 완료 무결성(diff 분류) + 테스트 evidence(FRESH/STALE/MISSING)를 한 번에 판정한다.
// 사용: node gate.mjs [--base main]   종료코드 0=통과, 1=차단. 출력은 markdown.
import { run } from "../../../hooks/scripts/lib/exec.mjs";
import { checkIntegrity } from "../../../hooks/scripts/lib/integrity.mjs";
import { evidenceStatus } from "../../../hooks/scripts/lib/evidence.mjs";
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

// 설정 gate.exclude(glob) 에 해당하는 파일 블록을 diff 에서 제거한다.
export function excludeFiles(diff, globs = []) {
  if (!globs.length) return diff;
  const res = globs.map(globToRegExp);
  return diff.split(/(?=^diff --git )/m).filter((block) => { const m = block.match(/^diff --git a\/(.+?) b\//); return !(m && res.some((re) => re.test(m[1]))); }).join("");
}

export function gateReport({ diff, evidence }) {
  const integrity = checkIntegrity(diff);
  const lines = ["## 완료 게이트", ""];
  lines.push(`- 테스트 evidence: **${evidence.status}**${evidence.status === "MISSING" ? " (run-tests.mjs 로 테스트를 실행해 기록하세요)" : evidence.status === "STALE" ? " (코드가 바뀐 뒤 테스트를 다시 돌리지 않았음)" : evidence.passing ? ` (${evidence.command} 통과)` : ` (${evidence.command} **실패**)`}`);
  lines.push(`- 완료 무결성: **${integrity.pass ? "통과" : `${integrity.findings.length}건 발견`}**`);
  for (const f of integrity.findings) lines.push(`  - [${f.category}] ${f.file}: \`${f.line}\` — ${f.message}`);
  const pass = integrity.pass && evidence.status === "FRESH" && evidence.passing === true;
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
  const r = gateReport({ diff: excludeFiles(diff, cfg.gate?.exclude ?? []), evidence: evidenceStatus(cwd) });
  process.stdout.write(r.markdown + "\n");
  process.exit(r.pass ? 0 : 1);
}
