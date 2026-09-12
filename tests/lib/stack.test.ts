import { describe, it, expect } from "vitest";
import { detectStack, detectTestRunner, isTestFile, isSourceFile } from "../../plugins/nereus/hooks/scripts/lib/stack.mjs";

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
