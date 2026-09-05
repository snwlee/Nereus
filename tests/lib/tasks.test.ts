import { describe, it, expect } from "vitest";
import { parseTasks, findTasksFile, taskProgress } from "../../plugins/nereus/hooks/scripts/lib/tasks.mjs";

const fsOf = (files: Record<string, string>) => ({
  exists: (p: string) => p.replace(/\\/g, "/") in files,
  readFile: (p: string) => { const k = p.replace(/\\/g, "/"); if (!(k in files)) throw new Error("ENOENT"); return files[k]; },
  glob: (pat: string) => Object.keys(files).filter((f) => new RegExp("^" + pat.replace(/\*/g, "[^/]*") + "$").test(f)),
});

describe("tasks", () => {
  it("parses checkboxes at any indent, ignoring other lines", () => {
    expect(parseTasks("- [ ] A [flow]\n- [x] B\n  - [ ] C\nplain text\n- [X] D")).toEqual([
      { text: "A [flow]", done: false }, { text: "B", done: true }, { text: "C", done: false }, { text: "D", done: true },
    ]);
    expect(parseTasks("")).toEqual([]);
  });
  it("finds the tasks file, preferring OpenSpec changes over generic ones", () => {
    const fsx = fsOf({ "/r/tasks.md": "- [ ] x", "/r/openspec/changes/add-auth/tasks.md": "- [ ] y" });
    expect(findTasksFile("/r", fsx)).toBe("/r/openspec/changes/add-auth/tasks.md");
    expect(findTasksFile("/r", fsOf({ "/r/tasks.md": "- [ ] x" }))).toBe("/r/tasks.md");
    expect(findTasksFile("/r", fsOf({}))).toBeNull();
  });
  it("reports progress and the next unchecked task", () => {
    const fsx = fsOf({ "/r/tasks.md": "- [x] A\n- [ ] B\n- [ ] C" });
    expect(taskProgress("/r", fsx)).toEqual({ file: "/r/tasks.md", total: 3, done: 1, next: "B", complete: false });
  });
  it("marks complete when every task is checked, and returns null with no file", () => {
    expect(taskProgress("/r", fsOf({ "/r/tasks.md": "- [x] A" }))).toMatchObject({ complete: true, next: null });
    expect(taskProgress("/r", fsOf({}))).toBeNull();
    expect(taskProgress("/r", fsOf({ "/r/tasks.md": "no checkboxes here" }))).toBeNull();
  });
});
