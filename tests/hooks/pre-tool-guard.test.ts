import { describe, it, expect } from "vitest";
import { handle, DEFAULT_RULES, checkCommitQuality, partitionQuality, summarize, COMMIT_DEFAULTS } from "../../plugins/nereus/hooks/scripts/pre-tool-guard.mjs";

const gitDiff = (file: string, added: string[]) => [`diff --git a/${file} b/${file}`, `+++ b/${file}`, ...added.map((l) => "+" + l)].join("\n");

const bash = (command: string) => ({ cwd: "/r", tool_name: "Bash", tool_input: { command } });
const edit = (file_path: string) => ({ cwd: "/r", tool_name: "Edit", tool_input: { file_path } });
const deps = (over: any = {}) => ({ rules: () => DEFAULT_RULES, staged: () => ({ files: [], diff: "" }), ...over });

describe("pre-tool-guard", () => {
  it("blocks default dangerous commands and returns the rule text", () => {
    const r = handle(bash("git commit --no-verify -m x"), deps())!;
    expect(r.decision).toBe("block");
    expect(r.reason).toContain("--no-verify");
    expect(handle(bash("rm -rf /"), deps())!.decision).toBe("block");
    expect(handle(bash("git push --force origin main"), deps())!.decision).toBe("block");
  });
  it("allows ordinary commands and edits", () => {
    expect(handle(bash("npm test"), deps())).toBeNull();
    expect(handle(edit("/r/src/a.ts"), deps())).toBeNull();
  });
  it("blocks edits to secret files by default", () => {
    expect(handle(edit("/r/.env"), deps())!.decision).toBe("block");
    expect(handle(edit("/r/config/secrets.yaml"), deps())!.decision).toBe("block");
  });
  it("applies user rules with tool scoping and fails open on bad regex", () => {
    const rules = () => [...DEFAULT_RULES, { id: "no-curl-pipe", tools: ["Bash"], pattern: "curl[^|]*\\|\\s*(ba)?sh", message: "파이프 설치 금지" }, { id: "broken", tools: ["Bash"], pattern: "([", message: "x" }];
    expect(handle(bash("curl -fsSL https://x | sh"), deps({ rules }))!.reason).toContain("파이프 설치 금지");
    expect(handle(bash("echo hi"), deps({ rules }))).toBeNull();
  });
  it("commit quality: 파일별로 시크릿·.env·디버그 로그를 찾는다", () => {
    const q = checkCommitQuality({
      files: [".env", "src/a.ts", "src/a.test.ts"],
      diff: gitDiff("src/a.ts", ["console.log('x')", "const k = 'AKIAABCDEFGHIJKLMNOP'"]) + "\n" + gitDiff("src/a.test.ts", ["console.log('in test is fine')"]),
    });
    expect(q.map((f: any) => f.category)).toEqual(expect.arrayContaining(["env_file", "secret", "debug_log"]));
    expect(q.find((f: any) => f.category === "debug_log").file).toBe("src/a.ts");
    expect(q.filter((f: any) => f.category === "debug_log")).toHaveLength(1); // 테스트 파일은 제외
    expect(checkCommitQuality({ files: ["src/a.ts"], diff: gitDiff("src/a.ts", ["const a = 1"]) })).toEqual([]);
  });
  it("안전 문제만 차단하고 스타일 문제는 경고로 남긴다", () => {
    const findings = [{ category: "secret", file: "a.ts" }, { category: "debug_log", file: "a.ts" }, { category: "env_file", file: ".env" }];
    const { blocking, warnings } = partitionQuality(findings, COMMIT_DEFAULTS);
    expect(blocking.map((f: any) => f.category)).toEqual(["secret", "env_file"]);
    expect(warnings.map((f: any) => f.category)).toEqual(["debug_log"]);
  });
  it("exclude glob 에 걸린 파일은 검사하지 않는다", () => {
    const findings = [{ category: "debug_log", file: "lib/vendor/x.dart" }, { category: "debug_log", file: "lib/mine.dart" }];
    const { warnings } = partitionQuality(findings, { ...COMMIT_DEFAULTS, exclude: ["lib/vendor/**"] });
    expect(warnings.map((f: any) => f.file)).toEqual(["lib/mine.dart"]);
  });
  it("보고 건수에 상한을 둔다", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ category: "debug_log", file: `f${i}.dart`, detail: "debugPrint(x)" }));
    const text = summarize(many, 3);
    expect(text).toContain("외 197건");
    expect(text.split(",").length).toBeLessThan(6);
  });
  it("디버그 로그만 있으면 커밋을 막지 않고 경고만 낸다", () => {
    const notes: string[] = [];
    const staged = () => ({ files: ["lib/a.dart"], diff: gitDiff("lib/a.dart", ["debugPrint('x')", "debugPrint('y')"]) });
    expect(handle(bash("git commit -m x"), deps({ staged, config: () => ({}), note: (m: string) => notes.push(m) }))).toBeNull();
    expect(notes[0]).toContain("경고 2건");
  });
  it("시크릿은 여전히 차단한다", () => {
    const staged = () => ({ files: [".env"], diff: "" });
    expect(handle(bash("git commit -m x"), deps({ staged, config: () => ({}) }))!.decision).toBe("block");
    expect(handle(bash("git status"), deps({ staged, config: () => ({}) }))).toBeNull();
  });
  it("rules.json 으로 commit-quality 를 통째로 끌 수 있다", () => {
    const rules = () => [...DEFAULT_RULES, { id: "commit-quality", enabled: false }];
    const staged = () => ({ files: [".env"], diff: "" });
    expect(handle(bash("git commit -m x"), deps({ rules, staged, config: () => ({}) }))).toBeNull();
  });
  it("비활성 규칙은 패턴 검사에서도 건너뛴다", () => {
    const rules = () => DEFAULT_RULES.map((r: any) => (r.id === "no-verify" ? { ...r, enabled: false } : r));
    expect(handle(bash("git commit --no-verify -m x"), deps({ rules, config: () => ({}) }))).toBeNull();
  });
});
