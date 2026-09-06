// UserPromptSubmit: 교정으로 보이면 (1) 관찰에 남기고 (2) 세션당 한 번만 한 줄 안내한다.
// 판정은 정규식뿐이고 LLM 호출은 없다. 안내를 세션당 1회로 제한해 토큰을 아낀다.
import fs from "node:fs";
import path from "node:path";
import { readStdinJson, contextPayload, emit } from "./lib/io.mjs";
import { promptObservation, appendObservation } from "./lib/observe.mjs";
import { projectStateDir } from "./lib/paths.mjs";

const markFile = (cwd, sid) => path.join(projectStateDir(cwd), `.learn-nudged-${String(sid).replace(/[^A-Za-z0-9_-]/g, "_")}`);

export function handle(input, deps = {}) {
  const cwd = input.cwd || process.cwd();
  const rec = promptObservation(input);
  if (!rec) return null;
  (deps.append ?? appendObservation)(cwd, rec);

  const sid = input.session_id ?? "nosession";
  const has = deps.hasMark ?? ((k) => fs.existsSync(k));
  const set = deps.setMark ?? ((k) => { try { fs.mkdirSync(path.dirname(k), { recursive: true }); fs.writeFileSync(k, ""); } catch { /* 무시 */ } });
  const mark = markFile(cwd, sid);
  if (has(mark)) return null;
  set(mark);
  return contextPayload("UserPromptSubmit", "[Nereus] 교정으로 보입니다. 앞으로도 적용될 규칙이면 nereus:learn 으로 남기세요(일회성 지시면 그냥 진행).");
}

if (process.argv[1] && /learn-watch\.mjs$/.test(process.argv[1])) emit(handle(readStdinJson()));
