import { describe, it, expect } from "vitest";
import { readLedger, appendLedger, writeSettingsAtomic } from "../../plugins/nereus/skills/doctor/scripts/ledger-io.mjs";

describe("readLedger", () => {
  it("parses one object per line and ignores blank lines", () => {
    const out = readLedger({ file: "/l.jsonl", readText: () => '{"type":"ack","fingerprint":"aa"}\n\n{"type":"unack","fingerprint":"aa"}\n' });
    expect(out.map((e: any) => e.type)).toEqual(["ack", "unack"]);
  });
  it("skips a corrupt line instead of discarding the whole ledger", () => {
    const out = readLedger({ file: "/l.jsonl", readText: () => '{"type":"ack"}\nnot json\n{"type":"unack"}\n' });
    expect(out).toHaveLength(2);
  });
  it("returns an empty list when the file is missing", () => {
    expect(readLedger({ file: "/nope", readText: () => { throw new Error("ENOENT"); } })).toEqual([]);
  });
});

describe("appendLedger", () => {
  it("appends exactly one newline terminated line", () => {
    const wrote: string[] = [];
    appendLedger({ file: "/l.jsonl", entry: { type: "ack", fingerprint: "aa" }, appendText: (f: string, s: string) => { wrote.push(s); }, mkdir: () => {} });
    expect(wrote).toHaveLength(1);
    expect(wrote[0].endsWith("\n")).toBe(true);
    expect(JSON.parse(wrote[0])).toMatchObject({ type: "ack", fingerprint: "aa" });
  });
  it("creates the parent directory before appending", () => {
    const calls: string[] = [];
    appendLedger({ file: "/a/b/l.jsonl", entry: { type: "ack" }, appendText: () => { calls.push("append"); }, mkdir: () => { calls.push("mkdir"); } });
    expect(calls).toEqual(["mkdir", "append"]);
  });
});

describe("writeSettingsAtomic", () => {
  it("writes a temp file first and renames it over the target", () => {
    const seq: string[] = [];
    writeSettingsAtomic({ file: "/s.json", settings: { a: 1 }, writeText: (f: string) => { seq.push("write:" + f); }, rename: (from: string, to: string) => { seq.push("rename:" + from + " to " + to); } });
    expect(seq).toHaveLength(2);
    expect(seq[0].startsWith("write:/s.json.")).toBe(true);
    expect(seq[1].endsWith(" to /s.json")).toBe(true);
  });
  it("does not rename when the write fails, so the target stays intact", () => {
    let renamed = false;
    expect(() => writeSettingsAtomic({ file: "/s.json", settings: { a: 1 }, writeText: () => { throw new Error("disk full"); }, rename: () => { renamed = true; } })).toThrow();
    expect(renamed).toBe(false);
  });
});
