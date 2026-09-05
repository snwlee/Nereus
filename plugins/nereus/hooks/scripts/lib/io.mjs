// 훅 stdin/stdout 계약. Claude Code 형식만 다룬다.
import fs from "node:fs";

export function parseHookInput(raw) {
  const text = (raw ?? "").trim();
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function readStdinJson() {
  try {
    return parseHookInput(fs.readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

export function contextPayload(hookEventName, additionalContext) {
  return { hookSpecificOutput: { hookEventName, additionalContext } };
}

export function blockPayload(reason, systemMessage) {
  return systemMessage === undefined ? { decision: "block", reason } : { decision: "block", reason, systemMessage };
}

export function emit(payload) {
  if (payload) process.stdout.write(JSON.stringify(payload) + "\n");
}

export function note(msg) {
  process.stderr.write(`[nereus] ${msg}\n`);
}
