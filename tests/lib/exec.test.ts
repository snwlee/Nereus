import { describe, it, expect } from "vitest";
import path from "node:path";
import { resolveExecutable, which } from "../../plugins/nereus/hooks/scripts/lib/exec.mjs";

describe("exec", () => {
  it("resolves bare command on posix via PATH", () => {
    const exists = (p: string) => p === "/usr/bin/git";
    expect(resolveExecutable("git", { platform: "darwin", env: { PATH: "/usr/local/bin:/usr/bin" }, exists, pathMod: path.posix })).toBe("/usr/bin/git");
    expect(resolveExecutable("nope", { platform: "darwin", env: { PATH: "/usr/bin" }, exists, pathMod: path.posix })).toBeNull();
  });
  it("tries PATHEXT extensions on win32", () => {
    const hit = path.win32.join("C:\\tools", "gemini.CMD");
    const exists = (p: string) => p === hit;
    const r = resolveExecutable("gemini", { platform: "win32", env: { Path: "C:\\tools;C:\\other", PATHEXT: ".COM;.EXE;.BAT;.CMD" }, exists, pathMod: path.win32 });
    expect(r).toBe(hit);
  });
  it("which returns boolean-ish presence", () => {
    expect(which("git", { platform: "darwin", env: { PATH: "/usr/bin" }, exists: (p: string) => p === "/usr/bin/git", pathMod: path.posix })).toBe("/usr/bin/git");
  });
});
