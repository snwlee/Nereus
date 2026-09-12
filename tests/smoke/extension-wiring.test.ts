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

// 회귀(2026-09-12, 실제 로블록스 리그에서 발견): 확장 스택이 러너를 선언해도 코어가
// 그 언어의 확장자를 몰라 tdd-guard/tdd-gate 가 "소스가 아님"으로 빠졌다.
// 게임 스택에서 TDD 강제가 **한 번도 발동할 수 없는** 상태였고, 픽스처 검증만 해서 못 봤다.
describe("확장 스택 파일 규칙 배선", () => {
  it("tdd-guard 가 stackFileRules 를 계산해 소스·테스트 판정에 넘긴다", () => {
    const src = read("plugins/nereus/hooks/scripts/tdd-guard.mjs");
    expect(src).toContain("stackFileRules");
    expect(src).toMatch(/isSourceFile\(rel,\s*fileRules\)/);
    expect(src).toMatch(/isTestFile\(rel,\s*fileRules\)/);
  });

  it("pre-tool-guard 가 차단 판정에 fileRules 를 넘긴다", () => {
    const src = read("plugins/nereus/hooks/scripts/pre-tool-guard.mjs");
    expect(src).toContain("stackFileRules");
    expect(src).toMatch(/fileRules,/);
    expect(src).toMatch(/findTestFor\(rel, files, fileRules\)/);
  });

  it("tdd-gate 가 fileRules 를 실제로 판정에 쓴다 — 받기만 하면 배선이 아니다", () => {
    const src = read("plugins/nereus/hooks/scripts/lib/tdd-gate.mjs");
    expect(src).toMatch(/isSourceFile\(rel,\s*fileRules\)/);
    expect(src).toMatch(/isTestFile\(rel,\s*fileRules\)/);
  });

  it("러너를 선언한 게임 스택은 소스 확장자도 선언한다 — 하나만 있으면 게이트가 무효다", () => {
    const decl = JSON.parse(read("plugins/nereus-game/nereus-extension.json"));
    const withRunner = decl.stacks.filter((s: any) => s.runner);
    expect(withRunner.length).toBeGreaterThan(0);
    for (const st of withRunner) {
      expect(Array.isArray(st.sourceExt) && st.sourceExt.length > 0).toBe(true);
    }
  });

  it("선언된 테스트 정규식은 전부 컴파일된다", () => {
    const decl = JSON.parse(read("plugins/nereus-game/nereus-extension.json"));
    for (const st of decl.stacks) for (const r of st.testRe ?? []) expect(() => new RegExp(r)).not.toThrow();
  });
});
