// PostToolUse: 관찰만 적재한다. 판정도, 컨텍스트 주입도 하지 않는다(출력 없음 = 토큰 0).
import { readStdinJson } from "./lib/io.mjs";
import { toolObservation, appendObservation } from "./lib/observe.mjs";

export function handle(input, deps = {}) {
  const cwd = input.cwd || process.cwd();
  const rec = toolObservation(input);
  if (!rec) return null;
  return (deps.append ?? appendObservation)(cwd, rec);
}

if (process.argv[1] && /observe\.mjs$/.test(process.argv[1])) {
  try { handle(readStdinJson()); } catch { /* 관찰 실패가 작업을 막아서는 안 된다 */ }
}
