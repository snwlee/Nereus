import { describe, it, expect } from "vitest";
import path from "node:path";
import { detect, detectDirs, renderTable, TOOLS, DIR_TOOLS } from "../../plugins/nereus/skills/setup/scripts/detect.mjs";

// detectDirs 는 path.join 으로 후보를 만든다 — 기대 경로는 POSIX 로 쓰고 플랫폼 구분자로 정규화해 비교한다
const j = (...seg: string[]) => path.join(...seg);

describe("setup detect", () => {
  it("declares required and optional tools with per-platform installers", () => {
    const required = TOOLS.filter((t) => t.required).map((t) => t.bin);
    expect(required).toEqual(expect.arrayContaining(["codegraph", "ooo", "ocr", "specify", "openspec", "typst", "python3"]));
    // 2026-11-12: 제3자 검증은 EGM(서브에이전트)이 기본이다. codex 는 opt-in 이라 필수가 아니고,
    // agy 는 리뷰·디자인 어디에도 쓰지 않아 목록에서 빠졌다. python3 는 이미지(Gemini 무료)·ui-ux-pro-max 용이다.
    expect(required).not.toContain("codex");
    expect(TOOLS.map((t: any) => t.bin)).not.toContain("agy");
    expect(TOOLS.find((t: any) => t.bin === "python3").label).not.toMatch(/2차 의견|디자인 비평/);
    for (const t of TOOLS) {
      expect(t.install.darwin).toBeTruthy();
      expect(t.install.win32).toBeTruthy();
    }
  });
  it("scrapling 은 선택이고 Markdown extra 와 브라우저 설치 함정을 note 로 적는다", () => {
    // 2026-11-12: 조사의 차단 우회는 CloakBrowser → Scrapling (스파이크 4/6 vs 2~3/6).
    expect(TOOLS.map((x: any) => x.bin)).not.toContain("cloakbrowser");
    const t = TOOLS.find((x: any) => x.bin === "scrapling");
    expect(t, "scrapling 행").toBeTruthy();
    expect(t.required).toBe(false);
    // [fetchers] 만으로는 Markdown 변환이 markdownify 없음으로 죽는다.
    expect(t.install.win32).toContain("scrapling[fetchers,ai]");
    // `scrapling install` 은 성공이라 찍고 브라우저를 안 받는 일이 있었다(Windows 실측).
    expect(t.note).toMatch(/patchright install chromium/);
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
    const engine = j(home, ".local", "share", "nereus", "ui-ux-pro-max", ".claude", "skills", "ui-ux-pro-max", "scripts", "search.py");
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
