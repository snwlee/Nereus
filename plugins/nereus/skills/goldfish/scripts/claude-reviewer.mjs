import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { run } from "../../../hooks/scripts/lib/exec.mjs";

export function runClaudeReviewer(model, prompt, invoke = run) {
  if (model !== "sonnet" && model !== "opus") {
    throw new Error("Expected a Claude review model (sonnet or opus)");
  }
  if (!prompt.trim()) throw new Error("Review prompt is empty");

  const result = invoke("claude", [
    "--print", "--model", model, "--no-session-persistence", "--safe-mode",
    "--strict-mcp-config", "--tools", "Read,Glob,Grep", "--permission-mode", "dontAsk",
  ], { input: prompt, timeoutMs: 300_000 });

  if (!result.ok) {
    const reason = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
    throw new Error(`Claude review failed: ${reason || `exit status ${result.status}`}`);
  }
  if (!result.stdout.trim()) throw new Error("Claude returned an empty review");
  return result.stdout;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(runClaudeReviewer(process.argv[2], readFileSync(0, "utf8")));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
