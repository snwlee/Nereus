// 로블록스(Rojo + Luau) 프로젝트의 스택·테스트러너 판정.
//
// 러너를 못 찾으면 null 을 돌려준다. 명령을 지어내지 않는다 —
// 없는 러너를 있다고 하면 TDD 게이트가 매번 실패하고, 그러면 게이트를 꺼버리게 된다.
//
// 2단 구조의 1단만 여기서 판정한다(lune = 로컬 단위테스트).
// 2단(Open Cloud Luau Execution = 실런타임 통합테스트)은 finish 게이트의 몫이라
// 편집마다 업로드가 필요한 이 경로에 넣지 않는다.
import fs from "node:fs";
import path from "node:path";

const defaultFs = {
  exists: (p) => fs.existsSync(p),
  readFile: (p) => fs.readFileSync(p, "utf8"),
};

export const ROJO_PROJECT = "default.project.json";

/** Rojo 프로젝트 파일이 있으면 로블록스 스택이다. */
export function isRobloxProject(cwd, fsx = defaultFs) {
  return fsx.exists(path.join(cwd, ROJO_PROJECT));
}

/**
 * 로블록스 테스트 러너를 판정한다.
 * @returns {{ runner: string, command: string } | null}
 */
export function detectRobloxRunner(cwd, fsx = defaultFs) {
  if (!isRobloxProject(cwd, fsx)) return null;
  const has = (f) => fsx.exists(path.join(cwd, f));
  if (has("lune.yaml") || has("lune")) return { runner: "lune", command: "lune run tests" };
  return null;
}
