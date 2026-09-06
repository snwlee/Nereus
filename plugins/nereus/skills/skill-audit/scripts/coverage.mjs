// 스킬 커버리지 리포트. 이 프로젝트의 최근 세션에서 Nereus 스킬이 실제로 발동했는지 센다.
// 사용: node coverage.mjs [--cwd <path>] [--limit 20] [--prefix nereus] [--json]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSessions, listInstalledSkills, coverageReport, transcriptDir } from "../../../hooks/scripts/lib/coverage.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };

const cwd = arg("--cwd", process.cwd());
const prefix = arg("--prefix", "nereus");
const limit = parseInt(arg("--limit", "20"), 10);
const skillsDir = path.join(HERE, "..", "..");

const installed = listInstalledSkills(skillsDir, prefix);
const sessions = readSessions(cwd, { limit });
const r = coverageReport({ sessions, installed });

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify({ ...r, transcriptDir: transcriptDir(cwd) }, null, 2) + "\n");
  process.exit(0);
}

if (!r.sessionsSampled) {
  console.log(`트랜스크립트를 찾지 못했습니다: ${transcriptDir(cwd)}`);
  console.log("이 프로젝트에서 세션을 한 번 이상 진행한 뒤 다시 실행하세요.");
  process.exit(0);
}

console.log(`## 스킬 커버리지 (최근 ${r.sessionsSampled}개 세션)\n`);
console.log(`- 스킬이 한 번이라도 발동한 세션: ${r.sessionsWithSkill}/${r.sessionsSampled} (${Math.round(r.coverage * 100)}%)`);
console.log(`- 설치된 ${prefix} 스킬: ${installed.length}개, 발동한 스킬: ${r.used.length}개\n`);
if (r.used.length) {
  console.log("### 발동한 스킬");
  for (const u of r.used) console.log(`- ${u.name} — ${u.sessions}개 세션`);
  console.log("");
}
if (r.unused.length) {
  console.log("### 한 번도 발동하지 않은 스킬");
  for (const n of r.unused) console.log(`- ${n}`);
  console.log("\n쓸 상황이 있었는데 안 떴다면 description(트리거 문구)이 문제다. 사용자가 실제로 쓰는 표현을 넣어라.");
  console.log("쓸 일이 없는 스킬이면 지운다. 안 쓰는 스킬은 상시 토큰만 먹는다.");
}
