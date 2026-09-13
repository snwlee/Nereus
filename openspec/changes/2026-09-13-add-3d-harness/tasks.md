# tasks — add-3d-harness

`/Volumes/SKHY1TB/workspace/FindDifferences3D` 는 **읽기 전용**이다. 고치지 않는다.
이 저장소에 병렬 세션이 붙는다 — 커밋 전 `git log` 를 본다.

- [x] T1. 플러그인 뼈대와 텍스처 슬롯 데이터
  - Files: Create `plugins/nereus-3d/.claude-plugin/plugin.json` · Create `plugins/nereus-3d/three-budget.json` · Create `plugins/nereus-3d/lib/cli-input.mjs` · Create `plugins/nereus-3d/lib/budget-data.mjs` · Modify `.claude-plugin/marketplace.json` · Create `tests/lib/three-budget-data.test.ts`
  - Interfaces: Produces `loadBudgetData(): { source, checkedAt, textureSlots, textureSlotsWhy }`
  - Steps:
    - [x] 실패 테스트를 `tests/lib/three-budget-data.test.ts` 에 쓴다:
      ```ts
      import { describe, it, expect } from "vitest";
      import { loadBudgetData } from "../../plugins/nereus-3d/lib/budget-data.mjs";
      describe("텍스처 슬롯 데이터", () => {
        it("슬롯 목록이 데이터다", () => {
          const d = loadBudgetData();
          expect(d.textureSlots).toContain("map");
          expect(d.textureSlots).toContain("normalMap");
          expect(d.textureSlots.length).toBeGreaterThanOrEqual(8);
        });
        it("출처와 확인일이 있다", () => {
          const d = loadBudgetData();
          expect(d.source).toMatch(/^https:\/\//);
          expect(d.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
        it("왜 데이터인지 적혀 있다", () => {
          expect(loadBudgetData().textureSlotsWhy.length).toBeGreaterThan(0);
        });
        it("중복 슬롯이 없다", () => {
          const s = loadBudgetData().textureSlots;
          expect(s.length).toBe(new Set(s).size);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/three-budget-data.test.ts` · Expected: FAIL (모듈 없음)
    - [x] `plugin.json` 을 쓴다: name `nereus-3d`, version `0.1.0`, license `MIT`.
    - [x] `three-budget.json` 을 쓴다. `textureSlots` 는 three.js 머티리얼의 텍스처 슬롯이다:
          **추측하지 않고 실제 번들에서 뽑았다** — 도너 동봉 `three.module.js`(r160)에서
          `this.<name>map|Map = null` 을 추출해 **26종**. `matcap` 은 `Map` 으로 끝나지 않아
          손으로 더했고, 소문자 `this.map` 은 `[a-zA-Z]+Map` 이 놓쳐 테스트가 잡았다.
          `source` 는 three.js 머티리얼 문서 URL, `checkedAt` 은 오늘 날짜.
          `textureSlotsWhy` 에 "three.js 가 정하고 three.js 가 바꾸는 값이라 코드에 박지 않는다"를 적는다.
          **예산 기본값을 넣지 않는다** — 운영값이라 여기 두면 정책인 척하면서 낡는다.
    - [x] `lib/cli-input.mjs` 를 **이 플러그인의 것으로** 쓴다. 다른 플러그인에서 import 하지 않는다.
          `runCli` 는 사유만 stderr 로 내고 1 로 끝난다. 성공 경로에서 `process.exit(0)` 을 부르지 않는다.
    - [x] `lib/budget-data.mjs` 에 `loadBudgetData` 를 쓴다. 경로는 `fileURLToPath` 로 잡는다.
    - [x] 마켓플레이스에 `nereus-3d` 항목을 더한다(`source: ./plugins/nereus-3d`, version 일치).
    - [x] 통과 확인: Run `npx vitest run tests/lib/three-budget-data.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-3d .claude-plugin/marketplace.json tests/lib && git commit -m "feat(3d): 플러그인 뼈대와 텍스처 슬롯 데이터"`
  - Done when: `claude plugin validate plugins/nereus-3d` 가 통과하고 네 테스트가 초록이다

