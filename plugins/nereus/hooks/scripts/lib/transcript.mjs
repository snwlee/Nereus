// transcript JSONL에서 컨텍스트 사용량 계산.
import fs from "node:fs";

const LIMITS = [
  [/\[1m\]/, 1000000],
  [/claude-/, 200000],
];
const DEFAULT_LIMIT = 200000;

export function contextLimitFor(model) {
  if (!model) return DEFAULT_LIMIT;
  for (const [re, limit] of LIMITS) if (re.test(model)) return limit;
  return DEFAULT_LIMIT;
}

export function parseUsageFromLines(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    let obj;
    try { obj = JSON.parse(lines[i]); } catch { continue; }
    const msg = obj?.message;
    if (!msg || msg.role !== "assistant" || !msg.usage) continue;
    const u = msg.usage;
    const inputTotal = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    return { inputTotal, model: msg.model };
  }
  return null;
}

export function lastAssistantUsage(transcriptPath, { readFile = (p) => fs.readFileSync(p, "utf8") } = {}) {
  let text;
  try { text = readFile(transcriptPath); } catch { return null; }
  return parseUsageFromLines(text.split("\n"));
}

export function usageRatio(usage) {
  if (!usage) return 0;
  return usage.inputTotal / contextLimitFor(usage.model);
}
