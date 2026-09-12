import { describe, it, expect } from "vitest";
import { detectStack, detectTestRunner, isTestFile, isSourceFile, stackFileRules } from "../../plugins/nereus/hooks/scripts/lib/stack.mjs";

const fsOf = (files: Record<string, string>) => ({
  exists: (p: string) => p.replace(/\\/g, "/") in files,
  readFile: (p: string) => files[p.replace(/\\/g, "/")] ?? (() => { throw new Error("ENOENT"); })(),
});

describe("stack detection", () => {
  it("detects flutter, spring(gradle/maven) and node", () => {
    expect(detectStack("/r", fsOf({ "/r/pubspec.yaml": "name: app\ndependencies:\n  flutter:\n    sdk: flutter" }))).toEqual(["flutter"]);
    expect(detectStack("/r", fsOf({ "/r/build.gradle.kts": "" }))).toEqual(["spring"]);
    expect(detectStack("/r", fsOf({ "/r/pom.xml": "" }))).toEqual(["spring"]);
    expect(detectStack("/r", fsOf({ "/r/package.json": "{}" }))).toEqual(["node"]);
    expect(detectStack("/r", fsOf({}))).toEqual([]);
  });
  it("finds test runners per stack", () => {
    expect(detectTestRunner("/r", fsOf({ "/r/pubspec.yaml": "dev_dependencies:\n  flutter_test:\n    sdk: flutter" }))).toEqual({ runner: "flutter_test", command: "flutter test" });
    expect(detectTestRunner("/r", fsOf({ "/r/gradlew": "" }))).toEqual({ runner: "gradle", command: "./gradlew test" });
    expect(detectTestRunner("/r", fsOf({ "/r/pom.xml": "" }))).toEqual({ runner: "maven", command: "mvn test" });
    expect(detectTestRunner("/r", fsOf({ "/r/package.json": '{"scripts":{"test":"vitest run"}}' }))).toEqual({ runner: "npm", command: "npm test" });
    expect(detectTestRunner("/r", fsOf({ "/r/package.json": "{}", "/r/vitest.config.ts": "" }))).toEqual({ runner: "vitest", command: "npx vitest run" });
    expect(detectTestRunner("/r", fsOf({ "/r/package.json": "{}", "/r/jest.config.js": "" }))).toEqual({ runner: "jest", command: "npx jest" });
    expect(detectTestRunner("/r", fsOf({ "/r/package.json": "{}" }))).toBeNull();
    expect(detectTestRunner("/r", fsOf({ "/r/pubspec.yaml": "name: x" }))).toBeNull();
  });
  it("classifies test vs source files across stacks", () => {
    expect(isTestFile("lib/foo_test.dart")).toBe(true);
    expect(isTestFile("test/widget_test.dart")).toBe(true);
    expect(isTestFile("src/test/java/com/x/FooTest.java")).toBe(true);
    expect(isTestFile("src/foo.test.ts")).toBe(true);
    expect(isTestFile("src/__tests__/foo.ts")).toBe(true);
    expect(isTestFile("tests/lib/a.spec.js")).toBe(true);
    expect(isTestFile("src/foo.ts")).toBe(false);
    expect(isSourceFile("src/foo.ts")).toBe(true);
    expect(isSourceFile("lib/a.dart")).toBe(true);
    expect(isSourceFile("src/main/java/A.java")).toBe(true);
    expect(isSourceFile("README.md")).toBe(false);
    expect(isSourceFile("package.json")).toBe(false);
    expect(isSourceFile("src/db/migrations/001.sql")).toBe(false);
  });
});

describe("확장 스택 병합", () => {
  it("확장 스택 마커를 인식한다", () => {
    const fsx = { exists: (p: string) => p.endsWith("default.project.json"), readFile: () => "" };
    const extraStacks = [{ name: "roblox", marker: "default.project.json" }];
    expect(detectStack("/proj", fsx, { extraStacks })).toContain("roblox");
  });

  it("코어 스택이 확장보다 앞에 온다", () => {
    const fsx = { exists: () => true, readFile: () => "{}" };
    const extraStacks = [{ name: "roblox", marker: "default.project.json" }];
    const out = detectStack("/proj", fsx, { extraStacks });
    expect(out.indexOf("flutter")).toBeLessThan(out.indexOf("roblox"));
  });
});

describe("확장 러너 연결", () => {
  it("확장 스택의 러너를 코어가 돌려준다", () => {
    const fsx = { exists: (p: string) => p.endsWith("default.project.json") || p.endsWith("lune.yaml"), readFile: () => "" };
    const extraStacks = [{
      name: "roblox",
      marker: "default.project.json",
      runnerMarker: "lune.yaml",
      runner: "lune",
      command: "lune run tests",
    }];
    expect(detectTestRunner("/proj", fsx, { extraStacks })).toEqual({ runner: "lune", command: "lune run tests" });
  });

  it("코어 러너가 확장보다 우선한다", () => {
    const fsx = {
      exists: (p: string) => p.endsWith("pubspec.yaml") || p.endsWith("default.project.json") || p.endsWith("lune.yaml"),
      readFile: () => "flutter_test:",
    };
    const extraStacks = [{ name: "roblox", marker: "default.project.json", runnerMarker: "lune.yaml", runner: "lune", command: "lune run tests" }];
    expect(detectTestRunner("/proj", fsx, { extraStacks }).runner).toBe("flutter_test");
  });

  it("러너 마커가 없으면 확장도 null", () => {
    const fsx = { exists: (p: string) => p.endsWith("default.project.json"), readFile: () => "" };
    const extraStacks = [{ name: "roblox", marker: "default.project.json", runnerMarker: "lune.yaml", runner: "lune", command: "lune run tests" }];
    expect(detectTestRunner("/proj", fsx, { extraStacks })).toBeNull();
  });
});

