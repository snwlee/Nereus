import { describe, it, expect } from "vitest";
import { sink, officialRatio, ctxFile, snapLimit, saveLimit, cachedLimit, limitFile } from "../../plugins/nereus/hooks/scripts/ctx-sink.mjs";
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
      hasMark: () => false, setMark: () => {}, saveLimit: () => {}, loadLimit: () => null,
    };
    const out = batonMeter({ session_id: "s", cwd: "/r", transcript_path: "/t" }, deps)!;
    expect(out.hookSpecificOutput.additionalContext).toMatch(/하드 스톱 70%/);
    expect(batonMeter({ session_id: "s", cwd: "/r", transcript_path: "/t" }, { ...deps, official: () => null })).toBeNull();
  });

  it("snaps a back-computed limit to the nearest known context size", () => {
    // 공식 %는 정수로 반올림되므로 역산값은 근사치다. 알려진 한도로 스냅해야 쓸 수 있다.
    expect(snapLimit(88917 / 0.09)).toBe(1000000);   // 987,966 → 1M
    expect(snapLimit(210000)).toBe(200000);
    expect(snapLimit(500000)).toBe(1000000);          // 기하평균(447k) 위 → 1M
    expect(snapLimit(400000)).toBe(200000);           // 기하평균 아래 → 200k
    expect(snapLimit(Infinity)).toBeNull();           // ratio 0 으로 나눈 경우
    expect(snapLimit(0)).toBeNull();
    expect(snapLimit(-5)).toBeNull();
    expect(snapLimit(NaN)).toBeNull();
  });

  it("caches the limit per session and reads it back regardless of freshness", () => {
    const store: Record<string, string> = {};
    const io = {
      writeFile: (p: string, s: string) => { store[p] = s; },
      readFile: (p: string) => { if (!(p in store)) throw new Error("ENOENT"); return store[p]; },
      dir: "/d",
    };
    saveLimit("s/1", 1000000, { ...io, now: 1000 });
    expect(Object.keys(store)[0]).toBe(limitFile("s/1", "/d"));
    // 한도는 시간이 지나도 변하지 않는다 — officialRatio 와 달리 신선도를 따지지 않는다.
    expect(cachedLimit("s/1", { ...io, now: 1000 + 10_000_000 })).toBe(1000000);
    expect(cachedLimit("missing", io)).toBeNull();
  });
});
