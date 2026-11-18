import { describe, expect, it, vi } from "vitest";
import { runClaudeReviewer } from "../../plugins/nereus/skills/goldfish/scripts/claude-reviewer.mjs";

describe("Claude review runner", () => {
  it("passes the review prompt through stdin to a fresh read-only Claude session", () => {
    const run = vi.fn(() => ({ ok: true, stdout: "[]\n", stderr: "" }));
    expect(runClaudeReviewer("opus", "Review A.md\n", run)).toBe("[]\n");
    expect(run).toHaveBeenCalledExactlyOnceWith("claude", [
      "--print", "--model", "opus", "--no-session-persistence", "--safe-mode",
      "--strict-mcp-config", "--tools", "Read,Glob,Grep", "--permission-mode", "dontAsk",
    ], { input: "Review A.md\n", timeoutMs: 300_000 });
  });

  it("reports a failed Claude invocation even when it prints a partial result", () => {
    const run = vi.fn(() => ({ ok: false, stdout: "Weekly usage limit reached", stderr: "Sign-in warning" }));
    expect(() => runClaudeReviewer("sonnet", "Review A.md", run)).toThrow("Weekly usage limit reached");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty prompt and an empty result", () => {
    const run = vi.fn(() => ({ ok: true, stdout: "  ", stderr: "" }));
    expect(() => runClaudeReviewer("sonnet", " ", run)).toThrow(/prompt/i);
    expect(run).not.toHaveBeenCalled();
    expect(() => runClaudeReviewer("sonnet", "Review A.md", run)).toThrow(/empty/i);
  });
});
