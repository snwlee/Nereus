import { describe, it, expect } from "vitest";
import { parseHookInput, contextPayload, blockPayload } from "../../plugins/nereus/hooks/scripts/lib/io.mjs";

describe("io", () => {
  it("parses hook stdin JSON and tolerates empty or invalid input", () => {
    expect(parseHookInput('{"session_id":"s","cwd":"/r"}')).toEqual({ session_id: "s", cwd: "/r" });
    expect(parseHookInput("")).toEqual({});
    expect(parseHookInput("garbage")).toEqual({});
  });
  it("builds Claude Code context and block payloads", () => {
    expect(contextPayload("SessionStart", "hi")).toEqual({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "hi" } });
    expect(blockPayload("do x", "note")).toEqual({ decision: "block", reason: "do x", systemMessage: "note" });
    expect(blockPayload("do x")).toEqual({ decision: "block", reason: "do x" });
  });
});