// 회귀(2026-09-12, 실제 로블록스 리그에서 발견): 코어의 SOURCE_EXT 가 .luau/.lua/.cs 를 몰라
// 게임 스택에서는 tdd-guard 도 tdd-gate 도 "소스가 아님"으로 빠져 **한 번도 발동할 수 없었다**.
// 게임 하네스는 TDD 강제를 선언했지만 게임 소스에 대해 전부 무효였다 — 픽스처 검증만 해서 못 봤다.
// 확장자 목록은 코어에 박지 않는다. 확장이 데이터로 준다.
describe("확장 스택이 소스·테스트 인식을 데이터로 넓힌다", () => {
  it("확장자를 주면 그 파일을 소스로 인정한다", () => {
    expect(isSourceFile("src/server/Economy.luau")).toBe(false);
    expect(isSourceFile("src/server/Economy.luau", { extraExt: [".luau"] })).toBe(true);
    expect(isSourceFile("Assets/Scripts/Player.cs", { extraExt: [".cs"] })).toBe(true);
  });

  it("기존 확장자는 그대로 인정된다 — 기본 인자는 계약을 바꾸지 않는다", () => {
    expect(isSourceFile("src/a.ts")).toBe(true);
    expect(isSourceFile("src/a.ts", { extraExt: [".luau"] })).toBe(true);
    expect(isSourceFile("src/a.txt", { extraExt: [".luau"] })).toBe(false);
  });

  it("생성물 제외 규칙은 확장 확장자에도 적용된다", () => {
    expect(isSourceFile("generated/Proto.cs", { extraExt: [".cs"] })).toBe(false);
  });

  it("테스트 패턴을 주면 그 파일을 테스트로 인정한다", () => {
    expect(isTestFile("src/server/Economy.spec.luau")).toBe(false);
    expect(isTestFile("src/server/Economy.spec.luau", { extraTestRe: ["\\.spec\\.luau$"] })).toBe(true);
    expect(isTestFile("Assets/Tests/PlayerTests.cs", { extraTestRe: ["(^|/)Tests/"] })).toBe(true);
  });

  it("컴파일되지 않는 패턴은 버린다 — 확장이 코어를 죽이면 안 된다", () => {
    expect(isTestFile("a/b.luau", { extraTestRe: ["([bad"] })).toBe(false);
  });

  it("스택 선언에서 파일 규칙을 모은다", () => {
    const rules = stackFileRules([
      { name: "roblox", sourceExt: [".luau", ".lua"], testRe: ["\\.spec\\.luau$"] },
      { name: "unity", sourceExt: [".cs"] },
      { name: "none" },
    ]);
    expect(rules.extraExt).toEqual([".luau", ".lua", ".cs"]);
    expect(rules.extraTestRe).toEqual(["\\.spec\\.luau$"]);
  });

  it("스택이 없으면 빈 규칙이다", () => {
    expect(stackFileRules([])).toEqual({ extraExt: [], extraTestRe: [] });
    expect(stackFileRules(undefined)).toEqual({ extraExt: [], extraTestRe: [] });
  });
});

// codex 2차 의견(2026-09-12):
//  [HIGH]   모든 로드된 스택 규칙을 합치면 이 프로젝트에 없는 스택의 테스트 패턴까지 인정돼
//           동명 타 언어 테스트가 게이트를 우회할 수 있다 → 감지된 스택으로 좁힌다.
//  [MEDIUM] 빈 문자열 sourceExt 는 endsWith("") 가 항상 참이라 모든 파일을 소스로 만든다.
describe("파일 규칙의 범위와 방어", () => {
  it("빈 문자열 확장자는 버린다 — 하나가 모든 파일을 소스로 만든다", () => {
    expect(isSourceFile("README.md", { extraExt: [""] })).toBe(false);
    expect(stackFileRules([{ name: "x", sourceExt: ["", ".cs"] }]).extraExt).toEqual([".cs"]);
  });

  it("빈 문자열 테스트 정규식도 버린다", () => {
    expect(isTestFile("src/a.luau", { extraTestRe: [""] })).toBe(false);
    expect(stackFileRules([{ name: "x", testRe: [""] }]).extraTestRe).toEqual([]);
  });

  it("감지된 스택으로만 규칙을 좁힌다", () => {
    const stacks = [
      { name: "roblox", marker: "default.project.json", sourceExt: [".luau"], testRe: ["\\.spec\\.luau$"] },
      { name: "unity", marker: "ProjectSettings/ProjectVersion.txt", sourceExt: [".cs"], testRe: ["Tests?\\.cs$"] },
    ];
    const fsx = { exists: (p: string) => p.endsWith("default.project.json"), readFile: () => "" };
    const rules = stackFileRules(stacks, { cwd: "/game", fsx });
    expect(rules.extraExt).toEqual([".luau"]);
    expect(rules.extraTestRe).toEqual(["\\.spec\\.luau$"]);
  });

  it("범위를 주지 않으면 전부 합친다 — 기존 호출부 계약은 그대로다", () => {
    const stacks = [{ name: "a", sourceExt: [".luau"] }, { name: "b", sourceExt: [".cs"] }];
    expect(stackFileRules(stacks).extraExt).toEqual([".luau", ".cs"]);
  });
});
