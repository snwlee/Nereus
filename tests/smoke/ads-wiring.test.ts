// 배선 가드: nereus-ads 는 "선언하고 배선하지 않는 것" 이 가장 조용하게 터지는 플러그인이다.
// 라우트가 안 물리면 스킬이 존재하는데 아무도 부르지 않고, 아무 에러도 안 난다.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = "plugins/nereus-ads";

describe("nereus-ads 배선", () => {
  it("마켓플레이스 등재와 매니페스트 이름·버전이 같다", () => {
    const mp = JSON.parse(fs.readFileSync(".claude-plugin/marketplace.json", "utf8"));
    const e = mp.plugins.find((p: any) => p.name === "nereus-ads");
    expect(e, "마켓플레이스에 nereus-ads 가 없다").toBeTruthy();
    const pj = JSON.parse(fs.readFileSync(`${ROOT}/.claude-plugin/plugin.json`, "utf8"));
    expect(e.version).toBe(pj.version);
  });

  it("라우트가 가리키는 스킬이 전부 있다", () => {
    const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
    expect(ext.routes.length).toBeGreaterThanOrEqual(3);
    for (const r of ext.routes) {
      expect(fs.existsSync(`${ROOT}/skills/${r.skill.split(":")[1]}/SKILL.md`), r.skill).toBe(true);
      expect(r.why, `${r.skill} 에 why 가 없다`).toBeTruthy();
    }
  });

  // 세 스킬 전부가 라우트를 가져야 한다. 하나만 빠지면 그 스킬은 존재하지만 도달할 수 없다.
  it("모든 스킬이 라우트를 갖는다", () => {
    const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
    const routed = new Set(ext.routes.map((r: any) => r.skill.split(":")[1]));
    for (const skill of fs.readdirSync(`${ROOT}/skills`)) {
      expect(routed.has(skill), `${skill} 스킬에 라우트가 없다 — 도달할 수 없다`).toBe(true);
    }
  });

  // `광고` 단독 단어는 nereus-game:compliance · ad-video 델리게이트와 경쟁한다.
  // 플러그인이 셋이고 MAX_HITS 가 2 라, 넓은 라우트 하나가 다른 둘의 자리를 뺏는다.
  it("라우트가 `광고` 단독 단어로 잡지 않는다", () => {
    const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
    for (const r of ext.routes) {
      expect(new RegExp(r.re, "i").test("광고"), `${r.skill} 이 광고 단독 단어를 잡는다`).toBe(false);
    }
  });

  // **종류별로** 본다. 한 플러그인 안에서 스킬과 에이전트가 같은 이름을 쓰는 것은
  // 정상이고(`nereus:seo` 가 그렇다) 네임스페이스가 다르다. 실제 사고(`writer`, 2026-09-13)는
  // 두 플러그인의 **에이전트끼리** 겹친 것이었다. 기준을 넓히면 진짜가 정상 쌍에 묻힌다.
  it.each(["skills", "agents"])("세 플러그인의 %s 이름이 겹치지 않는다", (kind) => {
    const names = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => f.replace(/\.md$/, "")) : []);
    const all = ["nereus", "nereus-game", "nereus-ads", "nereus-l10n"].flatMap((p) => names(`plugins/${p}/${kind}`));
    const dupes = all.filter((n, i) => all.indexOf(n) !== i);
    expect(dupes, `${kind} 중복: ${dupes.join(", ")} — 한쪽이 다른 쪽을 가린다`).toEqual([]);
  });

  it("다른 플러그인을 import 하지 않는다 — 설치 조합에 따라 조용히 깨진다", () => {
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
      );
    // **import 지정자만** 본다. 주석에 다른 플러그인 이름이 나오는 것은 정상이다 —
    // 규율의 출처를 적는 것까지 금지하면 이유가 사라진다.
    const SPECIFIER = /(?:^|\s)(?:import\s[^;]*?from\s*|import\s*\(\s*|require\s*\(\s*)["'`]([^"'`]+)["'`]/g;
    for (const f of walk(ROOT).filter((x) => x.endsWith(".mjs"))) {
      const src = fs.readFileSync(f, "utf8");
      for (const m of src.matchAll(SPECIFIER)) {
        expect(m[1], `${f} 가 ${m[1]} 을 import 한다`).not.toMatch(/nereus-game|nereus\/hooks|hooks\/scripts\/lib|\.\.\/\.\.\//);
      }
    }
  });
});
