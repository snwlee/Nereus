import { describe, it, expect } from "vitest";
import path from "node:path";
import { applyAutocompact, readCurrent, settingsPath, KEY, MAX_PCT } from "../../plugins/nereus/skills/setup/scripts/autocompact.mjs";

describe("autocompact threshold", () => {
  it("writes the key into env without mutating the input", () => {
    const before = { env: { OTHER: "1" }, hooks: {} };
    const { settings, effective, clamped } = applyAutocompact(before, 80);
    expect(settings.env).toEqual({ OTHER: "1", [KEY]: "80" });
    expect(settings.hooks).toBe(before.hooks);
    expect(effective).toBe(80);
    expect(clamped).toBe(false);
    expect(before.env[KEY]).toBeUndefined();
  });
  it("creates env when absent and clamps above the Claude Code cap", () => {
    expect(applyAutocompact({}, 50).settings.env[KEY]).toBe("50");
    const r = applyAutocompact({}, 95);
    expect(r.effective).toBe(MAX_PCT);
    expect(r.clamped).toBe(true);
  });
  it("rejects out-of-range or non-integer values", () => {
    for (const bad of [0, 101, -5, 1.5, "abc"]) expect(() => applyAutocompact({}, bad as any)).toThrow();
  });
  it("reads the current value, returning null when unset or unreadable", () => {
    const read = (json: string) => () => json;
    expect(readCurrent("/s.json", read(`{"env":{"${KEY}":"80"}}`))).toBe(80);
    expect(readCurrent("/s.json", read('{"env":{}}'))).toBeNull();
    expect(readCurrent("/s.json", read("not json"))).toBeNull();
    expect(readCurrent("/s.json", () => { throw new Error("ENOENT"); })).toBeNull();
  });
  it("resolves the settings path under the given home", () => {
    expect(settingsPath("/h")).toBe(path.join("/h", ".claude", "settings.json"));
  });
});
