import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { handle } from "../../plugins/nereus/hooks/scripts/session-start.mjs";

describe("two sessions in one project", () => {
  it("never lets one session overwrite the other's handoff", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "nereus-handoff-"));
    fs.mkdirSync(path.join(root, ".nereus", "handoff"), { recursive: true });
    const a = handle({ session_id: "aaaaaaaa-1", cwd: root, source: "startup" })!.hookSpecificOutput.additionalContext;
    const b = handle({ session_id: "bbbbbbbb-2", cwd: root, source: "startup" })!.hookSpecificOutput.additionalContext;
    const pathOf = (ctx: string) => ctx.match(/\.nereus\/handoff\/[\w-]+\.md/)![0];
    expect(pathOf(a)).not.toBe(pathOf(b));
    fs.rmSync(root, { recursive: true, force: true });
  });
});
