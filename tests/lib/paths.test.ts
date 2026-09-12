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

import { latestHandoff, recentOtherSessions, planHandoffPrune } from "../../plugins/nereus/hooks/scripts/lib/paths.mjs";

const MIN = 60_000;
describe("handoff selection", () => {
  const now = 1_000 * MIN;
  it("picks the newest by mtime, not by file name", () => {
    const entries = [
      { name: "20260912-1400-bbbbbbbb.md", mtimeMs: now - 20 * MIN },
      { name: "20260912-0900-aaaaaaaa.md", mtimeMs: now - 2 * MIN },
    ];
    expect(latestHandoff({ cwd: "/repo", entries })).toBe(path.join("/repo", ".nereus", "handoff", "20260912-0900-aaaaaaaa.md"));
  });
  it("breaks an mtime tie by file name descending", () => {
    const entries = [
      { name: "20260912-0900-aaaaaaaa.md", mtimeMs: now },
      { name: "20260912-1400-bbbbbbbb.md", mtimeMs: now },
    ];
    expect(latestHandoff({ cwd: "/repo", entries })).toContain("20260912-1400-bbbbbbbb.md");
  });
  it("falls back to the legacy single file when the directory is empty", () => {
    expect(latestHandoff({ cwd: "/repo", entries: [], legacyExists: true })).toBe(path.join("/repo", ".nereus", "handoff.md"));
  });
  it("returns null when there is nothing to read", () => {
    expect(latestHandoff({ cwd: "/repo", entries: [], legacyExists: false })).toBeNull();
  });
  it("reports other sessions that wrote within the window, newest first", () => {
    const entries = [
      { name: "20260912-1400-aaaaaaaa.md", mtimeMs: now - 1 * MIN },
      { name: "20260912-1300-bbbbbbbb.md", mtimeMs: now - 5 * MIN },
      { name: "20260912-0100-cccccccc.md", mtimeMs: now - 90 * MIN },
    ];
    const out = recentOtherSessions({ entries, sessionId: "aaaaaaaa", now, windowMs: 30 * MIN });
    expect(out.map((e) => e.name)).toEqual(["20260912-1300-bbbbbbbb.md"]);
  });
  it("keeps the 10 newest and drops what is older than the max age", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `2026091${i % 10}-0900-s${i}0000000`.slice(0, 22) + ".md", mtimeMs: now - i * MIN }));
    const dropped = planHandoffPrune({ entries: many, now, keep: 10, maxAgeMs: 30 * 24 * 60 * MIN, protect: [] });
    expect(dropped).toHaveLength(2);
    expect(dropped).toContain(many[11].name);
  });
  it("never drops a protected file", () => {
    const entries = [
      { name: "20260912-1400-aaaaaaaa.md", mtimeMs: now - 400 * 24 * 60 * MIN },
      { name: "20260912-1300-bbbbbbbb.md", mtimeMs: now },
    ];
    const dropped = planHandoffPrune({ entries, now, keep: 1, maxAgeMs: MIN, protect: ["20260912-1400-aaaaaaaa.md"] });
    expect(dropped).toEqual([]);
  });
});
