import { describe, it, expect } from "vitest";
import { scanGate } from "../../plugins/nereus/skills/skill-audit/scripts/scan-gate.mjs";

describe("skill scan gate", () => {
  it("blocks on single critical", () => {
    const r = scanGate({ findings: [{ severity: "critical", id: "prompt-injection", message: "hidden instruction" }] });
    expect(r.install).toBe(false);
    expect(r.blocking).toHaveLength(1);
  });
  it("warns but passes medium-only", () => {
    const r = scanGate({ findings: [{ severity: "medium", id: "m1", message: "minor" }] });
    expect(r.install).toBe(true);
    expect(r.blocking).toHaveLength(0);
    expect(r.warnings).toHaveLength(1);
  });
  it("fails closed malformed", () => {
    const r = scanGate(null);
    expect(r.install).toBe(false);
    expect(r.blocking.length).toBeGreaterThan(0);
  });
  it("accepts clean", () => {
    const r = scanGate({ findings: [] });
    expect(r.install).toBe(true);
    expect(r.blocking).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
  });
});
