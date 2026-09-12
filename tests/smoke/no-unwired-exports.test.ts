// 회귀: "export 했는데 밖에서 아무도 안 쓰는 것"이 이 프로젝트에서 반복해 나왔다
// (미배선 확장점 · dangling route · isUnityProject · 마커 상수 4종).
// export 는 계약이고, 아무도 쓰지 않는 계약은 유지 비용만 남기며 배선 착각을 만든다.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// 2026-09-12: 코어까지 넓혔다. 넓히자마자 고아 25건이 걸렸고(내부 전용 23 + 죽은 데이터 2),
// 그때까지 MUST NOT 1번("선언하고 배선하지 않는 것")이 코어에서는 가드되지 않는 상태였다.
const ROOTS = [
  "plugins/nereus-game/lib",
  "plugins/nereus-game/hooks/scripts",
  "plugins/nereus/hooks/scripts",
  "plugins/nereus/skills",
];
const SEARCH = ["plugins/nereus", "plugins/nereus-game", "tests"];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

// **코드 파일에서의 참조만 인정한다.** SKILL.md 에 이름을 적는 것만으로는 배선이 아니다 —
// 실제로 그 판정을 놓쳐서 실행 진입점 없는 export 두 개가 이 검사를 통과했다.
const CODE = /\.(mjs|cjs|js|ts|tsx)$/;
const corpus = SEARCH.flatMap(walk).filter((f) => CODE.test(f));

function referencedOutside(name: string, self: string): boolean {
  return corpus.some((f) => f !== self && fs.readFileSync(f, "utf8").includes(name));
}

// 모듈 자신의 실행 진입점(main 가드 이후)에서 쓰는 것도 정당한 배선이다.
// 밖에서만 찾으면 CLI 전용 export 를 고아로 오판한다.
const MAIN_GUARD = /if \(process\.argv\[1\]/;
function usedInMainBlock(src: string, name: string): boolean {
  const m = src.match(MAIN_GUARD);
  return m ? src.slice(m.index ?? 0).includes(name) : false;
}

describe("unwired export 금지", () => {
  it("모든 export 가 자기 파일 밖에서 참조된다", () => {
    const orphans: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root).filter((f) => f.endsWith(".mjs"))) {
        const src = fs.readFileSync(file, "utf8");
        for (const m of src.matchAll(/^export (?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm)) {
          if (!referencedOutside(m[1], file) && !usedInMainBlock(src, m[1])) orphans.push(`${m[1]} (${file})`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });
});

// 회귀: planRunners 는 probe 주입구를 갖고도 프로덕션 진입점이 probe 없이 불러
// "헬스체크가 있다"는 착각만 남아 있었다 (2026-09-12 에 발견). 주입구는 배선까지가 한 벌이다.
describe("리뷰어 헬스체크 배선", () => {
  const SRC = "plugins/nereus/skills/review/scripts/review.mjs";
  const src = fs.readFileSync(SRC, "utf8");

  it("실행 진입점이 planRunners 에 실제 프로브를 넘긴다", () => {
    const main = src.slice(src.search(/if \(process\.argv\[1\]/));
    expect(main).toMatch(/planRunners\([^)]*makeProbe\(\)/);
  });

  it("agy 프로브는 json 으로 받는다 — text 는 429 를 삼킨다", () => {
    expect(src).toMatch(/--output-format["'\s,]+["']json["']/);
  });

  it("codex 프로브는 저장소 밖에서도 거부당하지 않게 git 체크를 건너뛴다", () => {
    expect(src).toContain("--skip-git-repo-check");
  });
});
