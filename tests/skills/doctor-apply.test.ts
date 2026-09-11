import { describe, it, expect } from "vitest";
import { applyRemedy, ledgerPathFor } from "../../plugins/nereus/skills/doctor/scripts/apply.mjs";

const high = { severity: "HIGH", kind: "mcp-shadow", unit: "chrome-devtools", scope: "global", fingerprint: "aa", sides: [], remedy: { applicable: true, kind: "permissions-deny", value: "mcp__chrome-devtools" } };
const manual = { severity: "MEDIUM", kind: "double-gate", unit: "verification-before-completion", scope: "global", fingerprint: "bb", sides: [], remedy: { applicable: false, manual: "/plugin 에서 끄세요" } };

describe("applyRemedy", () => {
  it("adds the deny rule and records path, before, after and hash", () => {
    const r = applyRemedy({ conflict: high, settings: { permissions: { deny: ["Bash(rm)"] } }, now: 1 });
    expect(r.settings.permissions.deny).toEqual(["Bash(rm)", "mcp__chrome-devtools"]);
    expect(r.entry).toMatchObject({ type: "apply", path: ["permissions", "deny"], before: ["Bash(rm)"], after: ["Bash(rm)", "mcp__chrome-devtools"], fingerprint: "aa" });
    expect(typeof r.entry.fileHash).toBe("string");
  });
  it("records absence when the key did not exist", () => {
    const r = applyRemedy({ conflict: high, settings: {}, now: 1 });
    expect(r.entry.before).toBeUndefined();
    expect(r.settings.permissions.deny).toEqual(["mcp__chrome-devtools"]);
  });
  it("does not mutate the settings object it was given", () => {
    const original = { permissions: { deny: ["Bash(rm)"] } };
    applyRemedy({ conflict: high, settings: original, now: 1 });
    expect(original.permissions.deny).toEqual(["Bash(rm)"]);
  });
  it("refuses a remedy that is not applicable", () => {
    expect(() => applyRemedy({ conflict: manual, settings: {}, now: 1 })).toThrow(/수동/);
  });
  it("is idempotent when the deny rule is already present", () => {
    const r = applyRemedy({ conflict: high, settings: { permissions: { deny: ["mcp__chrome-devtools"] } }, now: 1 });
    expect(r.settings.permissions.deny).toEqual(["mcp__chrome-devtools"]);
    expect(r.entry).toBeNull();
  });
});

describe("ledgerPathFor", () => {
  it("keeps global findings in the user config dir", () => {
    expect(ledgerPathFor("global", { home: "/h", cwd: "/w" })).toBe("/h/.config/nereus/doctor-ledger.jsonl");
  });
  it("keeps project findings in the project so other projects stay noisy", () => {
    expect(ledgerPathFor("project", { home: "/h", cwd: "/w" })).toBe("/w/.nereus/doctor-ack.jsonl");
  });
});
