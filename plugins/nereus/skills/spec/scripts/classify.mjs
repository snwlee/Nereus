// 프로젝트가 신규(spec-kit)인지 기존(OpenSpec)인지 판별.
import fs from "node:fs";
import path from "node:path";
import { run } from "../../../hooks/scripts/lib/exec.mjs";

const SOURCE_DIRS = ["src", "lib", "app", "main"];
const SOURCE_EXT = /\.(dart|java|kt|ts|tsx|js|jsx|py|go|rs)$/;

function defaultHasSource(cwd) {
  try {
    if (fs.readdirSync(cwd).some((f) => SOURCE_EXT.test(f))) return true;
    return SOURCE_DIRS.some((d) => fs.existsSync(path.join(cwd, d)));
  } catch { return false; }
}

function defaultCommitCount(cwd) {
  const r = run("git", ["rev-list", "--count", "HEAD"], { cwd });
  return r.ok ? parseInt(r.stdout.trim(), 10) || 0 : 0;
}

export function classify(cwd, { fsx = { exists: (p) => fs.existsSync(p) }, commitCount = defaultCommitCount, hasSource = defaultHasSource } = {}) {
  if (fsx.exists(path.join(cwd, "openspec"))) return { kind: "brownfield", tool: "openspec", onboard: false, reason: "openspec/ 디렉터리가 이미 있음" };
  if (fsx.exists(path.join(cwd, ".specify"))) return { kind: "greenfield", tool: "spec-kit", reason: ".specify/ 가 이미 있음 (spec-kit 진행 중)" };
  const commits = commitCount(cwd);
  const src = hasSource(cwd);
  if (src && commits >= 10) return { kind: "brownfield", tool: "openspec", onboard: true, reason: `소스 있음, 커밋 ${commits}개 → 역스펙화 필요` };
  return { kind: "greenfield", tool: "spec-kit", reason: src ? `커밋 ${commits}개로 초기 단계` : "소스 없음" };
}

if (process.argv[1] && /classify\.mjs$/.test(process.argv[1])) {
  process.stdout.write(JSON.stringify(classify(process.argv[2] || process.cwd())) + "\n");
}
