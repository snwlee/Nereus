// PreCompact: 압축 직전. 요약에 반드시 남길 섹션을 지시한다.
// 컨텍스트 관리는 Claude Code 자동 압축(CLAUDE_AUTOCOMPACT_PCT_OVERRIDE, 권장 50%)이 맡는다.
// 압축 요약이 유일한 계승 수단이라 매번 지시한다 — 조건을 걸면 그 압축은 섹션 없이 요약된다.
import { readStdinJson, contextPayload, emit } from "./lib/io.mjs";

// MUST NOT(실패한 접근·금지 사항)이 빠지면 압축 뒤 같은 실수를 반복한다.
const COMPACT_INSTRUCTION = [
  "[Nereus] 컨텍스트 압축이 시작됩니다.",
  "압축 요약에는 다음 다섯 섹션을 이 제목 그대로 반드시 포함하세요:",
  "1. 원문 요청 — 사용자가 처음 요청한 문장 그대로",
  "2. 최종 목표 — 이 작업 단위가 끝나면 참이 되는 것",
  "3. 완료한 작업 — 파일·커밋 단위",
  "4. 남은 작업 — 다음에 할 순서대로",
  "5. MUST NOT — 시도했다가 실패한 접근과 이유, 사용자가 금지한 것, 건드리면 안 되는 파일",
].join("\n");

export function handle() {
  return contextPayload("PreCompact", COMPACT_INSTRUCTION);
}

if (process.argv[1] && /pre-compact\.mjs$/.test(process.argv[1])) {
  readStdinJson();
  emit(handle());
}
