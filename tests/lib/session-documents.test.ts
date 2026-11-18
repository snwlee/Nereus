import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { handle as guard } from "../../plugins/nereus/hooks/scripts/pre-tool-guard.mjs";
import { claimWork, releaseWork, prepareSessionState, sessionStateDir } from "../../plugins/nereus/hooks/scripts/lib/session-documents.mjs";
import { sessionTaskProgress } from "../../plugins/nereus/hooks/scripts/lib/tasks.mjs";
import { handle as stop } from "../../plugins/nereus/hooks/scripts/finish-check.mjs";
import { arm, status } from "../../plugins/nereus/skills/continue/scripts/arm.mjs";
import { archiveWork } from "../../plugins/nereus/skills/spec/scripts/session-work.mjs";

const roots: string[] = [];
const a = "openspec/changes/alpha/tasks.md";
const b = "openspec/changes/beta/tasks.md";

function fixture() {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "nereus-docs-")));
  roots.push(cwd);
  for (const [file, body] of [[a, "- [ ] Alpha"], [b, "- [x] Beta"]]) {
    fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    fs.writeFileSync(path.join(cwd, file), body);
  }
  return cwd;
}

afterEach(() => {
  for (const cwd of roots.splice(0)) fs.rmSync(cwd, { recursive: true, force: true });
});

it("binds progress to the selected document even after it disappears", () => {
  const cwd = fixture();
  claimWork(cwd, "first", a);
  claimWork(cwd, "second", b);
  expect(sessionTaskProgress(cwd, "first")).toMatchObject({ next: "Alpha" });
  expect(sessionTaskProgress(cwd, "second")).toMatchObject({ complete: true });
  expect(sessionTaskProgress(cwd, "unbound")).toBeNull();
  fs.unlinkSync(path.join(cwd, a));
  expect(sessionTaskProgress(cwd, "first")).toBeNull();
});

it("rejects competing claims and structured edits from another session", () => {
  const cwd = fixture();
  claimWork(cwd, "first", a);
  expect(() => claimWork(cwd, "second", a)).toThrow(/first/);
  const edit = { cwd, tool_name: "Write", tool_input: { file_path: path.join(path.dirname(a), "design.md") } };
  expect(guard({ ...edit, session_id: "second" }, { rules: () => [] })).toMatchObject({ decision: "block" });
  releaseWork(cwd, "first");
  expect(() => claimWork(cwd, "second", a)).not.toThrow();
});

it("archives only completed owned work and serializes shared spec updates", () => {
  const cwd = fixture();
  claimWork(cwd, "first", a);
  claimWork(cwd, "second", b);
  expect(() => archiveWork(cwd, "first", () => {})).toThrow();
  fs.writeFileSync(path.join(cwd, a), "- [x] Alpha");
  expect(() => archiveWork(cwd, "second", () => {
    expect(() => archiveWork(cwd, "first", () => {})).toThrow(/archive/i);
    expect(() => releaseWork(cwd, "second")).toThrow(/archive/i);
    claimWork(cwd, "unrelated", "tasks.md");
    releaseWork(cwd, "unrelated");
    throw new Error("CLI failed");
  })).toThrow("CLI failed");
  expect(() => archiveWork(cwd, "first", () => {})).not.toThrow();
  expect(() => archiveWork(cwd, "second", () => {})).toThrow(/archive/i);
  expect(guard({
    cwd, session_id: "second", tool_name: "Write",
    tool_input: { file_path: "openspec/specs/canonical/spec.md" },
  }, { rules: () => [] })).toMatchObject({ decision: "block" });
  releaseWork(cwd, "first");
  expect(() => archiveWork(cwd, "second", () => {})).not.toThrow();
  expect(sessionStateDir(cwd, "first")).not.toBe(sessionStateDir(cwd, "second"));
});

it("reserves planned files and resolves nested checkout paths to the same ownership", () => {
  const cwd = fixture();
  const nested = path.join(cwd, "openspec", "changes");
  const planned = "openspec/changes/planned/tasks.md";
  claimWork(nested, "first", "planned/tasks.md");
  expect(sessionTaskProgress(cwd, "first")).toBeNull();
  expect(() => claimWork(cwd, "second", planned)).toThrow(/first/);
  expect(() => claimWork(cwd, "first", b)).toThrow(/release/);
  expect(guard({
    cwd: nested,
    session_id: "second",
    tool_name: "apply_patch",
    tool_input: { patch: "*** Update File: beta/design.md\n*** Move to: planned/design.md" },
  }, { rules: () => [] })).toMatchObject({ decision: "block" });
});

it("prevents a different session from consuming or decrementing continuation", () => {
  const cwd = fixture();
  claimWork(cwd, "first", a);
  const file = sessionTaskProgress(cwd, "first")!.file;
  arm(cwd, { sessionId: "first", tasks: file, max: 2 });
  const deps = { gitStatus: () => "", evidence: () => ({ status: "MISSING" }), designGate: () => ({ findings: [] }) };
  expect(stop({ cwd, session_id: "second" }, deps)).toBeNull();
  expect(status(cwd, { sessionId: "first" })).toMatchObject({ remaining: 2 });
  expect(stop({ cwd, session_id: "first" }, deps)).toMatchObject({ reason: expect.stringContaining("Alpha") });
  expect(status(cwd, { sessionId: "first" })).toMatchObject({ remaining: 1 });
  releaseWork(cwd, "first");
  claimWork(cwd, "first", b);
  expect(stop({ cwd, session_id: "first" }, deps)).toBeNull();
  expect(status(cwd, { sessionId: "first" })).toBeNull();
});

it("publishes a single owner when independent CLI processes claim concurrently", async () => {
  const cwd = fixture();
  const cli = path.resolve("plugins/nereus/skills/spec/scripts/session-work.mjs");
  const attempt = (sid: string) => new Promise<number | null>((resolve, reject) => {
    const child = spawn(process.execPath, [cli, "claim", sid, a], { cwd, stdio: "ignore" });
    child.once("error", reject);
    child.once("close", resolve);
  });
  const results = await Promise.all([attempt("first"), attempt("second")]);
  expect(results.sort()).toEqual([0, 2]);
  expect(["first", "second"].filter((sid) => sessionTaskProgress(cwd, sid))).toHaveLength(1);
});


it("keeps workflow state out of staging in a Git checkout without ignore rules", () => {
  const cwd = fixture();
  execFileSync("git", ["init", "-q"], { cwd });
  const notes = prepareSessionState(cwd, "first");
  const intake = path.join(notes, "intake.md");
  fs.writeFileSync(intake, "private plan");
  claimWork(cwd, "first", a);
  execFileSync("git", ["add", "-A"], { cwd });
  const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd, encoding: "utf8" });
  expect(staged).toContain(a);
  expect(staged).not.toContain(".nereus/");
});
