// Nereus 하네스 OpenCode 브릿지. OpenCode 플러그인으로 자동 발견된다(.opencode/plugins/).
// tool.execute.before/after를 Claude형 JSON으로 바꿔 기존 Node 스크립트를 그대로 호출한다.
// (선례: ccgs-hooks.js, lanjak/opencode-hooks. OpenCode에 PreCompact 개념은 없어 Baton은 handoff 수동으로.)
// 차단은 throw로 (exit 2 상당). Node 런타임만 쓴다(Bun·Node 공용).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.resolve(HERE, "..", "..", "plugins", "nereus", "hooks", "scripts");

export const EDIT_TOOLS = new Set(["write", "edit"]);
const TOOL_MAP = { bash: "Bash", write: "Edit", edit: "Edit" };

/** OpenCode 도구 호출 → Claude형 훅 입력. 관심 밖 도구는 null (fail-open). */
export function toClaudeInput({ tool, sessionID, args, cwd }) {
  const name = TOOL_MAP[String(tool ?? "").toLowerCase()];
  if (!name) return null;
  const a = args ?? {};
  const tool_input = name === "Bash"
    ? { command: a.command ?? "" }
    : { file_path: a.filePath ?? a.file_path ?? "" };
  return { hook_event_name: "PreToolUse", tool_name: name, tool_input, cwd, session_id: sessionID, harness: "opencode" };
}

/** 스크립트 stdout(JSON)에서 모델에게 보여줄 guidance를 뽑는다. */
export function extractGuidance(stdoutText) {
  try {
    const j = JSON.parse(String(stdoutText ?? "").trim());
    const ctx = j?.hookSpecificOutput?.additionalContext;
    return typeof ctx === "string" && ctx ? ctx : null;
  } catch { return null; }
}

/** guidance를 도구 결과에 덧붙인다. 실패해도 원본을 해치지 않는다(fail-open). */
export function appendGuidance(output, guidance) {
  if (!guidance || !output || typeof output.output !== "string") return;
  output.output += `\n<context_guidance>\n${guidance}\n</context_guidance>`;
}

function runScript(script, payload, timeoutMs = 8000) {
  const r = spawnSync("node", [path.join(SCRIPTS, script)], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: timeoutMs,
  });
  return { status: r.status ?? 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

export default async ({ worktree, directory }) => {
  const cwd = worktree ?? directory ?? process.cwd();
  return {
    "tool.execute.before": async (input, output) => {
      const p = toClaudeInput({ tool: input.tool, sessionID: input.sessionID, args: output.args, cwd });
      if (!p) return;
      const r = runScript("pre-tool-guard.mjs", p);
      if (r.status === 2) throw new Error(`[nereus] ${(r.stderr || "blocked").trim()}`);
    },
    "tool.execute.after": async (input, output) => {
      const tool = String(input.tool ?? "").toLowerCase();
      if (!EDIT_TOOLS.has(tool)) return;
      const p = toClaudeInput({ tool: input.tool, sessionID: input.sessionID, args: input.args, cwd });
      if (!p) return;
      p.hook_event_name = "PostToolUse";
      const r = runScript("tdd-guard.mjs", p);
      appendGuidance(output, extractGuidance(r.stdout));
    },
  };
};
