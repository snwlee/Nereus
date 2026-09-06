// transcript JSONL에서 컨텍스트 사용량 계산.
import fs from "node:fs";

const LIMITS = [
  [/\[1m\]/, 1000000],
  [/fable|mythos/, 1000000],
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

// limit: 실측으로 학습한 한도(ctx-sink 의 세션 캐시). 없으면 모델 표로 추측한다.
// transcript 의 message.model 에는 1M 세션을 알리는 [1m] 접미사가 없어 표만으로는 200k 로 오판한다.
export function usageRatio(usage, { limit: known = null } = {}) {
  if (!usage) return 0;
  let limit = known > 0 ? known : contextLimitFor(usage.model);
  // 한도 표에 없는 대형 컨텍스트 모델: 실제 사용량이 표 한도를 넘으면 1M으로 간주한다(오탐 하드 스톱 방지).
  if (usage.inputTotal > limit) limit = 1000000;
  return Math.min(usage.inputTotal / limit, 1);
}
