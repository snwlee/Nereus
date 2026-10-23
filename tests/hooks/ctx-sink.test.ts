import { describe, it, expect } from "vitest";
import { sink, officialRatio, ctxFile } from "../../plugins/nereus/hooks/scripts/ctx-sink.mjs";

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
});
