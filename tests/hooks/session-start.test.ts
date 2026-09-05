import { describe, it, expect } from "vitest";
import { handle } from "../../plugins/nereus/hooks/scripts/session-start.mjs";

const deps = (over: any = {}) => ({
  readFile: (p: string) => { const k = p.replace(/\\/g, "/"); if (over.files && k in over.files) return over.files[k]; throw new Error("ENOENT"); },
  exists: (p: string) => { const k = p.replace(/\\/g, "/"); return !!over.files && k in over.files; },
  toolStatus: () => over.tools ?? { missing: [] },
  ...over,
});

describe("session-start hook", () => {
  it("injects handoff.md when present and marks Baton resume", () => {
    const out = handle({ session_id: "s1", cwd: "/r", source: "startup" }, deps({ files: { "/r/.nereus/handoff.md": "# Handoff\n목표: X" } }));
    const ctx = out!.hookSpecificOutput.additionalContext;
    expect(out!.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(ctx).toContain("Baton 재개");
    expect(ctx).toContain("목표: X");
  });
  it("reports missing codegraph index and missing tools", () => {
    const out = handle({ cwd: "/r", source: "startup" }, deps({ files: {}, tools: { missing: ["ooo", "ocr"] } }));
    const ctx = out!.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("codegraph 인덱스 없음");
    expect(ctx).toContain("ooo");
    expect(ctx).toContain("/nereus:setup");
  });
  it("stays quiet on compact source except handoff", () => {
    const out = handle({ cwd: "/r", source: "compact" }, deps({ files: { "/r/.nereus/handoff.md": "H" } }));
    expect(out!.hookSpecificOutput.additionalContext).toContain("H");
    expect(out!.hookSpecificOutput.additionalContext).not.toContain("/nereus:setup");
  });
});
