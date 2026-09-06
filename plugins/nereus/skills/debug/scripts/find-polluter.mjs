// 테스트 오염원 탐색. 테스트를 하나씩 돌려 "이 파일·디렉터리가 생기는 순간"의 테스트를 지목한다.
// superpowers 의 find-polluter.sh 를 Node 로 이식 — Windows 에서도 돌아야 한다.
//
// 사용: node find-polluter.mjs <생기면_안_되는_경로> <테스트_glob> [--cmd "npm test"]
//   node find-polluter.mjs ".git" "tests/**/*.test.ts"
import fs from "node:fs";
import path from "node:path";
import { run } from "../../../hooks/scripts/lib/exec.mjs";
import { globToRegExp } from "../../../hooks/scripts/tdd-guard.mjs";

/** 오염이 처음 나타나는 테스트를 찾는다. 파일시스템·실행은 호출자가 넘긴다(순수 판정). */
export function bisect({ files = [], exists, runTest }) {
  if (exists()) return { found: false, preexisting: true, ran: 0 };
  let ran = 0;
  for (const file of files) {
    ran += 1;
    try { runTest(file); } catch { /* 실패한 테스트도 오염시킬 수 있다 — 계속 간다 */ }
    if (exists()) return { found: true, file, index: ran, total: files.length };
  }
  return { found: false, ran };
}

export function report(result, target, cmd) {
  if (result.preexisting) return `⚠️  \`${target}\` 가 테스트 실행 전에 **이미 존재**합니다. 먼저 지우고 다시 돌리세요.`;
  if (!result.found) return `✅ 오염원을 찾지 못했습니다 (${result.ran}개 테스트 실행). \`${target}\` 는 이 테스트들이 만들지 않습니다.`;
  return [
    `🎯 오염원: **${result.file}** (${result.index}/${result.total})`,
    `\`${target}\` 가 이 테스트를 돌린 직후 생겼습니다.`,
    "",
    "조사:",
    `- \`${cmd} ${result.file}\` — 이 테스트만 실행`,
    `- \`${result.file}\` 를 읽고 임시 디렉터리 대신 cwd 를 쓰는 지점을 찾는다`,
    "- 근본 원인은 대개 빈 경로·기본값 cwd 다. references/root-cause-tracing.md 참고",
  ].join("\n");
}

export function listFiles(cwd, glob, readdir = fs.readdirSync) {
  const re = globToRegExp(glob);
  const out = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "dist" || e.name === "coverage") continue;
      const abs = path.join(dir, e.name);
      const rel = path.relative(cwd, abs).split(path.sep).join("/");
      if (e.isDirectory()) walk(abs);
      else if (re.test(rel)) out.push(rel);
    }
  };
  walk(cwd);
  return out.sort();
}

if (process.argv[1] && /find-polluter\.mjs$/.test(process.argv[1])) {
  const argv = process.argv.slice(2);
  const positional = [];
  let cmd = "npm test";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--cmd") { cmd = argv[++i] ?? cmd; continue; }
    positional.push(argv[i]);
  }
  const [target, glob] = positional;
  if (!target || !glob) {
    process.stderr.write('사용: find-polluter.mjs <생기면_안_되는_경로> <테스트_glob> [--cmd "npm test"]\n');
    process.exit(2);
  }
  const cwd = process.cwd();
  const files = listFiles(cwd, glob);
  process.stdout.write(`🔍 \`${target}\` 를 만드는 테스트를 찾습니다. 대상 ${files.length}개 (${glob})\n`);
  const [bin, ...rest] = cmd.split(" ");
  const result = bisect({
    files,
    exists: () => fs.existsSync(path.join(cwd, target)),
    runTest: (f) => {
      process.stdout.write(`  [${files.indexOf(f) + 1}/${files.length}] ${f}\n`);
      run(bin, [...rest, f], { cwd, timeout: 600000 });
    },
  });
  process.stdout.write("\n" + report(result, target, cmd) + "\n");
  process.exit(result.found ? 1 : 0);
}
