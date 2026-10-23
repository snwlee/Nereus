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

const LOOP = { NEREUS_LOOP: "1" };

describe("session-start hook", () => {
  it("never injects a handoff into an interactive session — context is left to auto-compact", () => {
    for (const source of ["startup", "clear", "resume", "compact"]) {
      const out = handle({ session_id: "s1", cwd: "/r", source }, deps({
        files: { "/r/.nereus/handoff.md": "# Handoff\n목표: X", "/r/.nereus/handoff/20260912-0900-99999999.md": "# Handoff\n목표: Y" },
        entries: () => [{ name: "20260912-0900-99999999.md", mtimeMs: Date.now() }],
      }));
      const ctx = out?.hookSpecificOutput?.additionalContext ?? "";
      expect(ctx).not.toContain("목표: X");
      expect(ctx).not.toContain("목표: Y");
      expect(ctx).not.toContain("handoff");
    }
  });
  it("injects the previous iteration's handoff inside a loop subsession", () => {
    const out = handle({ session_id: "s1", cwd: "/r", source: "startup" }, deps({ files: { "/r/.nereus/handoff.md": "# Handoff\n목표: X" }, env: LOOP }));
    const ctx = out!.hookSpecificOutput.additionalContext;
    expect(out!.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(ctx).toContain("목표: X");
  });
  it("reports missing codegraph index and missing tools", () => {
    const out = handle({ cwd: "/r", source: "startup" }, deps({ files: {}, tools: { missing: ["ooo", "ocr"] } }));
    const ctx = out!.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("codegraph 인덱스 없음");
    expect(ctx).toContain("ooo");
    expect(ctx).toContain("/nereus:setup");
  });
  it("flags an unset or late auto-compact threshold — it is the only context guard now", () => {
    const ctxOf = (env: any, input: any = {}) => handle({ cwd: "/r", source: "startup", ...input }, deps({ files: {}, env }))!.hookSpecificOutput.additionalContext;
    expect(ctxOf({})).toContain("자동 압축");
    expect(ctxOf({ CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "80" })).toContain("80%");
    expect(ctxOf({ CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "50" })).not.toContain("자동 압축");
    // 일부러 더 일찍 압축하게 정한 값은 존중한다.
    expect(ctxOf({ CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "40" })).not.toContain("자동 압축");
    // Codex·OpenCode 는 ~/.claude/settings.json 을 읽지 않아 끌 방법이 없다 — 알리지 않는다.
    expect(ctxOf({}, { turn_id: "t1" })).not.toContain("자동 압축");
    expect(ctxOf({}, { harness: "opencode" })).not.toContain("자동 압축");
    // 무인 루프 반복에는 소음이다.
    expect(ctxOf({ NEREUS_LOOP: "1" })).not.toContain("자동 압축");
  });
  it("stays silent on compact", () => {
    expect(handle({ cwd: "/r", source: "compact" }, deps({ files: {} }))).toBeNull();
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
    const out = handle({ cwd: "/r", source: "compact" }, deps({ files: {} }));
    expect(out?.hookSpecificOutput?.additionalContext ?? "").not.toContain("스킬을 먼저 부른다");
  });
});

const MIN = 60_000;
describe("session-start handoff ownership (loop subsessions only)", () => {
  it("tells this loop iteration which handoff file it owns", () => {
    const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({ entries: () => [], now: () => new Date("2026-09-12T14:30:00").getTime(), env: LOOP }));
    const ctx = out!.hookSpecificOutput.additionalContext;
    expect(ctx).toContain(".nereus/handoff/20260912-1430-a1b2c3d4.md");
    expect(ctx).toContain("여기에만");
  });
  it("injects the newest handoff from the session directory", () => {
    const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({
      files: { "/r/.nereus/handoff/20260912-0900-99999999.md": "# Handoff\n목표: 이전 반복" },
      entries: () => [{ name: "20260912-0900-99999999.md", mtimeMs: Date.now() - 90 * MIN }],
      env: LOOP,
    }));
    expect(out!.hookSpecificOutput.additionalContext).toContain("목표: 이전 반복");
  });
  it("still reads the legacy single file when the directory is empty", () => {
    const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({
      files: { "/r/.nereus/handoff.md": "# Handoff\n목표: 레거시" },
      entries: () => [],
      env: LOOP,
    }));
    expect(out!.hookSpecificOutput.additionalContext).toContain("목표: 레거시");
  });
  it("ignores handoffs older than the loop start so the first iteration never inherits unrelated state", () => {
    const now = Date.now();
    const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({
      files: {
        "/r/.nereus/handoff.md": "# Handoff\n목표: 레거시",
        "/r/.nereus/handoff/20260912-0900-99999999.md": "# Handoff\n목표: 폐지 전 대화형",
      },
      entries: () => [{ name: "20260912-0900-99999999.md", mtimeMs: now - 90 * MIN }],
      now: () => now,
      env: { ...LOOP, NEREUS_LOOP_SINCE: String(now - MIN) },
    }));
    const ctx = out!.hookSpecificOutput.additionalContext;
    expect(ctx).not.toContain("폐지 전 대화형");
    expect(ctx).not.toContain("레거시");
    expect(ctx).toContain("새로 시작");
  });
  it("prunes stale handoffs without touching the injected or owned file", () => {
    const now = Date.now();
    const removed: string[] = [];
    const entries = Array.from({ length: 12 }, (_, i) => ({ name: `20260901-09${String(i).padStart(2, "0")}-s${i}aaaaaa`.slice(0, 22) + ".md", mtimeMs: now - i * MIN }));
    handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({ entries: () => entries, now: () => now, removeFile: (p: string) => removed.push(p), env: LOOP }));
    expect(removed).toHaveLength(2);
    expect(removed.every((p) => p.replace(/\\/g, "/").includes("/r/.nereus/handoff/"))).toBe(true);
  });
});

describe("작업 방식 정책 주입", () => {
  it("injects the standing rule that ordering is never handed back to the user", () => {
    const out = handle({ session_id: "s1", cwd: "/r", source: "startup" }, deps({}));
    const ctx = out!.hookSpecificOutput.additionalContext;
    expect(ctx).toContain("순서");
    expect(ctx).toContain("묻지 않는다");
  });
  it("does not repeat the rule on compact", () => {
    const out = handle({ session_id: "s1", cwd: "/r", source: "compact" }, deps({}));
    const ctx = out?.hookSpecificOutput?.additionalContext ?? "";
    expect(ctx).not.toContain("묻지 않는다");
  });
});
