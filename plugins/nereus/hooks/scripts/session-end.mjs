// SessionEnd: 요약 저장은 claude-mem이 자체 훅으로 한다. 없을 때만 stderr로 안내. 컨텍스트는 내보내지 않는다.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readStdinJson, note as defaultNote } from "./lib/io.mjs";

function defaultHasClaudeMem() {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude", "plugins", "installed_plugins.json"), "utf8"));
    return Object.keys(d.plugins ?? {}).some((k) => k.startsWith("claude-mem@"));
  } catch { return false; }
}

export function handle(input, deps = {}) {
  const note = deps.note ?? defaultNote;
  const has = (deps.hasClaudeMem ?? defaultHasClaudeMem)();
  if (!has) note("claude-mem이 없어 세션 요약이 저장되지 않습니다. /nereus:setup 의 동반 플러그인 안내를 참고하세요.");
  return null;
}

if (process.argv[1] && /session-end\.mjs$/.test(process.argv[1])) handle(readStdinJson());
