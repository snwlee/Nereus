import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { classify } from "../../plugins/nereus/skills/spec/scripts/classify.mjs";
import { detectStack, detectTestRunner } from "../../plugins/nereus/hooks/scripts/lib/stack.mjs";
import { handle as tddGuard } from "../../plugins/nereus/hooks/scripts/tdd-guard.mjs";
import { handle as sessionStart } from "../../plugins/nereus/hooks/scripts/session-start.mjs";

const mk = (name: string, files: Record<string, string>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `nereus-${name}-`));
  for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), c); }
  return dir;
};
let flutter: string, spring: string, node: string;
beforeAll(() => {
  flutter = mk("flutter", { "pubspec.yaml": "name: app\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n", "lib/main.dart": "void main(){}" });
  spring = mk("spring", { "build.gradle.kts": "", "gradlew": "", "src/main/java/App.java": "class App{}" });
  node = mk("node", { "package.json": '{"scripts":{"test":"vitest run"}}', "src/index.ts": "export const a = 1;" });
});
afterAll(() => { for (const d of [flutter, spring, node]) fs.rmSync(d, { recursive: true, force: true }); });

describe("smoke: three stacks", () => {
  it("detects stack and runner per fixture", () => {
    expect(detectStack(flutter)).toEqual(["flutter"]); expect(detectTestRunner(flutter)?.command).toBe("flutter test");
    expect(detectStack(spring)).toEqual(["spring"]); expect(detectTestRunner(spring)?.command).toBe("./gradlew test");
    expect(detectStack(node)).toEqual(["node"]); expect(detectTestRunner(node)?.command).toBe("npm test");
  });
  it("classifies fresh fixtures as greenfield (no git history)", () => {
    for (const d of [flutter, spring, node]) expect(classify(d).kind).toBe("greenfield");
  });
  it("tdd-guard warns on source-first edit in every stack and stays quiet after a test edit", () => {
    const cases = [[flutter, "lib/foo.dart", "test/foo_test.dart"], [spring, "src/main/java/Foo.java", "src/test/java/FooTest.java"], [node, "src/foo.ts", "src/foo.test.ts"]];
    for (const [dir, src, test] of cases) {
      const sid = path.basename(dir);
      expect(tddGuard({ session_id: sid, cwd: dir, tool_name: "Edit", tool_input: { file_path: path.join(dir, src) } })).not.toBeNull();
      expect(tddGuard({ session_id: sid + "b", cwd: dir, tool_name: "Edit", tool_input: { file_path: path.join(dir, test) } })).toBeNull();
      expect(tddGuard({ session_id: sid + "b", cwd: dir, tool_name: "Edit", tool_input: { file_path: path.join(dir, src) } })).toBeNull();
    }
  });
  it("session-start injects handoff written into a fixture", () => {
    fs.mkdirSync(path.join(node, ".nereus"), { recursive: true });
    fs.writeFileSync(path.join(node, ".nereus", "handoff.md"), "# Handoff\n목표: 스모크");
    const out = sessionStart({ cwd: node, source: "compact" }, { toolStatus: () => ({ missing: [] }) })!;
    expect(out.hookSpecificOutput.additionalContext).toContain("목표: 스모크");
  });
});
