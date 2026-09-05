// evidence 게이트. 테스트 실행 결과를 작업트리 해시와 함께 기록하고, 이후 코드가 바뀌었는지(STALE) 판정한다.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { run as defaultRun } from "./exec.mjs";
import { projectStateDir } from "./paths.mjs";

export function workTreeHash(cwd, { run = (args) => defaultRun("git", args, { cwd }) } = {}) {
  const parts = ["rev-parse HEAD", "status --porcelain", "diff HEAD"].map((a) => { const r = run(a.split(" ")); return r.ok ? r.stdout : ""; });
  return createHash("sha256").update(parts.join(" ")).digest("hex").slice(0, 16);
}

const file = (cwd) => path.join(projectStateDir(cwd), "evidence.json");

export function recordEvidence(cwd, { command, exitCode }, deps = {}) {
  const hash = deps.hash ?? (() => workTreeHash(cwd));
  const writeFile = deps.writeFile ?? ((p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); });
  const rec = { command, exitCode, hash: hash(), at: deps.now ?? Date.now() };
  writeFile(file(cwd), JSON.stringify(rec, null, 2));
  return rec;
}

export function evidenceStatus(cwd, deps = {}) {
  const readFile = deps.readFile ?? ((p) => fs.readFileSync(p, "utf8"));
  const hash = deps.hash ?? (() => workTreeHash(cwd));
  let rec;
  try { rec = JSON.parse(readFile(file(cwd))); } catch { return { status: "MISSING" }; }
  const status = rec.hash === hash() ? "FRESH" : "STALE";
  return { status, command: rec.command, exitCode: rec.exitCode, passing: rec.exitCode === 0, at: rec.at };
}
