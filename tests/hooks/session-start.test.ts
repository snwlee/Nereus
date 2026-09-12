import { describe, it, expect } from "vitest";
import { handle } from "../../plugins/nereus/hooks/scripts/session-start.mjs";

const deps = (over: any = {}) => ({
  readFile: (p: string) => { const k = p.replace(/\\/g, "/"); if (over.files && k in over.files) return over.files[k]; throw new Error("ENOENT"); },
  exists: (p: string) => { const k = p.replace(/\\/g, "/"); return !!over.files && k in over.files; },
  toolStatus: () => over.tools ?? { missing: [] },
  entries: over.entries ?? (() => []),
  removeFile: over.removeFile ?? (() => {}),
  now: over.now ?? (() => Date.now()),
  env: over.env ?? {},
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

const MIN = 60_000;
describe("session-start handoff ownership", () => {
  it("tells this session which handoff file it owns", () => {
    const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({ entries: () => [], now: () => new Date("2026-09-12T14:30:00").getTime() }));
    const ctx = out!.hookSpecificOutput.additionalContext;
    expect(ctx).toContain(".nereus/handoff/20260912-1430-a1b2c3d4.md");
    expect(ctx).toContain("여기에만");
  });
  it("injects the newest handoff from the session directory", () => {
    const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "clear" }, deps({
      files: { "/r/.nereus/handoff/20260912-0900-99999999.md": "# Handoff\n목표: 이전 세션" },
      entries: () => [{ name: "20260912-0900-99999999.md", mtimeMs: Date.now() - 90 * MIN }],
    }));
    expect(out!.hookSpecificOutput.additionalContext).toContain("목표: 이전 세션");
  });
  it("still reads the legacy single file when the directory is empty", () => {
    const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "clear" }, deps({
      files: { "/r/.nereus/handoff.md": "# Handoff\n목표: 레거시" },
      entries: () => [],
    }));
    expect(out!.hookSpecificOutput.additionalContext).toContain("목표: 레거시");
  });
  it("warns when another session touched its handoff within 30 minutes", () => {
    const now = Date.now();
    const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({
      files: { "/r/.nereus/handoff/20260912-1400-bbbbbbbb.md": "# Handoff\n\n## 목표\nSEO 스킬 정리" },
      entries: () => [{ name: "20260912-1400-bbbbbbbb.md", mtimeMs: now - 5 * MIN }],
      now: () => now,
    }));
    const ctx = out!.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("최근 30분");   // 경고 블록의 표식
    expect(ctx).toContain("20260912-1400-bbbbbbbb.md");
    expect(ctx).toContain("SEO 스킬 정리"); // 그 문서의 목표 한 줄
  });
  it("stays quiet about other sessions inside a loop subsession", () => {
    const now = Date.now();
    const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({
      files: { "/r/.nereus/handoff/20260912-1400-bbbbbbbb.md": "# Handoff\n목표: x" },
      entries: () => [{ name: "20260912-1400-bbbbbbbb.md", mtimeMs: now - 5 * MIN }],
      now: () => now,
      env: { NEREUS_LOOP: "1" },
    }));
    // "다른 세션"은 경로 안내문에도 들어간다. 경고 블록의 표식으로 가린다.
    expect(out!.hookSpecificOutput.additionalContext).not.toContain("최근 30분");
  });
  it("prunes stale handoffs without touching the injected or owned file", () => {
    const now = Date.now();
    const removed: string[] = [];
    const entries = Array.from({ length: 12 }, (_, i) => ({ name: `20260901-09${String(i).padStart(2, "0")}-s${i}aaaaaa`.slice(0, 22) + ".md", mtimeMs: now - i * MIN }));
    handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({ entries: () => entries, now: () => now, removeFile: (p: string) => removed.push(p) }));
    expect(removed).toHaveLength(2);
    expect(removed.every((p) => p.replace(/\\/g, "/").includes("/r/.nereus/handoff/"))).toBe(true);
  });
});
