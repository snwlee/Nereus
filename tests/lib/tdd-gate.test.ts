import { describe, it, expect } from "vitest";
import { testStem, findTestFor, tddVerdict } from "../../plugins/nereus/hooks/scripts/lib/tdd-gate.mjs";

describe("testStem", () => {
  it("strips test markers so a test maps back to its source", () => {
    expect(testStem("src/cart.test.ts")).toBe("cart");
    expect(testStem("src/cart.spec.tsx")).toBe("cart");
    expect(testStem("test/cart_test.dart")).toBe("cart");
    expect(testStem("src/test/java/CartTest.java")).toBe("cart");
    expect(testStem("__tests__/cart.ts")).toBe("cart");
    expect(testStem("src/cart.ts")).toBe("cart");
  });
});

describe("findTestFor", () => {
  const files = ["src/cart.ts", "src/cart.test.ts", "src/order.ts", "lib/pay/pay.dart", "test/pay/pay_test.dart"];

  it("finds a sibling test by stem", () => {
    expect(findTestFor("src/cart.ts", files)).toBe("src/cart.test.ts");
  });
  it("finds a test that lives in a separate tree", () => {
    expect(findTestFor("lib/pay/pay.dart", files)).toBe("test/pay/pay_test.dart");
  });
  it("returns null when the source has no test at all", () => {
    expect(findTestFor("src/order.ts", files)).toBeNull();
  });
});

const base = {
  rel: "src/cart.ts",
  enforce: "block" as const,
  runner: { command: "npm test" },
  exclude: [] as string[],
  evidence: { status: "STALE", exitCode: 1, passing: false },
  hasTest: true,
  override: null as string | null,
};

describe("tddVerdict — RED 강제", () => {
  it("allows implementation while a test is failing (RED → GREEN)", () => {
    expect(tddVerdict(base).allow).toBe(true);
  });

  it("blocks new implementation while everything passes and the file has no test", () => {
    const r = tddVerdict({ ...base, evidence: { status: "FRESH", exitCode: 0, passing: true }, hasTest: false });
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/실패하는 테스트/);
  });

  it("allows refactoring an already-tested file while green", () => {
    expect(tddVerdict({ ...base, evidence: { status: "FRESH", exitCode: 0, passing: true }, hasTest: true }).allow).toBe(true);
  });

  it("can forbid even the refactor case when allowRefactor is off", () => {
    const r = tddVerdict({ ...base, evidence: { status: "FRESH", exitCode: 0, passing: true }, hasTest: true, allowRefactor: false });
    expect(r.allow).toBe(false);
  });

  it("blocks when tests were never run — RED cannot be assumed", () => {
    const r = tddVerdict({ ...base, evidence: { status: "MISSING" }, hasTest: false });
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/한 번도/);
  });

  it("stays out of the way for test files themselves", () => {
    expect(tddVerdict({ ...base, rel: "src/cart.test.ts", evidence: { status: "FRESH", exitCode: 0, passing: true }, hasTest: false }).allow).toBe(true);
  });

  it("ignores non-source files", () => {
    for (const rel of ["README.md", "package.json", ".nereus/handoff.md"]) {
      expect(tddVerdict({ ...base, rel, evidence: { status: "FRESH", exitCode: 0, passing: true }, hasTest: false }).allow).toBe(true);
    }
  });
});

describe("tddVerdict — 탈출구", () => {
  const green = { ...base, evidence: { status: "FRESH", exitCode: 0, passing: true }, hasTest: false };

  it("honours tdd.exclude globs", () => {
    expect(tddVerdict({ ...green, exclude: ["**/*.config.*", "src/**"] }).allow).toBe(true);
  });

  it("lets a one-shot override through and reports that it must be consumed", () => {
    const r = tddVerdict({ ...green, override: "벤더 코드 이식" });
    expect(r.allow).toBe(true);
    expect(r.consumeOverride).toBe(true);
    expect(r.via).toBe("override");
  });

  it("never blocks in warn or off mode", () => {
    expect(tddVerdict({ ...green, enforce: "warn" }).allow).toBe(true);
    expect(tddVerdict({ ...green, enforce: "off" }).allow).toBe(true);
  });

  it("does nothing in a project without a test runner", () => {
    expect(tddVerdict({ ...green, runner: null }).allow).toBe(true);
  });

  it("tells the user how to get out when it blocks", () => {
    const r = tddVerdict(green);
    expect(r.allow).toBe(false);
    expect(r.reason).toMatch(/tdd-override|tdd\.enforce/);
  });
});

// 회귀: 게임 스택(.luau/.cs)에서 차단 게이트가 "not-source" 로 빠져 무효였다.
describe("확장 스택 파일 규칙이 차단 게이트에 닿는다", () => {
  const base = { enforce: "block" as const, runner: { command: "lune run tests" }, evidence: { status: "OK", exitCode: 0 }, hasTest: false };

  it("규칙이 없으면 .luau 는 소스가 아니라 통과해 버린다 — 이것이 결함이었다", () => {
    expect(tddVerdict({ ...base, rel: "src/server/Economy.luau" }).via).toBe("not-source");
  });

  it("fileRules 를 주면 .luau 구현 편집을 막는다", () => {
    const v = tddVerdict({ ...base, rel: "src/server/Economy.luau", fileRules: { extraExt: [".luau"] } });
    expect(v.allow).toBe(false);
    expect(v.reason).toContain("Economy.luau");
  });

  it("확장 테스트 패턴에 맞는 파일은 언제나 먼저 쓸 수 있다", () => {
    const v = tddVerdict({ ...base, rel: "src/server/Economy.spec.luau", fileRules: { extraExt: [".luau"], extraTestRe: ["\\.spec\\.luau$"] } });
    expect(v.via).toBe("test-file");
  });
});
