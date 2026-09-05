import { describe, it, expect } from "vitest";
import { workTreeHash, recordEvidence, evidenceStatus } from "../../plugins/nereus/hooks/scripts/lib/evidence.mjs";

const git = (map: Record<string, string>) => (args: string[]) => ({ ok: true, stdout: map[args.join(" ")] ?? "", stderr: "" });

describe("evidence gate", () => {
  it("hashes HEAD + status + diff deterministically", () => {
    const run = git({ "rev-parse HEAD": "abc\n", "status --porcelain": " M a.ts\n", "diff HEAD": "+x\n" });
    const h1 = workTreeHash("/r", { run });
    const h2 = workTreeHash("/r", { run });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{16}$/);
    const run2 = git({ "rev-parse HEAD": "abc\n", "status --porcelain": " M a.ts\n", "diff HEAD": "+y\n" });
    expect(workTreeHash("/r", { run: run2 })).not.toBe(h1);
  });
  it("records evidence and reports FRESH, then STALE after tree changes, MISSING when absent", () => {
    let store: string | null = null;
    const io = { readFile: () => { if (store === null) throw new Error("ENOENT"); return store; }, writeFile: (_: string, s: string) => { store = s; } };
    let tree = "aaaa";
    const hash = () => tree;
    expect(evidenceStatus("/r", { ...io, hash })).toEqual({ status: "MISSING" });
    recordEvidence("/r", { command: "npm test", exitCode: 0 }, { ...io, hash, now: 1000 });
    expect(evidenceStatus("/r", { ...io, hash })).toMatchObject({ status: "FRESH", exitCode: 0, command: "npm test" });
    tree = "bbbb";
    expect(evidenceStatus("/r", { ...io, hash })).toMatchObject({ status: "STALE" });
  });
  it("FRESH with non-zero exit is still reported as failing evidence", () => {
    let store: string | null = null;
    const io = { readFile: () => { if (store === null) throw new Error("ENOENT"); return store; }, writeFile: (_: string, s: string) => { store = s; }, hash: () => "h", now: 1 };
    recordEvidence("/r", { command: "npm test", exitCode: 1 }, io);
    expect(evidenceStatus("/r", io)).toMatchObject({ status: "FRESH", exitCode: 1, passing: false });
  });
});
