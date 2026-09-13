// evidence 게이트. 테스트 실행 결과를 작업트리 해시와 함께 기록하고, 이후 코드가 바뀌었는지(STALE) 판정한다.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { run as defaultRun } from "./exec.mjs";
import { projectStateDir } from "./paths.mjs";

/**
 * 추적되지 않은 파일들의 **내용** 지문.
 *
 * `status --porcelain` 은 미추적 파일의 **이름만** 내고 `diff HEAD` 는 추적 파일만 본다.
 * 그래서 새 파일을 만들어 고치는 동안 — 즉 신규 기능을 개발하는 내내 — 해시가 안 변하고
 * evidence 가 FRESH 로 남았다. 실패한 테스트 결과가 그대로 통과로 보인다.
 * (실측 2026-09-13: FAIL→수정→PASS 동안 해시 8e3293f791397a69 가 그대로였다.)
 *
 * `--exclude-standard` 로 gitignore 된 것은 뺀다. 빌드 산출물로 매번 STALE 이 되면
 * 사람이 게이트를 꺼버린다 — 끄게 만드는 게이트는 게이트가 아니다.
 *
 * 내용 해시는 `git hash-object` 에 맡긴다. 우리가 파일을 읽으면 인코딩·심볼릭링크·
 * 큰 파일 처리를 전부 다시 정해야 한다.
 */
function untrackedDigest(run) {
  const listed = run(["ls-files", "--others", "--exclude-standard", "-z"]);
  if (!listed.ok) return "untracked:unknown"; // 못 봤다는 사실을 남긴다. 빈 문자열이면 "없음"과 구분되지 않는다
  const paths = listed.stdout.split("\0").filter(Boolean);
  if (!paths.length) return "untracked:none";
  const hashed = run(["hash-object", "--stdin-paths"], { input: paths.join("\n") + "\n" });
  const lines = hashed.ok ? hashed.stdout.split("\n").filter(Boolean) : [];
  // 개수가 안 맞으면(이름에 개행이 든 파일 등) 맞는 척하지 않는다.
  if (lines.length !== paths.length) return `untracked:mismatch:${paths.length}:${lines.length}:${paths.join("|")}`;
  return paths.map((p, i) => `${p}:${lines[i]}`).join("|");
}

export function workTreeHash(cwd, { run = (args, opts) => defaultRun("git", args, { cwd, ...opts }) } = {}) {
  const parts = ["rev-parse HEAD", "status --porcelain", "diff HEAD"].map((a) => { const r = run(a.split(" ")); return r.ok ? r.stdout : ""; });
  parts.push(untrackedDigest(run));
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
