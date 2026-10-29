import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(process.cwd(), "plugins/nereus/skills/montage/scripts/styles.mjs");
let lemo = "";
const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync("node", [CLI, ...args], { encoding: "utf8", env: { ...process.env, NEREUS_HOME: lemo, NEREUS_LEMO: lemo, ...env } });

beforeAll(() => {
  lemo = mkdtempSync(join(tmpdir(), "lemo-"));
  const style = (slug: string, json: object, md = "# x") => {
    mkdirSync(join(lemo, "styles", slug), { recursive: true });
    writeFileSync(join(lemo, "styles", slug, "style.json"), JSON.stringify({ slug, ...json }));
    writeFileSync(join(lemo, "styles", slug, "STYLE.md"), md);
  };
  style("art-deco", { en: "Art Deco", category_en: "Graphic & Type", line: "A grand hotel", uses: ["Luxury & hospitality", "Galas"] });
  style("living-screencast", { en: "Living Screencast", category_en: "Screen & UI", line: "desktop", uses: ["Developer tools"] });
  style("_template", { en: "T" });
  mkdirSync(join(lemo, "styles", "no-json"), { recursive: true });
});

describe("montage styles CLI [flow]", () => {
  it("list 는 템플릿·json 없는 폴더를 뺀다", () => {
    const r = run(["list"]);
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).styles.map((s: { slug: string }) => s.slug)).toEqual(["art-deco", "living-screencast"]);
  });
  it("pick — 광고면 차단 스타일 제외", () => {
    const r = run(["pick", "developer tools luxury", "--commercial"]);
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).picks.map((s: { slug: string }) => s.slug)).toEqual(["art-deco"]);
  });
  it("show 는 STYLE.md 경로와 본문", () => {
    const r = run(["show", "art-deco"]);
    const j = JSON.parse(r.stdout);
    expect(j.path).toBe(join(lemo, "styles", "art-deco", "STYLE.md"));
    expect(j.body).toBe("# x");
  });
  it("show 는 잘못된 slug 를 거부", () => {
    expect(run(["show", "../../etc"]).status).toBe(1);
    expect(run(["show", "nope"]).status).toBe(1);
  });
  it("companion 판정", () => {
    const r = run(["companion", "onetake", "--commercial", "--named"]);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).verdict).toBe("block");
  });
  it("Lemo 가 없으면 2 와 설치 안내", () => {
    const r = run(["list"], { NEREUS_LEMO: join(lemo, "missing") });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/git clone/);
  });
});
