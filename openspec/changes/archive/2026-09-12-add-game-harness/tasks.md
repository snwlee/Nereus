# tasks — add-game-harness

- [x] T1. 형제 플러그인 확장 로더
  - Files: Create `plugins/nereus/hooks/scripts/lib/extensions.mjs` · Test `tests/lib/extensions.test.ts`
  - Interfaces: Consumes `settings.json` 의 `enabledPlugins` (주입 가능한 reader) · Produces `loadExtensions({ readJson, settings }): { routes: Route[], stacks: StackDef[] }`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { loadExtensions } from "../../plugins/nereus/hooks/scripts/lib/extensions.mjs";

      const settings = { enabledPlugins: { "nereus-game@nereus": { installPath: "/p/game" } } };

      describe("loadExtensions", () => {
        it("활성 플러그인의 routes 와 stacks 를 모은다", () => {
          const readJson = (p: string) =>
            p === "/p/game/nereus-extension.json"
              ? { routes: [{ skill: "nereus-game:roblox", why: "로블록스", re: "로블록스|roblox" }], stacks: [{ name: "roblox", marker: "default.project.json" }] }
              : undefined;
          const out = loadExtensions({ readJson, settings });
          expect(out.routes).toHaveLength(1);
          expect(out.routes[0].re.test("로블록스 게임")).toBe(true);
          expect(out.stacks[0]).toEqual({ name: "roblox", marker: "default.project.json" });
        });

        it("깨진 확장 파일은 그 플러그인만 건너뛴다", () => {
          const readJson = () => { throw new Error("bad json"); };
          expect(loadExtensions({ readJson, settings })).toEqual({ routes: [], stacks: [] });
        });

        it("비활성 플러그인은 로드하지 않는다", () => {
          const readJson = () => ({ routes: [{ skill: "x:y", why: "z", re: "z" }] });
          expect(loadExtensions({ readJson, settings: { enabledPlugins: {} } })).toEqual({ routes: [], stacks: [] });
        });

        it("컴파일 안 되는 정규식 항목은 버린다", () => {
          const readJson = () => ({ routes: [{ skill: "x:y", why: "z", re: "(" }] });
          expect(loadExtensions({ readJson, settings }).routes).toEqual([]);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/extensions.test.ts` · Expected: FAIL (extensions.mjs 없음)
    - [x] 최소 구현: `loadExtensions` 가 `enabledPlugins` 항목마다 `installPath` 를 읽어 그 경로 아래의 `nereus-extension.json` 을 `readJson` 으로 열고, `routes` 는 `{ skill, why, re: new RegExp(re, "i") }` 로 변환하며, try/catch 로 항목·플러그인 단위 실패를 삼킨다
    - [x] 통과 확인: Run `npx vitest run tests/lib/extensions.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/hooks/scripts/lib/extensions.mjs tests/lib/extensions.test.ts && git commit -m "feat(harness): 형제 플러그인 확장 로더"`
  - Done when: 네 테스트가 모두 통과하고 `loadExtensions` 가 어떤 입력에도 예외를 던지지 않는다

- [x] T2. 라우터가 확장 routes 를 병합한다 [wave:2]
  - Files: Modify `plugins/nereus/hooks/scripts/lib/router.mjs` · Modify `tests/lib/router.test.ts`
  - Interfaces: Consumes `loadExtensions()` 결과의 `routes` · Produces `routePrompt(text, { seen, extraRoutes })`, `skillMapBlock({ extraRoutes })`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      it("확장 라우트는 코어 뒤에 병합된다", () => {
        const extraRoutes = [{ skill: "nereus-game:roblox", why: "로블록스", re: /로블록스/i }];
        const hits = routePrompt("로블록스 게임 디자인 고쳐줘", { extraRoutes });
        expect(hits[0].skill).toBe("nereus:design");
        expect(hits.map((h) => h.skill)).toContain("nereus-game:roblox");
      });

      it("확장이 코어를 밀어내지 않는다", () => {
        const extraRoutes = [
          { skill: "nereus-game:a", why: "a", re: /버그/i },
          { skill: "nereus-game:b", why: "b", re: /버그/i },
        ];
        const hits = routePrompt("버그 났어", { extraRoutes });
        expect(hits[0].skill).toBe("nereus:debug");
        expect(hits).toHaveLength(2);
      });

      it("스킬맵에 확장 라우트가 들어간다", () => {
        const block = skillMapBlock({ extraRoutes: [{ skill: "nereus-game:roblox", why: "로블록스", re: /로블록스/i }] });
        expect(block).toContain("nereus-game:roblox — 로블록스");
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/router.test.ts` · Expected: FAIL (extraRoutes 옵션 없음)
    - [x] 최소 구현: `routePrompt` 와 `skillMapBlock` 이 `extraRoutes = []` 옵션을 받아 `[...ROUTES, ...extraRoutes]` 를 순회하도록 고친다. `MAX_HITS` 는 병합 목록에 그대로 적용한다. `ROUTES` 자체는 변경하지 않는다
    - [x] 통과 확인: Run `npx vitest run tests/lib/router.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/hooks/scripts/lib/router.mjs tests/lib/router.test.ts && git commit -m "feat(harness): 라우터 확장점"`
  - Done when: 새 테스트 3개와 기존 router 테스트가 모두 통과하고, 확장 없이 호출한 기존 동작이 그대로다

- [x] T3. 스택 탐지가 확장 stacks 를 병합한다 [wave:2]
  - Files: Modify `plugins/nereus/hooks/scripts/lib/stack.mjs` · Modify `tests/lib/stack.test.ts`
  - Interfaces: Consumes `loadExtensions()` 결과의 `stacks` · Produces `detectStack(cwd, fsx, { extraStacks })`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      it("확장 스택 마커를 인식한다", () => {
        const fsx = { exists: (p: string) => p.endsWith("default.project.json"), readFile: () => "" };
        const extraStacks = [{ name: "roblox", marker: "default.project.json" }];
        expect(detectStack("/proj", fsx, { extraStacks })).toContain("roblox");
      });

      it("코어 스택이 확장보다 앞에 온다", () => {
        const fsx = { exists: () => true, readFile: () => "{}" };
        const extraStacks = [{ name: "roblox", marker: "default.project.json" }];
        const out = detectStack("/proj", fsx, { extraStacks });
        expect(out.indexOf("flutter")).toBeLessThan(out.indexOf("roblox"));
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/stack.test.ts` · Expected: FAIL (extraStacks 옵션 없음)
    - [x] 최소 구현: `detectStack(cwd, fsx = defaultFs, { extraStacks = [] } = {})` 로 시그니처를 넓히고, 코어 판정을 마친 뒤 `extraStacks` 를 순회해 `has(marker)` 면 `name` 을 뒤에 붙인다
    - [x] 통과 확인: Run `npx vitest run tests/lib/stack.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/hooks/scripts/lib/stack.mjs tests/lib/stack.test.ts && git commit -m "feat(harness): 스택 탐지 확장점"`
  - Done when: 새 테스트 2개와 기존 stack 테스트가 통과하고, 인자 없이 부른 기존 호출부가 그대로 동작한다

- [x] T4. nereus-game 플러그인 스캐폴드와 마켓플레이스 등재
  - Files: Create `plugins/nereus-game/.claude-plugin/plugin.json` · Create `plugins/nereus-game/NOTICE` · Modify `.claude-plugin/marketplace.json`
  - Interfaces: Consumes 없음 · Produces 설치 가능한 세 번째 플러그인 `nereus-game`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import fs from "node:fs";

      describe("nereus-game 패키징", () => {
        it("마켓플레이스에 등재되고 이름이 매니페스트와 같다", () => {
          const mp = JSON.parse(fs.readFileSync(".claude-plugin/marketplace.json", "utf8"));
          const entry = mp.plugins.find((p: any) => p.name === "nereus-game");
          expect(entry).toBeTruthy();
          expect(entry.source).toBe("./plugins/nereus-game");
          const pj = JSON.parse(fs.readFileSync("plugins/nereus-game/.claude-plugin/plugin.json", "utf8"));
          expect(pj.name).toBe(entry.name);
          expect(pj.license).toBe("MIT");
        });

        it("CCGS 귀속을 NOTICE 에 적는다", () => {
          const notice = fs.readFileSync("plugins/nereus-game/NOTICE", "utf8");
          expect(notice).toContain("Claude-Code-Game-Studios");
          expect(notice).toContain("MIT");
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/game-packaging.test.ts` · Expected: FAIL (plugin.json 없음)
    - [x] 최소 구현: `plugin.json` 에 `name: "nereus-game"`, `version: "0.1.0"`, `description`, `author`, `license: "MIT"` 를 쓰고, `NOTICE` 에 CCGS(MIT, Donchitos/Claude-Code-Game-Studios) 귀속을 적고, `marketplace.json` 의 `plugins` 에 `{ name, description, source: "./plugins/nereus-game", category: "workflow", version: "0.1.0", author }` 를 추가한다
    - [x] 통과 확인: Run `npx vitest run tests/lib/game-packaging.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game .claude-plugin/marketplace.json tests/lib/game-packaging.test.ts && git commit -m "feat(game): 플러그인 스캐폴드"`
  - Done when: 두 테스트가 통과하고 `marketplace.json` 이 유효한 JSON 이다

- [x] T5. 로블록스 스택·테스트러너 판정 [wave:3]
  - Files: Create `plugins/nereus-game/lib/roblox-stack.mjs` · Test `tests/lib/roblox-stack.test.ts`
  - Interfaces: Consumes 주입 가능한 `{ exists, readFile }` · Produces `detectRobloxRunner(cwd, fsx): { runner, command } | null`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { detectRobloxRunner } from "../../plugins/nereus-game/lib/roblox-stack.mjs";

      const fsWith = (files: string[]) => ({
        exists: (p: string) => files.some((f) => p.endsWith(f)),
        readFile: () => "",
      });

      describe("detectRobloxRunner", () => {
        it("lune.yaml 이 있으면 lune 러너", () => {
          expect(detectRobloxRunner("/p", fsWith(["default.project.json", "lune.yaml"])))
            .toEqual({ runner: "lune", command: "lune run tests" });
        });

        it("러너가 없으면 null", () => {
          expect(detectRobloxRunner("/p", fsWith(["default.project.json"]))).toBeNull();
        });

        it("로블록스 프로젝트가 아니면 null", () => {
          expect(detectRobloxRunner("/p", fsWith(["package.json"]))).toBeNull();
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/roblox-stack.test.ts` · Expected: FAIL (roblox-stack.mjs 없음)
    - [x] 최소 구현: `default.project.json` 이 없으면 `null`. 있고 `lune.yaml` 또는 `lune/` 이 있으면 `{ runner: "lune", command: "lune run tests" }`. 그 외 `null`
    - [x] 통과 확인: Run `npx vitest run tests/lib/roblox-stack.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/roblox-stack.mjs tests/lib/roblox-stack.test.ts && git commit -m "feat(game): 로블록스 러너 판정"`
  - Done when: 세 테스트가 통과하고 러너를 못 찾을 때 명령을 지어내지 않는다

- [x] T6. Luau 편집 후 포맷·린트 훅 [wave:3]
  - Files: Create `plugins/nereus-game/hooks/scripts/luau-check.mjs` · Create `plugins/nereus-game/hooks/hooks.json` · Test `tests/hooks/luau-check.test.ts`
  - Interfaces: Consumes PostToolUse 훅 입력 JSON(`tool_input.file_path`), 주입 가능한 `{ which, run }` · Produces `luauCheck(input, deps): string[]` (실행된 명령 목록)
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { luauCheck } from "../../plugins/nereus-game/hooks/scripts/luau-check.mjs";

      const deps = (present: string[]) => ({
        which: (cmd: string) => present.includes(cmd),
        run: (cmd: string, args: string[]) => `${cmd} ${args.join(" ")}`,
      });

      describe("luauCheck", () => {
        it("luau 파일이면 stylua 와 selene 를 돌린다", () => {
          const out = luauCheck({ tool_input: { file_path: "/p/src/Main.luau" } }, deps(["stylua", "selene"]));
          expect(out).toEqual(["stylua /p/src/Main.luau", "selene /p/src/Main.luau"]);
        });

        it("도구가 없으면 건너뛴다", () => {
          expect(luauCheck({ tool_input: { file_path: "/p/src/Main.luau" } }, deps([]))).toEqual([]);
        });

        it("luau 가 아닌 파일은 아무것도 안 한다", () => {
          expect(luauCheck({ tool_input: { file_path: "/p/src/a.ts" } }, deps(["stylua", "selene"]))).toEqual([]);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/hooks/luau-check.test.ts` · Expected: FAIL (luau-check.mjs 없음)
    - [x] 최소 구현: `luauCheck` 가 `file_path` 확장자가 `.luau`/`.lua` 일 때만 `which` 로 존재하는 도구를 순서대로 `run` 한다. `hooks.json` 에 PostToolUse `Edit|Write|MultiEdit` 매처로 `node "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/luau-check.mjs"` 를 선언한다. 스크립트 본체는 항상 `process.exit(0)` 로 끝낸다
    - [x] 통과 확인: Run `npx vitest run tests/hooks/luau-check.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/hooks tests/hooks/luau-check.test.ts && git commit -m "feat(game): Luau 포맷·린트 훅"`
  - Done when: 세 테스트가 통과하고 훅 명령이 `${CLAUDE_PLUGIN_ROOT}` 상대경로이며 bash 를 쓰지 않는다

- [x] T7. 확장 선언과 배선 통합 검증 [flow]
  - Files: Create `plugins/nereus-game/nereus-extension.json` · Create `tests/smoke/game-wiring.test.ts`
  - Interfaces: Consumes `loadExtensions`, `routePrompt`, `detectStack` · Produces 없음
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import fs from "node:fs";
      import { loadExtensions } from "../../plugins/nereus/hooks/scripts/lib/extensions.mjs";
      import { routePrompt } from "../../plugins/nereus/hooks/scripts/lib/router.mjs";
      import { detectStack } from "../../plugins/nereus/hooks/scripts/lib/stack.mjs";

      const settings = { enabledPlugins: { "nereus-game@nereus": { installPath: "plugins/nereus-game" } } };
      const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

      describe("nereus-game 배선", () => {
        it("확장이 라우터와 스택에 실제로 붙는다", () => {
          const ext = loadExtensions({ readJson, settings });
          expect(ext.routes.length).toBeGreaterThan(0);
          const hits = routePrompt("로블록스 유즈맵 만들자", { extraRoutes: ext.routes });
          expect(hits.some((h) => h.skill.startsWith("nereus-game:"))).toBe(true);
          const fsx = { exists: (p: string) => p.endsWith("default.project.json"), readFile: () => "" };
          expect(detectStack("/proj", fsx, { extraStacks: ext.stacks })).toContain("roblox");
        });

        it("코어 워크플로 스킬 이름을 재사용하지 않는다", () => {
          const ext = loadExtensions({ readJson, settings });
          const banned = ["intake", "spec", "build", "review", "finish"];
          for (const r of ext.routes) {
            expect(banned).not.toContain(r.skill.split(":")[1]);
          }
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-wiring.test.ts` · Expected: FAIL (nereus-extension.json 없음)
    - [x] 최소 구현: `nereus-extension.json` 에 `routes` 로 `nereus-game:roblox`(정규식 `로블록스|roblox|rojo|luau|유즈맵`)를, `stacks` 로 `{ name: "roblox", marker: "default.project.json" }` 를 선언한다
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-wiring.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/nereus-extension.json tests/smoke/game-wiring.test.ts && git commit -m "feat(game): 확장 선언과 배선"`
  - Done when: 두 테스트가 통과하고 `npm test` 전체가 통과한다

- [x] T8. 확장 러너를 TDD 게이트에 연결한다
  - Files: Modify `plugins/nereus/hooks/scripts/lib/stack.mjs` · Modify `tests/lib/stack.test.ts` · Modify `plugins/nereus-game/nereus-extension.json`
  - Interfaces: Consumes 확장 stacks 항목의 `runnerModule` 경로 · Produces `detectTestRunner(cwd, fsx, { extraStacks })`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      it("확장 스택의 러너를 코어가 돌려준다", () => {
        const fsx = { exists: (p: string) => p.endsWith("default.project.json") || p.endsWith("lune.yaml"), readFile: () => "" };
        const extraStacks = [{
          name: "roblox",
          marker: "default.project.json",
          runnerMarker: "lune.yaml",
          runner: "lune",
          command: "lune run tests",
        }];
        expect(detectTestRunner("/proj", fsx, { extraStacks }))
          .toEqual({ runner: "lune", command: "lune run tests" });
      });

      it("코어 러너가 확장보다 우선한다", () => {
        const fsx = {
          exists: (p: string) => p.endsWith("pubspec.yaml") || p.endsWith("default.project.json") || p.endsWith("lune.yaml"),
          readFile: () => "flutter_test:",
        };
        const extraStacks = [{ name: "roblox", marker: "default.project.json", runnerMarker: "lune.yaml", runner: "lune", command: "lune run tests" }];
        expect(detectTestRunner("/proj", fsx, { extraStacks }).runner).toBe("flutter_test");
      });

      it("러너 마커가 없으면 확장도 null", () => {
        const fsx = { exists: (p: string) => p.endsWith("default.project.json"), readFile: () => "" };
        const extraStacks = [{ name: "roblox", marker: "default.project.json", runnerMarker: "lune.yaml", runner: "lune", command: "lune run tests" }];
        expect(detectTestRunner("/proj", fsx, { extraStacks })).toBeNull();
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/stack.test.ts` · Expected: FAIL (detectTestRunner 가 extraStacks 를 안 봄)
    - [x] 최소 구현: `detectTestRunner(cwd, fsx = defaultFs, { extraStacks = [] } = {})` 로 넓히고, 코어 판정이 `null` 일 때만 `extraStacks` 를 순회해 `marker` 와 `runnerMarker` 가 둘 다 있으면 `{ runner, command }` 를 돌려준다. 둘 중 하나라도 없으면 계속 `null`
    - [x] 통과 확인: Run `npx vitest run tests/lib/stack.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/hooks/scripts/lib/stack.mjs plugins/nereus-game/nereus-extension.json tests/lib/stack.test.ts && git commit -m "feat(harness): 확장 러너를 TDD 게이트에 연결"`
  - Done when: 세 테스트가 통과하고, 로블록스 프로젝트에서 `tdd-guard` 가 러너를 찾아 게이트가 켜진다


## Global Constraints

- 스택: Node 20+, ESM(`.mjs`), 테스트는 vitest(`tests/**/*.test.ts`). 커버리지 임계 lines/functions 80%.
- 훅은 Node 만. `bash *.sh` 금지. 명령 경로는 `${CLAUDE_PLUGIN_ROOT}` 상대. 절대경로 금지. win32 에서 동작해야 한다.
- 파일시스템·설정 읽기는 전부 주입 가능해야 한다(테스트가 사용자 전역 설정을 읽으면 안 된다).
- 외부 도구(stylua·selene·lune) 부재는 실패가 아니다. 훅은 종료 코드 0 으로 끝난다.
- `plugins/nereus` 수정은 T2(router)·T3·T8(stack) 의 확장점 두 파일뿐이다. 게임 도메인 지식을 코어에 넣지 않는다.
- 기존 호출부 호환: 새 옵션 인자는 전부 기본값을 가져 인자 없이 부르면 기존 동작 그대로여야 한다.
