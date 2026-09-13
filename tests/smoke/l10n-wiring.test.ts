// 배선 가드. 라우트가 안 물리면 스킬이 존재하는데 아무도 부르지 않고, 아무 에러도 안 난다.
// 플러그인이 **넷**이 되면서 MAX_HITS=2 경쟁이 더 빡빡해졌다 — 라우트를 좁게 써야 한다.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = "plugins/nereus-l10n";
const PLUGINS = ["nereus", "nereus-game", "nereus-ads", "nereus-l10n"];
const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
  );

describe("nereus-l10n 배선", () => {
  it("마켓플레이스 등재와 매니페스트 이름·버전이 같다", () => {
    const mp = JSON.parse(fs.readFileSync(".claude-plugin/marketplace.json", "utf8"));
    const e = mp.plugins.find((p: any) => p.name === "nereus-l10n");
    expect(e, "마켓플레이스에 nereus-l10n 이 없다").toBeTruthy();
    const pj = JSON.parse(fs.readFileSync(`${ROOT}/.claude-plugin/plugin.json`, "utf8"));
    expect(e.version).toBe(pj.version);
  });

  it("라우트가 가리키는 스킬이 전부 있고 why 를 갖는다", () => {
    const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
    expect(ext.routes.length).toBeGreaterThanOrEqual(3);
    for (const r of ext.routes) {
      expect(fs.existsSync(`${ROOT}/skills/${r.skill.split(":")[1]}/SKILL.md`), r.skill).toBe(true);
      expect(r.why, `${r.skill} 에 why 가 없다`).toBeTruthy();
    }
  });

  // 라우트 없는 스킬은 존재하지만 도달할 수 없다.
  it("모든 스킬이 라우트를 갖는다", () => {
    const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
    const routed = new Set(ext.routes.map((r: any) => r.skill.split(":")[1]));
    for (const s of fs.readdirSync(`${ROOT}/skills`)) {
      expect(routed.has(s), `${s} 에 라우트가 없다 — 도달할 수 없다`).toBe(true);
    }
  });

  // `번역`·`언어` 단독은 너무 넓다. `현지화` 는 이 플러그인의 고유 어휘라 허용한다.
  it("라우트가 `번역`·`언어` 단독 단어로 잡지 않는다", () => {
    const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
    for (const r of ext.routes) {
      for (const w of ["번역", "언어"]) {
        expect(new RegExp(r.re, "i").test(w), `${r.skill} 이 "${w}" 단독을 잡는다`).toBe(false);
      }
    }
  });

  it.each(["skills", "agents"])("네 플러그인의 %s 이름이 겹치지 않는다", (kind) => {
    const names = (d: string) => (fs.existsSync(d) ? fs.readdirSync(d).map((f) => f.replace(/\.md$/, "")) : []);
    const all = PLUGINS.flatMap((p) => names(`plugins/${p}/${kind}`));
    const dupes = all.filter((n, i) => all.indexOf(n) !== i);
    expect(dupes, `${kind} 중복: ${dupes.join(", ")} — 한쪽이 다른 쪽을 가린다`).toEqual([]);
  });

  it("다른 플러그인을 import 하지 않는다 — 설치 조합에 따라 조용히 깨진다", () => {
    const SPEC = /(?:^|\s)(?:import\s[^;]*?from\s*|import\s*\(\s*|require\s*\(\s*)["'`]([^"'`]+)["'`]/g;
    for (const f of walk(ROOT).filter((x) => x.endsWith(".mjs"))) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(SPEC)) {
        expect(m[1], `${f} 가 ${m[1]} 을 import 한다`).not.toMatch(
          /nereus-game|nereus-ads|nereus\/hooks|hooks\/scripts\/lib|\.\.\/\.\.\//,
        );
      }
    }
  });
});

describe("nereus-game ↔ nereus-l10n 경계", () => {
  it("nereus-game 이 nereus-l10n 을 동반으로 선언한다", () => {
    const ext = JSON.parse(fs.readFileSync("plugins/nereus-game/nereus-extension.json", "utf8"));
    const c = (ext.companions ?? []).find((x: any) => x.id === "nereus-l10n");
    expect(c, "companions 에 nereus-l10n 이 없다").toBeTruthy();
    expect(c.why, "동반 선언에 why 가 없다").toBeTruthy();
    expect(c.marketplace).toBeTruthy();
  });

  // 형제 플러그인을 프로세스로 부르면 그쪽이 없을 때 조용히 깨진다.
  it("nereus-game 이 nereus-l10n 의 검사기를 부르지 않는다", () => {
    for (const f of walk("plugins/nereus-game").filter((x) => /\.(mjs|md)$/.test(x))) {
      expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/nereus-l10n\/lib/);
    }
  });

  // 이관한 모듈이 옛 자리에 남아 있으면 두 번째 출처가 된다.
  it("이관한 모듈이 nereus-game 에 남아 있지 않다", () => {
    for (const f of ["lib/l10n-scan.mjs", "lib/font-check.mjs", "lib/locales.mjs", "locales.json"]) {
      expect(fs.existsSync(`plugins/nereus-game/${f}`), `${f} 가 남아 있다`).toBe(false);
    }
  });
});
