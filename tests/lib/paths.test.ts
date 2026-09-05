import { describe, it, expect } from "vitest";
import path from "node:path";
import { userConfigDir, projectStateDir, handoffPath } from "../../plugins/nereus/hooks/scripts/lib/paths.mjs";

describe("paths", () => {
  it("returns %APPDATA%/nereus on win32", () => {
    const p = userConfigDir({ platform: "win32", env: { APPDATA: "C:\\Users\\me\\AppData\\Roaming" }, home: "C:\\Users\\me" });
    expect(p).toBe(path.join("C:\\Users\\me\\AppData\\Roaming", "nereus"));
  });
  it("falls back to home/AppData/Roaming when APPDATA missing on win32", () => {
    const p = userConfigDir({ platform: "win32", env: {}, home: "C:\\Users\\me" });
    expect(p).toBe(path.join("C:\\Users\\me", "AppData", "Roaming", "nereus"));
  });
  it("returns ~/.config/nereus on darwin and linux", () => {
    expect(userConfigDir({ platform: "darwin", env: {}, home: "/Users/me" })).toBe(path.join("/Users/me", ".config", "nereus"));
    expect(userConfigDir({ platform: "linux", env: {}, home: "/home/me" })).toBe(path.join("/home/me", ".config", "nereus"));
  });
  it("honors NEREUS_HOME override", () => {
    expect(userConfigDir({ platform: "darwin", env: { NEREUS_HOME: "/tmp/x" }, home: "/Users/me" })).toBe("/tmp/x");
  });
  it("project state dir and handoff path live under cwd/.nereus", () => {
    expect(projectStateDir("/repo")).toBe(path.join("/repo", ".nereus"));
    expect(handoffPath("/repo")).toBe(path.join("/repo", ".nereus", "handoff.md"));
  });
});
