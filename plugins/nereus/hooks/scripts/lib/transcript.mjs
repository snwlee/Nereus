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

// Codex transcript(rollout-*.jsonl)는 event_msg/token_count 레코드로 사용량과 **한도까지** 준다.
// 실측(~/.codex/sessions/…/rollout-*.jsonl):
//   {"type":"event_msg","payload":{"type":"token_count","info":{
//      "last_token_usage":{"input_tokens":18264,"cached_input_tokens":2432,"output_tokens":771,"total_tokens":19035},
//      "total_token_usage":{...},"model_context_window":258400}}}
// 주의 1: cached_input_tokens 는 input_tokens 의 **부분집합**이다(total 19035 = input 18264 + output 771).
//         Claude 포맷처럼 더하면 이중계산이 된다.
// 주의 2: total_token_usage 는 세션 누적이라 한도를 넘을 수 있다 — 컨텍스트 사용률은 last_token_usage 다.
// 이 포맷은 model_context_window 를 주므로 Claude 쪽처럼 한도를 역산할 필요가 없다.
export function parseCodexUsageFromLines(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    let obj;
    try { obj = JSON.parse(lines[i]); } catch { continue; }
    if (obj?.type !== "event_msg" || obj?.payload?.type !== "token_count") continue;
    const info = obj.payload.info;
    const input = info?.last_token_usage?.input_tokens;
    const limit = info?.model_context_window;
    if (!(input >= 0) || !(limit > 0)) continue;
    return { inputTotal: input, limit, model: info?.model ?? null };
  }
  return null;
}

/** 두 하네스의 transcript 포맷을 모두 본다. 한도를 함께 주는 Codex 레코드를 먼저 찾는다. */
export function parseAnyUsage(lines) {
  return parseCodexUsageFromLines(lines) ?? parseUsageFromLines(lines);
}

/** 하네스를 가리지 않는 진입점. baton-meter 는 이것을 쓴다 — 포맷별 파서를 직접 부르지 않는다. */
export function readUsage(transcriptPath, { readFile = (p) => fs.readFileSync(p, "utf8") } = {}) {
  let text;
  try { text = readFile(transcriptPath); } catch { return null; }
  return parseAnyUsage(text.split("\n"));
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
  // 우선순위: 명시 인자(ctx-sink 학습값) > transcript 가 준 한도(Codex) > 모델 표 추측
  let limit = known > 0 ? known : usage.limit > 0 ? usage.limit : contextLimitFor(usage.model);
  // 한도 표에 없는 대형 컨텍스트 모델: 실제 사용량이 표 한도를 넘으면 1M으로 간주한다(오탐 하드 스톱 방지).
  if (usage.inputTotal > limit) limit = 1000000;
  return Math.min(usage.inputTotal / limit, 1);
}
