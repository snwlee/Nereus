import { describe, it, expect } from "vitest";
import { detect, renderTable, TOOLS } from "../../plugins/nereus/skills/setup/scripts/detect.mjs";

describe("setup detect", () => {
  it("declares required and optional tools with per-platform installers", () => {
    const required = TOOLS.filter((t) => t.required).map((t) => t.bin);
    expect(required).toEqual(expect.arrayContaining(["codegraph", "ooo", "ocr", "specify", "openspec", "typst", "gemini", "codex"]));
    for (const t of TOOLS) {
      expect(t.install.darwin).toBeTruthy();
      expect(t.install.win32).toBeTruthy();
    }
  });
  it("reports present/missing using injected probe and platform", () => {
    const probe = (bin: string) => ["node", "git", "typst"].includes(bin);
    const r = detect({ platform: "win32", probe });
    const byBin = Object.fromEntries(r.map((x: any) => [x.bin, x]));
    expect(byBin.typst.present).toBe(true);
    expect(byBin.ocr.present).toBe(false);
    expect(byBin.ocr.installCmd).toContain("npm");
    expect(byBin.git.present).toBe(true);
  });
  it("renders a markdown table with status marks", () => {
    const table = renderTable(detect({ platform: "darwin", probe: (b: string) => b === "git" }));
    expect(table).toContain("| git |");
    expect(table).toMatch(/✅|❌/);
    expect(table).toContain("필수");
  });
});