- [x] T2. 정적 검사기 — 불완전한 dispose
  - Files: Create `plugins/nereus-3d/lib/scene-scan.mjs` · Create `tests/lib/scene-scan.test.ts`
  - Interfaces: Produces `scanScene({ sources, data }): { violations, unmeasured }`
  - Steps:
    - [x] 실패 테스트를 `tests/lib/scene-scan.test.ts` 에 쓴다:
      ```ts
      import { describe, it, expect } from "vitest";
      import { scanScene } from "../../plugins/nereus-3d/lib/scene-scan.mjs";
      const codes = (r: any) => r.violations.map((v: any) => v.code);
      const MAP_ONLY = `function disposeSubtree(object) {
        object.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (child.material.map && child.material.map.dispose) child.material.map.dispose();
            child.material.dispose();
          }
        });
      }
      disposeSubtree(root);`;
      const SWEEP = `function disposeMaterial(material) {
        for (const key in material) {
          const value = material[key];
          if (value && value.isTexture) value.dispose();
        }
        material.dispose();
      }
      disposeMaterial(m);`;
      describe("불완전한 dispose", () => {
        it("map 만 정리하면 잡는다 — 나머지 슬롯은 GPU 에 남는다", () => {
          const r = scanScene({ sources: [{ file: "a.js", text: MAP_ONLY }] });
          const v = r.violations.find((x: any) => x.code === "incomplete-dispose");
          expect(v.missingSlots).toContain("normalMap");
          expect(v.missingSlots).not.toContain("map");
        });
        it("속성을 순회하면 통과한다 — 새 슬롯이 추가돼도 덮인다", () => {
          const r = scanScene({ sources: [{ file: "b.js", text: SWEEP }] });
          expect(codes(r)).not.toContain("incomplete-dispose");
        });
        it("지오메트리만 정리하는 함수는 대상이 아니다", () => {
          const text = `function f(o){ o.geometry.dispose(); }\nf(x);`;
          const r = scanScene({ sources: [{ file: "c.js", text }] });
          expect(codes(r)).not.toContain("incomplete-dispose");
        });
        it("정규식 기반임을 항상 밝힌다", () => {
          const r = scanScene({ sources: [] });
          expect(r.unmeasured.map((u: any) => u.what).join(" ")).toMatch(/파서/);
          for (const u of r.unmeasured) expect(u.why.length).toBeGreaterThan(0);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/scene-scan.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 구현한다. 슬롯 목록은 `budget-data.mjs` 에서 읽는다 — 코드에 박지 않는다.
          본문에 `isTexture` 가 있으면 완전으로 본다. 없으면 언급된 슬롯을 세어 빠진 것을 낸다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/scene-scan.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-3d/lib tests/lib/scene-scan.test.ts && git commit -m "feat(3d): 불완전한 dispose 정적 검사"`
  - Done when: 네 시나리오가 통과한다

