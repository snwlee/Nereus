// UserPromptSubmit: 사용자가 교정한 것으로 보이면 한 줄만 넣어 규칙으로 남기게 유도한다.
// LLM 호출 없이 정규식으로만 판정하고, 주입은 한 문장이라 토큰 비용이 사실상 없다.
import { readStdinJson, contextPayload, emit } from "./lib/io.mjs";
import { isCorrection } from "./lib/learnings.mjs";

export function handle(input) {
  const prompt = input?.prompt ?? "";
  if (!isCorrection(prompt)) return null;
  return contextPayload(
    "UserPromptSubmit",
    "[Nereus] 사용자가 방금 교정했습니다. 같은 실수를 반복하지 않을 규칙이 하나 도출된다면 nereus:learn 으로 남기세요(일회성 지시면 남기지 마세요).",
  );
}

if (process.argv[1] && /learn-watch\.mjs$/.test(process.argv[1])) emit(handle(readStdinJson()));
