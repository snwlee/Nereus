import { describe, it, expect } from "vitest";
import { detect, detectDirs, renderTable, TOOLS, DIR_TOOLS } from "../../plugins/nereus/skills/setup/scripts/detect.mjs";

describe("setup detect", () => {
  it("declares required and optional tools with per-platform installers", () => {
    const required = TOOLS.filter((t) => t.required).map((t) => t.bin);
    expect(required).toEqual(expect.arrayContaining(["codegraph", "ooo", "ocr", "specify", "openspec", "typst", "agy", "codex"]));
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

describe("setup detectDirs", () => {
  it("declares the design system generator as a directory-installed engine", () => {
    const keys = DIR_TOOLS.map((t: any) => t.key);
    expect(keys).toContain("ui-ux-pro-max");
    for (const t of DIR_TOOLS) {
      expect(typeof t.dirs).toBe("function");
      expect(t.install).toMatch(/\S/);
      expect(t.label).toMatch(/\S/);
    }
  });

  it("reports present when any candidate directory holds the entry file", () => {
    const home = "/home/u";
    const engine = `${home}/.local/share/nereus/ui-ux-pro-max/.claude/skills/ui-ux-pro-max/scripts/search.py`;
    const rows = detectDirs({ home, cwd: "/repo", exists: (p: string) => p === engine });
    const row = rows.find((r: any) => r.bin === "ui-ux-pro-max");
    expect(row.present).toBe(true);
    expect(row.installCmd).toMatch(/git clone/);
  });

  it("reports missing with an install command when no candidate exists", () => {
    const rows = detectDirs({ home: "/home/u", cwd: "/repo", exists: () => false });
    const row = rows.find((r: any) => r.bin === "ui-ux-pro-max");
    expect(row.present).toBe(false);
    expect(row.required).toBe(false);
  });

  it("shapes rows so renderTable can print them alongside binary tools", () => {
    const table = renderTable(detectDirs({ home: "/home/u", cwd: "/repo", exists: () => false }));
    expect(table).toContain("| ui-ux-pro-max |");
    expect(table).toContain("❌");
  });
});
