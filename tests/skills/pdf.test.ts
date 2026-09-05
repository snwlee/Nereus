import { describe, it, expect } from "vitest";
import { pickEngine, templatePath, compile, TEMPLATES } from "../../plugins/nereus/skills/pdf/scripts/pdf.mjs";

describe("pdf", () => {
  it("ships four typst templates and one latex", () => {
    expect(Object.keys(TEMPLATES.typst)).toEqual(["report", "adr", "research", "spec"]);
    expect(Object.keys(TEMPLATES.latex)).toEqual(["report"]);
  });
  it("picks typst by default, latex only when requested and available", () => {
    const has = (b: string) => ["typst", "xelatex"].includes(b);
    expect(pickEngine({ requested: undefined, config: { engine: "typst" }, available: has })).toEqual({ engine: "typst", bin: "typst" });
    expect(pickEngine({ requested: "latex", config: { engine: "typst" }, available: has })).toEqual({ engine: "latex", bin: "xelatex" });
    expect(pickEngine({ requested: "latex", config: { engine: "typst" }, available: (b: string) => b === "typst" })).toEqual({ engine: "typst", bin: "typst", fallback: "xelatex 없음" });
    expect(pickEngine({ requested: undefined, config: { engine: "typst" }, available: () => false })).toEqual({ engine: null, bin: null, fallback: "typst 없음" });
  });
  it("resolves template path and rejects unknown", () => {
    expect(templatePath("typst", "adr")).toMatch(/templates[\\/]typst[\\/]adr\.typ$/);
    expect(() => templatePath("typst", "nope")).toThrow();
  });
  it("compiles via injected runner and surfaces errors with line info", () => {
    const calls: any[] = [];
    const ok = compile({ engine: "typst", bin: "typst", input: "/d/a.typ", output: "/d/a.pdf", font: "Noto Sans KR", fontDir: "/f" }, { run: (b: string, a: string[]) => { calls.push([b, a]); return { ok: true, stdout: "", stderr: "" }; } });
    expect(ok.ok).toBe(true);
    expect(calls[0][0]).toBe("typst");
    expect(calls[0][1]).toEqual(expect.arrayContaining(["compile", "/d/a.typ", "/d/a.pdf", "--font-path", "/f"]));
    const bad = compile({ engine: "typst", bin: "typst", input: "/d/a.typ", output: "/d/a.pdf" }, { run: () => ({ ok: false, stdout: "", stderr: "error: unknown variable\n  ┌─ a.typ:12:5" }) });
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain("a.typ:12:5");
  });
});
