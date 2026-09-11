import { describe, it, expect } from "vitest";
import { isAcked, planUndo } from "../../plugins/nereus/hooks/scripts/lib/doctor-ledger.mjs";

const entry = { type: "apply", path: ["permissions", "deny"], before: undefined, after: ["mcp__chrome-devtools"], fileHash: "abc123" };

describe("isAcked", () => {
  it("silences a matching fingerprint and only that one", () => {
    const led = [{ type: "ack", fingerprint: "ff00" }];
    expect(isAcked(led, "ff00")).toBe(true);
    expect(isAcked(led, "ff01")).toBe(false);
  });
  it("treats an unack line as cancelling an earlier ack", () => {
    expect(isAcked([{ type: "ack", fingerprint: "ff00" }, { type: "unack", fingerprint: "ff00" }], "ff00")).toBe(false);
  });
});

describe("planUndo", () => {
  it("reverts when the file hash still matches", () => {
    expect(planUndo({ entry, currentFile: { hash: "abc123", valueAt: () => ["mcp__chrome-devtools"] } }))
      .toMatchObject({ action: "revert", reason: "hash-match" });
  });
  it("reverts only the recorded path when the file changed elsewhere", () => {
    expect(planUndo({ entry, currentFile: { hash: "zzz", valueAt: () => ["mcp__chrome-devtools"] } }))
      .toMatchObject({ action: "revert", reason: "path-intact" });
  });
  it("stops and reports when the recorded path itself changed", () => {
    const p = planUndo({ entry, currentFile: { hash: "zzz", valueAt: () => ["mcp__other"] } });
    expect(p.action).toBe("stop");
    expect(p.expected).toEqual(["mcp__chrome-devtools"]);
    expect(p.actual).toEqual(["mcp__other"]);
  });
  it("succeeds idempotently when the path is already gone", () => {
    expect(planUndo({ entry, currentFile: { hash: "zzz", valueAt: () => undefined } }))
      .toMatchObject({ action: "noop", reason: "path-absent" });
  });
});