- [x] T3. 정적 검사기 — 배선되지 않은 dispose 와 계측 부재
  - Files: Modify `plugins/nereus-3d/lib/scene-scan.mjs` · Modify `tests/lib/scene-scan.test.ts`
  - Interfaces: Produces `violations` 에 `dispose-unwired` · `instrumentation-missing`
  - Steps:
    - [x] 실패 테스트를 덧붙인다:
      ```ts
      describe("배선과 계측", () => {
        it("정의만 되고 호출이 없으면 잡는다", () => {
          const text = `function disposeAll(o){ for (const key in o) { const v=o[key]; if (v && v.isTexture) v.dispose(); } o.dispose(); }`;
          const r = scanScene({ sources: [{ file: "a.js", text }] });
          const v = r.violations.find((x: any) => x.code === "dispose-unwired");
          expect(v.fn).toBe("disposeAll");
        });
        it("자기 정의 밖에서 호출되면 통과한다", () => {
          const text = `function disposeAll(o){ for (const key in o) { const v=o[key]; if (v && v.isTexture) v.dispose(); } o.dispose(); }\ndisposeAll(root);`;
          const r = scanScene({ sources: [{ file: "a.js", text }] });
          expect(codes(r)).not.toContain("dispose-unwired");
        });
        it("다른 파일에서 호출돼도 통과한다", () => {
          const a = `function disposeAll(o){ for (const key in o) { const v=o[key]; if (v && v.isTexture) v.dispose(); } o.dispose(); }`;
          const r = scanScene({ sources: [{ file: "a.js", text: a }, { file: "b.js", text: "disposeAll(root);" }] });
          expect(codes(r)).not.toContain("dispose-unwired");
        });
        it("호출 지점 수를 같이 낸다", () => {
          const a = `function disposeAll(o){ for (const key in o) { const v=o[key]; if (v && v.isTexture) v.dispose(); } o.dispose(); }\ndisposeAll(a);\ndisposeAll(b);`;
          const r = scanScene({ sources: [{ file: "a.js", text: a }] });
          expect(r.disposeHelpers.find((h: any) => h.fn === "disposeAll").callSites).toBe(2);
        });
        it("renderer.info 를 아무도 안 읽으면 잡는다 — 측정 자체가 불가능하다", () => {
          const r = scanScene({ sources: [{ file: "a.js", text: "const x = 1;" }] });
          expect(codes(r)).toContain("instrumentation-missing");
        });
        it("한 곳이라도 읽으면 통과한다", () => {
          const r = scanScene({ sources: [{ file: "a.js", text: "console.log(renderer.info.render.calls);" }] });
          expect(codes(r)).not.toContain("instrumentation-missing");
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/scene-scan.test.ts` · Expected: FAIL
    - [x] 구현한다. 호출 탐지는 **전체 소스 집합**에서 본다 — 파일 하나만 보면 다른 파일의
          호출을 놓쳐 거짓 위반을 낸다. 함수 정의 본문 안의 재귀 호출은 호출로 세지 않는다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/scene-scan.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-3d/lib tests/lib/scene-scan.test.ts && git commit -m "feat(3d): 배선되지 않은 dispose 와 계측 부재 검사"`
  - Done when: 여섯 시나리오가 통과한다

- [x] T4. 렌더 예산 검사기와 누수 판정
  - Files: Create `plugins/nereus-3d/lib/render-budget.mjs` · Create `tests/lib/render-budget.test.ts`
  - Interfaces: Produces `checkRenderBudget({ samples, budgets }): { violations, unmeasured }`
  - Steps:
    - [x] 실패 테스트를 `tests/lib/render-budget.test.ts` 에 쓴다:
      ```ts
      import { describe, it, expect } from "vitest";
      import { checkRenderBudget } from "../../plugins/nereus-3d/lib/render-budget.mjs";
      const codes = (r: any) => r.violations.map((v: any) => v.code);
      const info = (calls: number, geometries: number) =>
        ({ render: { calls, triangles: 1000 }, memory: { geometries, textures: 4 }, programs: 3 });
      describe("렌더 예산", () => {
        it("상한을 넘으면 잡는다", () => {
          const r = checkRenderBudget({ samples: [{ label: "s1", info: info(300, 10) }], budgets: { calls: 100 } });
          const v = r.violations.find((x: any) => x.code === "budget-exceeded");
          expect(v.axis).toBe("calls");
          expect(v.value).toBe(300);
          expect(v.limit).toBe(100);
        });
        it("상한 이하면 통과한다", () => {
          const r = checkRenderBudget({ samples: [{ label: "s1", info: info(50, 10) }], budgets: { calls: 100 } });
          expect(codes(r)).not.toContain("budget-exceeded");
        });
        it("기준이 없으면 판정하지 않고 그 사실을 싣는다", () => {
          const r = checkRenderBudget({ samples: [{ label: "s1", info: info(9999, 10) }] });
          expect(r.violations).toEqual([]);
          expect(r.unmeasured.map((u: any) => u.what).join(" ")).toMatch(/예산/);
        });
        it("증거가 없으면 던지지 않는다", () => {
          const r = checkRenderBudget({ budgets: { calls: 100 } });
          expect(r.violations).toEqual([]);
          expect(r.unmeasured.map((u: any) => u.what).join(" ")).toMatch(/표본/);
        });
        it("같은 라벨에서 늘면 누수로 본다", () => {
          const r = checkRenderBudget({ samples: [
            { label: "scene-1", info: info(50, 120) },
            { label: "scene-1", info: info(50, 240) },
          ] });
          const v = r.violations.find((x: any) => x.code === "leak-suspected");
          expect(v.axis).toBe("geometries");
          expect(v.from).toBe(120);
          expect(v.to).toBe(240);
        });
        it("같은 라벨에서 안 늘면 통과한다", () => {
          const r = checkRenderBudget({ samples: [
            { label: "scene-1", info: info(50, 120) },
            { label: "scene-1", info: info(50, 120) },
          ] });
          expect(codes(r)).not.toContain("leak-suspected");
        });
        it("표본이 하나뿐이면 누수를 판정하지 않는다 — 수가 큰 것은 큰 씬일 수 있다", () => {
          const r = checkRenderBudget({ samples: [{ label: "scene-1", info: info(50, 99999) }] });
          expect(codes(r)).not.toContain("leak-suspected");
          expect(r.unmeasured.map((u: any) => u.what).join(" ")).toMatch(/누수/);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/render-budget.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 구현한다. 누수 축은 `memory.geometries` 와 `memory.textures` 만 본다 —
          `render.calls` 는 프레임마다 달라 누수 축이 아니다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/render-budget.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-3d/lib tests/lib/render-budget.test.ts && git commit -m "feat(3d): 렌더 예산과 누수 판정"`
  - Done when: 일곱 시나리오가 통과한다

- [ ] T5. 스킬 2종·에이전트·README
  - Files: Create `plugins/nereus-3d/skills/threejs/SKILL.md` · Create `plugins/nereus-3d/skills/renderbudget/SKILL.md` · Create `plugins/nereus-3d/agents/graphics-engineer.md` · Create `plugins/nereus-3d/README.md`
  - Interfaces: 없음
  - Steps:
    - [ ] `skills/threejs/SKILL.md` — 정적 검사. `scene-scan.mjs` 호출법.
          **문서는 Context7 `/mrdoob/three.js` 와 pmndrs MCP 로 조회하고 여기 복사하지 않는다**를
          원칙으로 적는다. 도너의 두 dispose 구현 비교를 근거로 싣는다.
    - [ ] `skills/renderbudget/SKILL.md` — 런타임 증거. `render-budget.mjs` 호출법.
          `renderer.info` 를 어떻게 수집해 표본으로 만드는지, **누수는 같은 라벨 두 표본 비교**임을 적는다.
          **예산 기본 수치를 적지 않는다** — 운영값이다.
    - [ ] `agents/graphics-engineer.md` — 이름이 다른 네 플러그인과 겹치지 않게 한다.
          TDD 절차는 `nereus:build` 것을 쓴다고 적는다.
    - [ ] README 에 두 검사기·경계(`nereus-game:asset` 은 파일, 여기는 프레임)·
          "문서를 만들지 않는 이유"(awesome 목록 셋 모두 3D 매치 0건, 스킬팩 3종 라이선스 없음)를 적는다.
    - [ ] 커밋: `git add plugins/nereus-3d && git commit -m "docs(3d): 스킬 2종·에이전트·README"`
  - Done when: 두 SKILL.md 와 에이전트가 존재하고 각각 자기 검사기를 가리킨다

- [ ] T6. 배선·프로세스 리그·도너 검증
  - Files: Create `plugins/nereus-3d/nereus-extension.json` · Create `tests/smoke/three-wiring.test.ts` · Create `tests/smoke/three-rig.test.ts` · Create `tests/smoke/three-donor.test.ts` · Modify `tests/smoke/no-unwired-exports.test.ts` · Modify `tests/smoke/l10n-wiring.test.ts`
  - Interfaces: Produces 라우트 2개
  - Steps:
    - [ ] 실패 테스트 `tests/smoke/three-wiring.test.ts` 를 쓴다:
      ```ts
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
      ```
    - [ ] 실패 테스트 `tests/smoke/three-rig.test.ts` 를 쓴다:
      ```ts
      import { describe, it, expect } from "vitest";
      import { execFileSync } from "node:child_process";
      const run = (s: string, input: string) =>
        execFileSync("node", [s], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 });
      const SCAN = "plugins/nereus-3d/lib/scene-scan.mjs";
      const BUDGET = "plugins/nereus-3d/lib/render-budget.mjs";
      describe("nereus-3d 프로세스 리그", () => {
        it("정적 검사기를 프로세스로 돌린다", () => {
          const text = "function d(o){ if (o.material.map) o.material.map.dispose(); o.material.dispose(); }\nd(x);";
          const out = run(SCAN, JSON.stringify({ sources: [{ file: "a.js", text }] }));
          expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("incomplete-dispose");
        });
        it("예산 검사기를 프로세스로 돌린다", () => {
          const out = run(BUDGET, JSON.stringify({
            samples: [{ label: "s", info: { render: { calls: 300, triangles: 1 }, memory: { geometries: 1, textures: 1 } } }],
            budgets: { calls: 100 },
          }));
          expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("budget-exceeded");
        });
        it("입력이 없어도 유효한 JSON 을 낸다 — 0바이트가 아니다", () => {
          for (const s of [SCAN, BUDGET]) {
            const out = run(s, "");
            expect(out.trim().length, s).toBeGreaterThan(0);
            expect(() => JSON.parse(out), s).not.toThrow();
          }
        });
        it("깨진 JSON 은 스택 프레임 없이 사유만 낸다", () => {
          for (const s of [SCAN, BUDGET]) {
            let failed = false;
            try { run(s, "{bad"); } catch (e: any) {
              failed = true;
              expect(e.status, s).not.toBe(0);
              expect(String(e.stderr), s).not.toMatch(/^\s+at .*:\d+:\d+\)?$/m);
            }
            expect(failed, s).toBe(true);
          }
        });
      });
      ```
    - [ ] 실패 테스트 `tests/smoke/three-donor.test.ts` 를 쓴다. **픽스처가 아니라 실제 프로젝트다**:
      ```ts
      import { describe, it, expect } from "vitest";
      import fs from "node:fs";
      import path from "node:path";
      import { scanScene } from "../../plugins/nereus-3d/lib/scene-scan.mjs";
      const DONOR = "/Volumes/SKHY1TB/workspace/FindDifferences3D/find_differences_3d_app/assets/html";
      const has = fs.existsSync(DONOR);
      const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
        .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
      describe.skipIf(!has)("도너 검증 — 실제 프로젝트에서 잡는가", () => {
        const sources = has
          ? walk(DONOR).filter((f) => /\.(js|html)$/.test(f) && !f.includes("/vendor/"))
              .map((f) => ({ file: f, text: fs.readFileSync(f, "utf8") }))
          : [];
        it("도너의 불완전한 dispose 를 잡는다", () => {
          const r = scanScene({ sources });
          const v = r.violations.filter((x: any) => x.code === "incomplete-dispose");
          expect(v.length).toBeGreaterThan(0);
          expect(v.flatMap((x: any) => x.missingSlots)).toContain("normalMap");
        });
        it("도너의 계측 부재를 잡는다", () => {
          expect(scanScene({ sources }).violations.map((v: any) => v.code)).toContain("instrumentation-missing");
        });
      });
      it("도너가 없으면 건너뛴 사실이 남는다", () => {
        expect(typeof has).toBe("boolean");
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/smoke/three-wiring.test.ts tests/smoke/three-rig.test.ts tests/smoke/three-donor.test.ts` · Expected: FAIL
    - [ ] `nereus-extension.json` 에 라우트 2개를 쓴다. 각 라우트에 `why` 를 적는다.
          `threejs`: `three\.?js|webgl|webgpu|gltf|glb\b|orbitcontrols|3d\s?씬|메시\s?생성`
          `renderbudget`: `드로우\s?콜|draw\s?call|renderer\.info|gpu\s?메모리|프레임\s?(드랍|저하)|dispose|텍스처\s?예산`
    - [ ] 두 검사기에 프로세스 진입점을 붙인다. `pathToFileURL` 로 비교하고 `process.exit(0)` 금지.
    - [ ] `tests/smoke/no-unwired-exports.test.ts` 의 `ROOTS` 에 `plugins/nereus-3d/lib` 를,
          `SEARCH` 에 `plugins/nereus-3d` 를 더한다.
    - [ ] `tests/smoke/l10n-wiring.test.ts` 의 `PLUGINS` 배열에 `nereus-3d` 를 더한다.
    - [ ] 통과 확인: Run `npx vitest run tests/smoke/` · Expected: PASS
    - [ ] 역검증: 라우트 하나를 지우고 FAIL 하는지, 진입점 하나를 지우고 FAIL 하는지,
          슬롯 목록에서 `normalMap` 을 빼고 도너 테스트가 FAIL 하는지 확인하고 되돌린다.
          **새 파일은 `git checkout` 이 먹지 않는다** — 사본을 떠 둔다.
    - [ ] 커밋: `git add plugins tests && git commit -m "feat(3d): 라우트 배선·프로세스 리그·도너 검증"`
  - Done when: 가드가 실제로 물고 역검증 3건이 전부 빨개지며 도너 테스트가 실제 결함을 잡는다

- [ ] T7. 설치·doctor·전체 테스트
  - Files: none
  - Interfaces: 없음
  - Steps:
    - [ ] Run `node plugins/nereus/skills/spec/scripts/lint-tasks.mjs openspec/changes/2026-09-13-add-3d-harness/tasks.md` · Expected: 위반 0
    - [ ] Run `claude plugin validate plugins/nereus-3d` · Expected: 통과
    - [ ] Run `claude plugin marketplace update nereus && claude plugin install nereus-3d@nereus` · Expected: 설치 성공
    - [ ] 설치본과 저장소를 대조한다: Run `diff -rq ~/.claude/plugins/cache/nereus/nereus-3d/0.1.0 plugins/nereus-3d` · Expected: 차이 0
          (설치 경로에 **버전이 한 겹 더 있다**)
    - [ ] 라우트가 실제로 좁게 무는지 프로브로 확인한다. `확률형 아이템 규정`·`광고 단위`·
          `스토어 등재`·`3D`·`씬`·`렌더` 가 이 플러그인 라우트에 매치되지 않아야 한다.
    - [ ] Run `node plugins/nereus/skills/doctor/scripts/doctor.mjs` · Expected: HIGH 충돌 0
    - [ ] Run `node plugins/nereus/skills/build/scripts/run-tests.mjs` · Expected: PASS
    - [ ] 커밋. **문서를 테스트 뒤에 쓰지 않는다** — evidence 가 STALE 이 된다
  - Done when: doctor 가 HIGH 0 이고 전체 테스트가 초록이며 설치본 차이가 0 이다

## Global Constraints

- 스택: Node ESM(`.mjs`), 테스트는 vitest. **새 런타임 의존성을 추가하지 않는다** —
  three.js 를 설치해 파싱하지 않고, AST 파서도 쓰지 않는다.
- **`nereus-3d` 는 다른 플러그인이나 코어 내부 모듈을 import 하지 않는다.** `cli-input.mjs` 도 자기 것.
- 검사기는 stdin JSON → stdout JSON. 성공 경로에서 `process.exit(0)` 을 부르지 않는다(파이프가 64KiB 에서 잘린다).
- 경로는 `pathToFileURL`/`fileURLToPath` 를 거친다. 메인 개발 환경이 Windows 다.
- 텍스처 슬롯 목록은 **출처 URL·확인일과 함께** 데이터로 둔다. 코드에 박지 않는다.
- **예산 기본 수치를 데이터에 넣지 않는다.** 운영값이라 정책인 척하면서 낡는다.
- **기준이 없으면 판정하지 않고 `unmeasured` 에 싣는다.** 지어낸 기준은 그럴듯하게 틀린다.
- **누수를 단발 스냅샷으로 판정하지 않는다.** 같은 라벨 두 표본을 비교한다.
- **문서를 하네스에 복사하지 않는다.** Context7 과 pmndrs MCP 로 조회하고 출처만 참조한다.
- **`/Volumes/SKHY1TB/workspace/FindDifferences3D` 는 읽기 전용이다.** 고치지 않는다.
- 도너 테스트는 경로가 없으면 **실패가 아니라 건너뛴다.** 다른 기기에서도 돌아야 한다.
- 꺾쇠로 감싼 플레이스홀더를 이 파일에 쓰지 않는다. lint-tasks 가 잡는다.
