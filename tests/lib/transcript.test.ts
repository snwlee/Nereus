import { describe, it, expect } from "vitest";
import { lastAssistantUsage, contextLimitFor, usageRatio, parseUsageFromLines } from "../../plugins/nereus/hooks/scripts/lib/transcript.mjs";

const line = (role: string, usage?: object, model = "claude-opus-5") =>
  JSON.stringify({ type: role, message: { role, model, usage, content: [] } });

describe("transcript", () => {
  it("sums input, cache_read and cache_creation of the LAST assistant line", () => {
    const lines = [
      line("user"),
      line("assistant", { input_tokens: 10, cache_read_input_tokens: 5, cache_creation_input_tokens: 1, output_tokens: 9 }),
      line("user"),
      line("assistant", { input_tokens: 100, cache_read_input_tokens: 50, cache_creation_input_tokens: 0, output_tokens: 3 }),
      "not json at all",
    ];
    expect(parseUsageFromLines(lines)).toEqual({ inputTotal: 150, model: "claude-opus-5" });
  });
  it("returns null when no assistant usage present", () => {
    expect(parseUsageFromLines([line("user"), "{}"])).toBeNull();
  });
  it("reads a file via injected reader", () => {
    const text = [line("assistant", { input_tokens: 7 })].join("\n");
    expect(lastAssistantUsage("/x.jsonl", { readFile: () => text })).toEqual({ inputTotal: 7, model: "claude-opus-5" });
    expect(lastAssistantUsage("/missing.jsonl", { readFile: () => { throw new Error("ENOENT"); } })).toBeNull();
  });
  it("knows model limits and defaults unknown to 200k", () => {
    expect(contextLimitFor("claude-opus-5")).toBe(200000);
    expect(contextLimitFor("claude-sonnet-5[1m]")).toBe(1000000);
    expect(contextLimitFor("weird-model")).toBe(200000);
    expect(contextLimitFor(undefined)).toBe(200000);
    expect(contextLimitFor("claude-fable-5-1")).toBe(1000000);
  });
  it("computes ratio", () => {
    expect(usageRatio({ inputTotal: 130000, model: "claude-opus-5" })).toBeCloseTo(0.65);
    expect(usageRatio(null)).toBe(0);
    expect(usageRatio({ inputTotal: 354000, model: "unknown-big" })).toBeCloseTo(0.354);
    expect(usageRatio({ inputTotal: 2500000, model: "x" })).toBe(1);
  });
});
