import { describe, it, expect } from "vitest";
import { lastAssistantUsage, contextLimitFor, usageRatio, parseUsageFromLines, parseCodexUsageFromLines, parseAnyUsage, readUsage } from "../../plugins/nereus/hooks/scripts/lib/transcript.mjs";

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
  it("uses an explicit limit over the model table, because transcripts never mark a 1M session", () => {
    // 실제 1M 세션의 message.model 은 "claude-opus-5" — [1m] 접미사가 없어 표로는 200k 로 오판한다.
    const usage = { inputTotal: 150000, model: "claude-opus-5" };
    expect(usageRatio(usage)).toBeCloseTo(0.75);
    expect(usageRatio(usage, { limit: 1000000 })).toBeCloseTo(0.15);
    expect(usageRatio(usage, { limit: null })).toBeCloseTo(0.75);
    expect(usageRatio(usage, { limit: 0 })).toBeCloseTo(0.75);
  });
});

// Codex transcript 는 event_msg/token_count 레코드로 사용량과 **한도까지** 준다.
// 실측 샘플(~/.codex/sessions/2026/06/22/rollout-*.jsonl)에서 확인한 모양이다.
const codexTokenCount = (input: number, window: number, cached = 0) =>
  JSON.stringify({
    timestamp: "2026-06-22T00:16:40.250Z",
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: { input_tokens: input * 3, cached_input_tokens: cached, output_tokens: 771, total_tokens: input * 3 + 771 },
        last_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: 771, total_tokens: input + 771 },
        model_context_window: window,
      },
    },
  });

describe("parseCodexUsageFromLines", () => {
  it("reads the LAST token_count and takes the context window as the denominator", () => {
    const lines = [
      JSON.stringify({ type: "session_meta" }),
      codexTokenCount(1000, 258400),
      JSON.stringify({ type: "response_item" }),
      codexTokenCount(18264, 258400),
    ];
    expect(parseCodexUsageFromLines(lines)).toEqual({ inputTotal: 18264, limit: 258400, model: null });
  });

  it("does NOT add cached_input_tokens — it is a subset of input_tokens", () => {
    // 실측: total_tokens 19035 = input 18264 + output 771. cached 2432 는 더해지지 않는다.
    const u = parseCodexUsageFromLines([codexTokenCount(18264, 258400, 2432)])!;
    expect(u.inputTotal).toBe(18264);
  });

  it("uses last_token_usage, not the session-cumulative total_token_usage", () => {
    // 누적은 한도를 훨씬 넘을 수 있어 컨텍스트 사용률이 아니다.
    const u = parseCodexUsageFromLines([codexTokenCount(1000, 200000)])!;
    expect(u.inputTotal).toBe(1000);
  });

  it("returns null for Claude-format lines and for junk", () => {
    expect(parseCodexUsageFromLines([line("assistant", { input_tokens: 10 })])).toBeNull();
    expect(parseCodexUsageFromLines(["not json", ""])).toBeNull();
  });

  it("ignores a token_count without a usable window", () => {
    const bad = JSON.stringify({ type: "event_msg", payload: { type: "token_count", info: { last_token_usage: { input_tokens: 5 } } } });
    expect(parseCodexUsageFromLines([bad])).toBeNull();
  });
});

describe("parseAnyUsage", () => {
  it("prefers the Codex record because it carries a real limit", () => {
    const u = parseAnyUsage([codexTokenCount(18264, 258400)])!;
    expect(u).toMatchObject({ inputTotal: 18264, limit: 258400 });
  });

  it("falls back to the Claude format", () => {
    const u = parseAnyUsage([line("assistant", { input_tokens: 10, cache_read_input_tokens: 5 })])!;
    expect(u.inputTotal).toBe(15);
    expect(u.limit ?? null).toBeNull();
  });

  it("returns null when neither format is present", () => {
    expect(parseAnyUsage(["", "not json"])).toBeNull();
  });
});

describe("usageRatio with a transcript-supplied limit", () => {
  it("uses the limit that came with the usage record over the model table", () => {
    // Codex 는 분모를 직접 준다 — 모델 표 추측이 필요 없다.
    expect(usageRatio({ inputTotal: 129200, limit: 258400, model: "gpt-5.4" })).toBeCloseTo(0.5, 3);
  });

  it("an explicit limit argument still wins (ctx-sink 의 학습값)", () => {
    expect(usageRatio({ inputTotal: 100000, limit: 200000 }, { limit: 1000000 })).toBeCloseTo(0.1, 3);
  });
});

describe("readUsage — baton-meter 가 실제로 쓰는 진입점", () => {
  it("Codex 파일도 읽는다 (lastAssistantUsage 는 Claude 포맷만 본다)", () => {
    const txt = [codexTokenCount(18264, 258400), ""].join("\n");
    expect(readUsage("/x.jsonl", { readFile: () => txt })).toMatchObject({ inputTotal: 18264, limit: 258400 });
    // 같은 입력을 Claude 전용 파서로 읽으면 못 본다 — 그래서 진입점을 바꿔야 했다
    expect(lastAssistantUsage("/x.jsonl", { readFile: () => txt })).toBeNull();
  });

  it("Claude 파일도 그대로 읽는다", () => {
    const txt = line("assistant", { input_tokens: 10, cache_read_input_tokens: 5 });
    expect(readUsage("/x.jsonl", { readFile: () => txt })!.inputTotal).toBe(15);
  });

  it("파일을 못 읽으면 null", () => {
    expect(readUsage("/nope", { readFile: () => { throw new Error("ENOENT"); } })).toBeNull();
  });
});
