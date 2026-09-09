import { describe, it, expect } from "vitest";
import { toClaudeInput, extractGuidance, appendGuidance, EDIT_TOOLS } from "../../.opencode/plugins/nereus-hooks.js";

describe("opencode bridge mapping", () => {
  it("bash → Bash + command", () => {
    const r = toClaudeInput({ tool: "bash", sessionID: "s1", args: { command: "npm test" }, cwd: "/r" });
    expect(r).toMatchObject({ hook_event_name: "PreToolUse", tool_name: "Bash", harness: "opencode", cwd: "/r", session_id: "s1" });
    expect(r.tool_input).toEqual({ command: "npm test" });
  });
  it("write/edit → Edit + file_path (filePath·file_path 둘 다 흡수)", () => {
    expect(toClaudeInput({ tool: "write", sessionID: "s", args: { filePath: "/r/a.ts" }, cwd: "/r" }).tool_input).toEqual({ file_path: "/r/a.ts" });
    expect(toClaudeInput({ tool: "edit", sessionID: "s", args: { file_path: "/r/b.ts" }, cwd: "/r" }).tool_input).toEqual({ file_path: "/r/b.ts" });
  });
  it("그 외 도구는 null (fail-open)", () => {
    expect(toClaudeInput({ tool: "read", sessionID: "s", args: {}, cwd: "/r" })).toBeNull();
    expect(toClaudeInput({ tool: "task", sessionID: "s", args: {}, cwd: "/r" })).toBeNull();
  });
  it("편집 도구 집합에 write·edit가 있다", () => {
    expect(EDIT_TOOLS.has("write")).toBe(true);
    expect(EDIT_TOOLS.has("edit")).toBe(true);
  });
  it("tdd-guard JSON 출력에서 guidance를 뽑는다", () => {
    const out = JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "[TDD] a.ts 경고" } });
    expect(extractGuidance(out)).toBe("[TDD] a.ts 경고");
    expect(extractGuidance("not json")).toBeNull();
    expect(extractGuidance(JSON.stringify({ decision: "block" }))).toBeNull();
  });
  it("guidance를 output에 <context_guidance>로 덧붙인다", () => {
    const output: any = { output: "done" };
    appendGuidance(output, "[TDD] 경고");
    expect(output.output).toContain("<context_guidance>");
    expect(output.output).toContain("[TDD] 경고");
    const empty: any = { output: "done" };
    appendGuidance(empty, null);
    expect(empty.output).toBe("done");
  });
});
