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
  it("carries the resume checklist so /nereus:resume never has to be typed", () => {
    const out = handle({ session_id: "s1", cwd: "/r", source: "clear" }, deps({ files: { "/r/.nereus/handoff.md": "# Handoff\n목표: X" } }));
    const ctx = out!.hookSpecificOutput.additionalContext;
    // resume 스킬이 하던 검증 단계가 주입에 들어 있어야 사용자가 /clear 한 번만 쳐도 된다.
    expect(ctx).toContain("테스트 상태");   // 러너 재실행 대조
    expect(ctx).toContain("git status");    // 미커밋 변경 확인
    expect(ctx).toContain("열린 질문");     // 작업 전 질문
    expect(ctx).toContain("MUST NOT");      // 실패한 접근 회피
    expect(ctx).toMatch(/따로 칠 필요 없|칠 필요 없/);
  });
  it("skips the resume checklist after a compact, where the conversation already continues", () => {
    const out = handle({ cwd: "/r", source: "compact" }, deps({ files: { "/r/.nereus/handoff.md": "H" } }));
    expect(out!.hookSpecificOutput.additionalContext).not.toContain("git status");
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

describe("session-start hook — 스킬 맵", () => {
  it("startup·clear 에는 스킬 맵을 넣어 스킬을 먼저 부르게 유도한다", () => {
    for (const source of ["startup", "clear", "resume"]) {
      const ctx = handle({ cwd: "/r", source }, deps({ files: {} }))!.hookSpecificOutput.additionalContext;
      expect(ctx).toContain("스킬을 먼저 부른다");
      expect(ctx).toContain("nereus:debug");
    }
  });
  it("compact 에는 넣지 않는다 — 대화가 이어지므로 이미 알고 있다", () => {
    const out = handle({ cwd: "/r", source: "compact" }, deps({ files: { "/r/.nereus/handoff.md": "H" } }));
    expect(out!.hookSpecificOutput.additionalContext).not.toContain("스킬을 먼저 부른다");
  });
});
