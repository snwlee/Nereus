import { describe, it, expect } from "vitest";
import { autonomousGate } from "../../plugins/nereus/hooks/scripts/lib/autonomous-gate.mjs";

describe("autonomousGate", () => {
  it("failed gate returns bounded, never open retry", () => {
    const r = autonomousGate({ gateResult: { pass: false, reason: "gate-failed" }, changedFiles: ["a.ts"], budget: { turnsLeft: 5 } });
    expect(r.decision).toBe("return-bounded");
  });
  it("no changed files skips", () => {
    const r = autonomousGate({ gateResult: { pass: true }, changedFiles: [], budget: { turnsLeft: 5 } });
    expect(r.decision).toBe("skip");
  });
  it("exhausted budget returns bounded", () => {
    const r = autonomousGate({ gateResult: { pass: true }, changedFiles: ["a.ts"], budget: { turnsLeft: 0 } });
    expect(r.decision).toBe("return-bounded");
  });
  it("passed gate with changes proceeds", () => {
    const r = autonomousGate({ gateResult: { pass: true }, changedFiles: ["a.ts"], budget: { turnsLeft: 5 } });
    expect(r.decision).toBe("proceed");
  });
  it("missing pass flag fails closed", () => {
    const r = autonomousGate({ gateResult: {}, changedFiles: ["a.ts"], budget: { turnsLeft: 5 } });
    expect(r.decision).toBe("return-bounded");
  });
});
