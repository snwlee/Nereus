// 회귀: "확장점을 만들고 아무 데서도 호출하지 않는" 결함(리뷰 H1)을 막는다.
// 단위 테스트가 초록인 채로 프로덕션에서 죽어 있었기 때문에, 호출부 자체를 검사한다.
import { describe, it, expect } from "vitest";
import fs from "node:fs";

const read = (p: string) => fs.readFileSync(p, "utf8");
const S = "plugins/nereus/hooks/scripts";

describe("확장 배선", () => {
  it("라우팅 호출부가 extraRoutes 를 넘긴다", () => {
    expect(read(`${S}/skill-router.mjs`)).toMatch(/routePrompt\([^)]*extraRoutes/s);
    expect(read(`${S}/session-start.mjs`)).toMatch(/skillMapBlock\(\{\s*extraRoutes/s);
  });

  it("스택 호출부가 extraStacks 를 넘긴다", () => {
    for (const f of [`${S}/tdd-guard.mjs`, `${S}/pre-tool-guard.mjs`, "plugins/nereus/skills/build/scripts/run-tests.mjs"]) {
      expect(read(f), f).toMatch(/detectTestRunner\([^;]*extraStacks/s);
    }
  });

  it("확장을 쓰는 파일은 loadExtensions 를 import 한다", () => {
    for (const f of [
      `${S}/skill-router.mjs`,
      `${S}/session-start.mjs`,
      `${S}/tdd-guard.mjs`,
      `${S}/pre-tool-guard.mjs`,
      "plugins/nereus/skills/build/scripts/run-tests.mjs",
    ]) {
      expect(read(f), f).toContain("loadExtensions");
    }
  });
});
