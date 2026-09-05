// tasks 파일 탐색과 진행률. spec 단계가 만든 체크박스가 유일한 진행 상태의 근거다.
import fs from "node:fs";
import path from "node:path";

const defaultFs = {
  exists: (p) => fs.existsSync(p),
  readFile: (p) => fs.readFileSync(p, "utf8"),
  glob: (pattern) => {
    // 지원 형태: <root>/openspec/changes/*/tasks.md 처럼 별 하나짜리 한 단계
    const [head, rest] = pattern.split("*");
    const dir = path.dirname(head);
    try {
      return fs.readdirSync(dir).map((d) => path.join(dir, d) + rest).filter((f) => fs.existsSync(f));
    } catch { return []; }
  },
};

export function parseTasks(text) {
  const out = [];
  for (const line of String(text ?? "").split("\n")) {
    const m = line.match(/^\s*-\s*\[([ xX])\]\s*(.+?)\s*$/);
    if (m) out.push({ text: m[2], done: m[1] !== " " });
  }
  return out;
}

/** 우선순위: OpenSpec change > spec-kit specs > 루트 tasks.md */
export function findTasksFile(cwd, fsx = defaultFs) {
  const globbed = [
    path.join(cwd, "openspec", "changes", "*", "tasks.md"),
    path.join(cwd, "specs", "*", "tasks.md"),
    path.join(cwd, ".specify", "specs", "*", "tasks.md"),
  ].flatMap((p) => fsx.glob(p.replace(/\\/g, "/")));
  if (globbed.length) {
    // 여러 개면 미완료 태스크가 남은 것을, 그것도 여럿이면 마지막 것을 고른다
    const open = globbed.filter((f) => { try { return parseTasks(fsx.readFile(f)).some((t) => !t.done); } catch { return false; } });
    return (open.length ? open : globbed).sort().at(-1);
  }
  for (const name of ["tasks.md", "TASKS.md", path.join("docs", "tasks.md")]) {
    const p = path.join(cwd, name).replace(/\\/g, "/");
    if (fsx.exists(p)) return p;
  }
  return null;
}

export function taskProgress(cwd, fsx = defaultFs) {
  const file = findTasksFile(cwd, fsx);
  if (!file) return null;
  let tasks;
  try { tasks = parseTasks(fsx.readFile(file)); } catch { return null; }
  if (!tasks.length) return null;
  const done = tasks.filter((t) => t.done).length;
  const next = tasks.find((t) => !t.done)?.text ?? null;
  return { file, total: tasks.length, done, next, complete: done === tasks.length };
}
