import { describe, it, expect } from "vitest";
import { handle } from "../../plugins/nereus/hooks/scripts/tdd-guard.mjs";

const mk = (over: any = {}) => {
  let history: string[] = over.history ?? [];
  return {
    deps: {
      runner: () => (over.noRunner ? null : { runner: "vitest", command: "npx vitest run" }),
      config: () => ({ tdd: { exclude: ["**/migrations/**", "**/*.config.*"] } }),
      loadHistory: () => history,
      saveHistory: (h: string[]) => { history = h; },
      get history() { return history; },
    },
  };
};
const edit = (file: string) => ({ session_id: "s", cwd: "/r", tool_name: "Edit", tool_input: { file_path: `/r/${file}` } });

describe("tdd-guard hook", () => {
  it("warns when a source file is edited before any test file in the session", () => {
    const { deps } = mk();
    const out = handle(edit("src/user.ts"), deps)!;
    expect(out.hookSpecificOutput.additionalContext).toContain("TDD");
    expect(out.hookSpecificOutput.additionalContext).toContain("npx vitest run");
  });
  it("stays silent when a test file was edited earlier in the session", () => {
    const { deps } = mk();
    expect(handle(edit("src/user.test.ts"), deps)).toBeNull();
    expect(handle(edit("src/user.ts"), deps)).toBeNull();
    expect(deps.history.length).toBe(2);
  });
  it("ignores non-source, excluded files and projects without a runner", () => {
    expect(handle(edit("README.md"), mk().deps)).toBeNull();
    expect(handle(edit("src/db/migrations/1.ts"), mk().deps)).toBeNull();
    expect(handle(edit("vitest.config.ts"), mk().deps)).toBeNull();
    expect(handle(edit("src/user.ts"), mk({ noRunner: true }).deps)).toBeNull();
  });
  it("warns only once per source file", () => {
    const { deps } = mk();
    expect(handle(edit("src/a.ts"), deps)).not.toBeNull();
    expect(handle(edit("src/a.ts"), deps)).toBeNull();
    expect(handle(edit("src/b.ts"), deps)).not.toBeNull();
  });
});
