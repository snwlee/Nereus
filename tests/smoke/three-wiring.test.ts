import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = "plugins/nereus-3d";
const PLUGINS = ["nereus", "nereus-game", "nereus-ads", "nereus-l10n", "nereus-3d"];
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

describe("nereus-3d 배선", () => {
  it("마켓플레이스 등재와 매니페스트 이름·버전이 같다", () => {
    const mp = JSON.parse(fs.readFileSync(".claude-plugin/marketplace.json", "utf8"));
    const e = mp.plugins.find((p: any) => p.name === "nereus-3d");
    const pj = JSON.parse(fs.readFileSync(`${ROOT}/.claude-plugin/plugin.json`, "utf8"));
    expect(e.version).toBe(pj.version);
  });
  it("모든 스킬이 라우트를 갖고 why 가 있다", () => {
    const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
    const routed = new Set(ext.routes.map((r: any) => r.skill.split(":")[1]));
    for (const s of fs.readdirSync(`${ROOT}/skills`)) expect(routed.has(s), s).toBe(true);
    for (const r of ext.routes) expect(r.why, r.skill).toBeTruthy();
  });
  it("라우트가 `3D`·`씬`·`렌더` 단독 단어로 잡지 않는다", () => {
    const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
    for (const r of ext.routes) for (const w of ["3D", "씬", "렌더"]) {
      expect(new RegExp(r.re, "i").test(w), `${r.skill} 이 "${w}" 를 잡는다`).toBe(false);
    }
  });
  it.each(["skills", "agents"])("다섯 플러그인의 %s 이름이 겹치지 않는다", (kind) => {
    const names = (d: string) => (fs.existsSync(d) ? fs.readdirSync(d).map((f) => f.replace(/\.md$/, "")) : []);
    const all = PLUGINS.flatMap((p) => names(`plugins/${p}/${kind}`));
    expect(all.filter((n, i) => all.indexOf(n) !== i)).toEqual([]);
  });
  it("다른 플러그인을 import 하지 않는다", () => {
    const SPEC = /(?:^|\s)(?:import\s[^;]*?from\s*|import\s*\(\s*|require\s*\(\s*)["'`]([^"'`]+)["'`]/g;
    for (const f of walk(ROOT).filter((x) => x.endsWith(".mjs"))) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(SPEC)) {
        expect(m[1], f).not.toMatch(/nereus-game|nereus-ads|nereus-l10n|nereus\/hooks|hooks\/scripts\/lib|\.\.\/\.\.\//);
      }
    }
  });
});
