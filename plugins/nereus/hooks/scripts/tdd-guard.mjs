// PostToolUse(Edit|Write|MultiEdit): 테스트 러너가 있는 프로젝트에서 테스트보다 소스를 먼저 편집하면 경고. 차단은 하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { readStdinJson, contextPayload, emit } from "./lib/io.mjs";
import { detectTestRunner, isSourceFile, isTestFile } from "./lib/stack.mjs";
import { loadConfig } from "./lib/config.mjs";
import { projectStateDir } from "./lib/paths.mjs";

export function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        out += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else out += "[^/]*";
    } else if (c === "?") out += "[^/]";
    else out += /[.+^${}()|[\]\\/]/.test(c) ? `\\${c}` : c;
  }
  return new RegExp(`^${out}$`);
}

function fileHistory(cwd, sid) {
  const file = path.join(projectStateDir(cwd), `.tdd-${sid}.json`);
  return {
    loadHistory: () => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; } },
    saveHistory: (h) => { try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(h)); } catch { /* 무시 */ } },
  };
}

export function handle(input, deps = {}) {
  const cwd = input.cwd || process.cwd();
  const filePath = input.tool_input?.file_path;
  if (!filePath) return null;
  const rel = path.relative(cwd, filePath).replace(/\\/g, "/");
  if (!isSourceFile(rel) && !isTestFile(rel)) return null;

  const cfg = (deps.config ?? (() => loadConfig({ cwd })))();
  if ((cfg.tdd?.exclude ?? []).some((g) => globToRegExp(g).test(rel))) return null;

  const runner = (deps.runner ?? (() => detectTestRunner(cwd)))();
  if (!runner) return null;

  const store = deps.loadHistory ? deps : fileHistory(cwd, input.session_id || "nosession");
  const history = store.loadHistory();
  const next = [...history, rel];
  store.saveHistory(next);

  if (isTestFile(rel)) return null;
  const testSeen = history.some(isTestFile);
  const alreadyWarned = history.includes(rel);
  if (testSeen || alreadyWarned) return null;

  return contextPayload("PostToolUse",
    `[TDD] ${rel} 을(를) 테스트 없이 편집했습니다. 이 프로젝트는 테스트 러너가 있습니다(${runner.command}). 먼저 실패하는 테스트를 작성하고 실패를 확인한 뒤 구현하세요. 이미 테스트가 있다면 무시하고, 없다면 지금 추가하세요.`);
}

if (process.argv[1] && /tdd-guard\.mjs$/.test(process.argv[1])) {
  emit(handle(readStdinJson()));
}
