import { describe, it, expect } from "vitest";
import { detectHarness, normalizeToolEvent } from "../../plugins/nereus/hooks/scripts/lib/harness.mjs";

const CLAUDE_EDIT = { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "/repo/src/a.ts" }, cwd: "/repo", session_id: "s1", transcript_path: "/tmp/t.jsonl" };
const CODEX_PATCH = `*** Begin Patch
*** Update File: src/a.ts
@@
-old
+new
*** Add File: src/b.ts
+hello
*** End Patch`;

describe("detectHarness", () => {
  it("기본은 claude (하위호환)", () => {
    expect(detectHarness(CLAUDE_EDIT)).toBe("claude");
    expect(detectHarness({})).toBe("claude");
  });
  it("turn_id·model·permission_mode가 있으면 codex", () => {
    expect(detectHarness({ ...CLAUDE_EDIT, turn_id: "t1" })).toBe("codex");
    expect(detectHarness({ hook_event_name: "Stop", model: "gpt-5", cwd: "/r" })).toBe("codex");
    expect(detectHarness({ tool_name: "Bash", permission_mode: "default" })).toBe("codex");
  });
  it("브릿지 명시 마커는 opencode", () => {
    expect(detectHarness({ ...CLAUDE_EDIT, harness: "opencode" })).toBe("opencode");
  });
});

describe("normalizeToolEvent", () => {
  it("claude Edit → files 1개", () => {
    const r = normalizeToolEvent(CLAUDE_EDIT);
    expect(r).toMatchObject({ harness: "claude", tool: "Edit", kind: "edit", files: ["/repo/src/a.ts"], command: null, cwd: "/repo", sessionId: "s1" });
  });
  it("claude Bash → command", () => {
    const r = normalizeToolEvent({ tool_name: "Bash", tool_input: { command: "npm test" }, cwd: "/repo" });
    expect(r).toMatchObject({ kind: "exec", files: [], command: "npm test" });
  });
  it("claude MultiEdit edits 배열도 모은다", () => {
    const r = normalizeToolEvent({ tool_name: "MultiEdit", tool_input: { file_path: "/r/a.ts", edits: [{ file_path: "/r/b.ts" }] } });
    expect(r.files).toEqual(["/r/a.ts", "/r/b.ts"]);
  });
  it("codex apply_patch → patch 헤더에서 파일 목록", () => {
    const r = normalizeToolEvent({ hook_event_name: "PostToolUse", tool_name: "apply_patch", tool_input: { patch: CODEX_PATCH }, cwd: "/repo", turn_id: "t1" });
    expect(r).toMatchObject({ harness: "codex", kind: "edit" });
    expect(r.files).toEqual(["src/a.ts", "src/b.ts"]);
  });
  it("codex Bash → command 그대로", () => {
    const r = normalizeToolEvent({ tool_name: "Bash", tool_input: { command: "cargo test" }, turn_id: "t1" });
    expect(r).toMatchObject({ harness: "codex", kind: "exec", command: "cargo test" });
  });
  it("Delete File 헤더·단수 path 필드도 처리", () => {
    const r = normalizeToolEvent({ tool_name: "apply_patch", tool_input: { patch: "*** Begin Patch\n*** Delete File: old.ts\n*** End Patch" }, turn_id: "t" });
    expect(r.files).toEqual(["old.ts"]);
    const s = normalizeToolEvent({ tool_name: "Write", tool_input: { path: "/r/c.ts" } });
    expect(s.files).toEqual(["/r/c.ts"]);
  });
  it("빈 입력은 빈 결과 (fail-open)", () => {
    expect(normalizeToolEvent({})).toMatchObject({ kind: "other", files: [], command: null });
  });
});
