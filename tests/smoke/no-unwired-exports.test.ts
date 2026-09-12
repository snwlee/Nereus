// 회귀: "export 했는데 밖에서 아무도 안 쓰는 것"이 이 프로젝트에서 반복해 나왔다
// (미배선 확장점 · dangling route · isUnityProject · 마커 상수 4종).
// export 는 계약이고, 아무도 쓰지 않는 계약은 유지 비용만 남기며 배선 착각을 만든다.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["plugins/nereus-game/lib", "plugins/nereus-game/hooks/scripts"];
const SEARCH = ["plugins/nereus-game", "tests"];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const corpus = SEARCH.flatMap(walk);

function referencedOutside(name: string, self: string): boolean {
  return corpus.some((f) => f !== self && fs.readFileSync(f, "utf8").includes(name));
}

describe("unwired export 금지", () => {
  it("모든 export 가 자기 파일 밖에서 참조된다", () => {
    const orphans: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root).filter((f) => f.endsWith(".mjs"))) {
        const src = fs.readFileSync(file, "utf8");
        for (const m of src.matchAll(/^export (?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm)) {
          if (!referencedOutside(m[1], file)) orphans.push(`${m[1]} (${file})`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });
});
