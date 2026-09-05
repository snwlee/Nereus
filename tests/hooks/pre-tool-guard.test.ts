import { describe, it, expect } from "vitest";
import { handle, DEFAULT_RULES, checkCommitQuality } from "../../plugins/nereus/hooks/scripts/pre-tool-guard.mjs";

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
  it("commit quality: blocks staged secrets, .env, and console.log in source", () => {
    const q = checkCommitQuality({ files: [".env", "src/a.ts", "src/a.test.ts"], diff: "+console.log('x')\n+const k = 'AKIAABCDEFGHIJKLMNOP'\n+-----BEGIN PRIVATE KEY-----" });
    expect(q.map((f: any) => f.category)).toEqual(expect.arrayContaining(["env_file", "secret", "debug_log"]));
    expect(checkCommitQuality({ files: ["src/a.ts"], diff: "+const a = 1" })).toEqual([]);
  });
  it("runs commit quality only for git commit commands", () => {
    const staged = () => ({ files: [".env"], diff: "" });
    expect(handle(bash("git commit -m 'x'"), deps({ staged }))!.decision).toBe("block");
    expect(handle(bash("git status"), deps({ staged }))).toBeNull();
  });
});
