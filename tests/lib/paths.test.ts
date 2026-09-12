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

import { handoffDir, handoffFileName, sessionHandoffPath } from "../../plugins/nereus/hooks/scripts/lib/paths.mjs";

describe("session handoff path", () => {
  const now = new Date("2026-09-12T14:30:00").getTime();
  it("names a file by session start time and the first 8 chars of the session id", () => {
    expect(handoffFileName({ now, sessionId: "a1b2c3d4-e5f6-7890-aaaa-bbbbbbbbbbbb" })).toBe("20260912-1430-a1b2c3d4.md");
  });
  it("falls back to nosession when the session id is missing", () => {
    expect(handoffFileName({ now, sessionId: undefined })).toBe("20260912-1430-nosessio.md");
  });
  it("puts session handoffs under .nereus/handoff", () => {
    expect(handoffDir("/repo")).toBe(path.join("/repo", ".nereus", "handoff"));
  });
  it("creates a new path when no file of this session exists", () => {
    const p = sessionHandoffPath({ cwd: "/repo", sessionId: "a1b2c3d4xx", now, entries: [{ name: "20260911-0900-99999999.md", mtimeMs: 1 }] });
    expect(p).toBe(path.join("/repo", ".nereus", "handoff", "20260912-1430-a1b2c3d4.md"));
  });
  it("reuses this session's existing file after a compact", () => {
    const p = sessionHandoffPath({ cwd: "/repo", sessionId: "a1b2c3d4xx", now, entries: [{ name: "20260912-0900-a1b2c3d4.md", mtimeMs: 1 }] });
    expect(p).toBe(path.join("/repo", ".nereus", "handoff", "20260912-0900-a1b2c3d4.md"));
  });
});
