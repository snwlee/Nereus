import { describe, it, expect } from "vitest";
import { sink, officialRatio, ctxFile } from "../../plugins/nereus/hooks/scripts/ctx-sink.mjs";
import { handle as batonMeter } from "../../plugins/nereus/hooks/scripts/baton-meter.mjs";

describe("ctx-sink", () => {
  it("writes the official percentage per session and reads it back while fresh", () => {
    const store: Record<string, string> = {};
    const io = { writeFile: (p: string, s: string) => { store[p] = s; }, readFile: (p: string) => { if (!(p in store)) throw new Error("ENOENT"); return store[p]; }, dir: "/d" };
    expect(sink({ session_id: "s/1", context_window: { used_percentage: 55 } }, { ...io, now: 1000 })).toMatchObject({ used_percentage: 55 });
    expect(Object.keys(store)[0]).toBe(ctxFile("s/1", "/d"));
    expect(officialRatio("s/1", { ...io, now: 2000 })).toBeCloseTo(0.55);
    expect(officialRatio("s/1", { ...io, now: 2000 + 100_000 })).toBeNull();
    expect(officialRatio("other", io)).toBeNull();
    expect(sink({ session_id: "x" }, io)).toBeNull();
  });
  it("baton-meter prefers the official ratio over the transcript estimate", () => {
    const deps = {
      usage: () => ({ inputTotal: 60_000, model: "claude-opus-5" }), // 추정 30% — 두 소스가 다를 때 공식 값이 이겨야 한다
      official: () => 0.7,
      config: () => ({ baton: { warn: 0.5, hard: 0.7 } }),
      hasMark: () => false, setMark: () => {},
    };
    const out = batonMeter({ session_id: "s", cwd: "/r", transcript_path: "/t" }, deps)!;
    expect(out.hookSpecificOutput.additionalContext).toMatch(/하드 스톱 70%/);
    expect(batonMeter({ session_id: "s", cwd: "/r", transcript_path: "/t" }, { ...deps, official: () => null })).toBeNull();
  });
});
