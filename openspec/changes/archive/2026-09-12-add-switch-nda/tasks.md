# tasks — add-switch-nda

- [x] T1. NDA 경계 배선 검사를 먼저 깐다
  - Files: Create `tests/smoke/nda-wiring.test.ts`
  - Interfaces: Consumes `plugins/nereus-game/hooks/hooks.json` · Produces 없음
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import fs from "node:fs";

      const ROOT = "plugins/nereus-game";

      describe("NDA 경계 배선", () => {
        it("nda-guard 가 PreToolUse 에 배선돼 있다", () => {
          const hooks = JSON.parse(fs.readFileSync(`${ROOT}/hooks/hooks.json`, "utf8"));
          const pre = hooks.hooks?.PreToolUse ?? [];
          const cmds = pre.flatMap((e: any) => (e.hooks ?? []).map((h: any) => h.command));
          expect(cmds.join(" ")).toContain("nda-guard.mjs");
          expect(cmds.join(" ")).toContain("CLAUDE_PLUGIN_ROOT");
        });

        it("switch 스킬이 있고 Lotcheck 본문을 저장소에 담지 않는다", () => {
          const p = `${ROOT}/skills/switch/SKILL.md`;
          expect(fs.existsSync(p)).toBe(true);
          const text = fs.readFileSync(p, "utf8");
          expect(text).toContain(".nereus/lotcheck");
        });

        it("훅 스크립트가 실재한다", () => {
          expect(fs.existsSync(`${ROOT}/hooks/scripts/nda-guard.mjs`)).toBe(true);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/smoke/nda-wiring.test.ts` · Expected: FAIL (nda-guard·switch 스킬 없음)
    - [x] 최소 구현: 없음. 이 태스크는 검사만 만든다
    - [x] 커밋: `git add tests/smoke/nda-wiring.test.ts && git commit -m "test(game): NDA 경계 배선 검사를 먼저"`
  - Done when: 세 검사가 모두 실패하고 사유가 "아직 만들지 않음"이다

- [x] T2. NDA 구역 판정 순수 함수 [wave:2]
  - Files: Create `plugins/nereus-game/lib/nda.mjs` · Test `tests/lib/nda.test.ts`
  - Interfaces: Consumes 없음 · Produces `isNdaPath(file, extraZones): boolean`, `NDA_ZONES: string[]`, `ndaPathsIn(text, extraZones): string[]`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { isNdaPath, ndaPathsIn, NDA_ZONES } from "../../plugins/nereus-game/lib/nda.mjs";

      describe("isNdaPath", () => {
        it("기본 구역을 잡는다", () => {
          expect(isNdaPath("Platform/Switch/Boot.cs")).toBe(true);
          expect(isNdaPath("vendor/NintendoSDK/nn.h")).toBe(true);
          expect(isNdaPath("build/game.nx.json")).toBe(true);
        });

        it("일반 경로는 아니다", () => {
          expect(isNdaPath("Assets/Game/Player.cs")).toBe(false);
        });

        it("윈도우 경로 구분자도 잡는다", () => {
          expect(isNdaPath("Platform\\\\Switch\\\\Boot.cs")).toBe(true);
        });

        it("프로젝트가 구역을 덧붙일 수 있다", () => {
          expect(isNdaPath("secret/a.txt", ["secret/**"])).toBe(true);
        });

        it("기본 구역 목록이 비어 있지 않다", () => {
          expect(NDA_ZONES.length).toBeGreaterThan(0);
        });
      });

      describe("ndaPathsIn", () => {
        it("명령 문자열에서 NDA 경로를 뽑는다", () => {
          const found = ndaPathsIn("codex review Platform/Switch/Boot.cs Assets/Player.cs");
          expect(found).toEqual(["Platform/Switch/Boot.cs"]);
        });

        it("NDA 경로가 없으면 빈 배열", () => {
          expect(ndaPathsIn("codex review Assets/Player.cs")).toEqual([]);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/nda.test.ts` · Expected: FAIL (nda.mjs 없음)
    - [x] 최소 구현: `NDA_ZONES` 를 `["Platform/Switch/**", "**/NintendoSDK/**", "**/*.nx.*"]` 로 두고, 경로를 `/` 로 정규화한 뒤 글롭을 정규식으로 바꿔 검사한다. `ndaPathsIn` 은 공백으로 쪼갠 토큰 중 `isNdaPath` 를 만족하는 것만 돌려준다
    - [x] 통과 확인: Run `npx vitest run tests/lib/nda.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/nda.mjs tests/lib/nda.test.ts && git commit -m "feat(game): NDA 구역 판정"`
  - Done when: 일곱 테스트가 통과하고 판정이 순수 함수다

- [x] T3. Luau Execution 2단 게이트 [wave:2]
  - Files: Create `plugins/nereus-game/lib/luau-exec.mjs` · Test `tests/lib/luau-exec.test.ts`
  - Interfaces: Consumes 주입 가능한 `{ http, sleep }` · Produces `runLuauTask(input, deps)` — 결과 객체를 resolve 하는 Promise, `MAX_TASK_SECONDS`, `MAX_CONCURRENT`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { runLuauTask, MAX_TASK_SECONDS, MAX_CONCURRENT } from "../../plugins/nereus-game/lib/luau-exec.mjs";

      const base = { universeId: "1", placeId: "2", script: "return true", apiKey: "k" };
      const deps = (states: string[]) => {
        let i = 0;
        return {
          sleep: async () => {},
          http: async (_url: string, opts: any) => {
            if (opts?.method === "POST") return { path: "tasks/abc", state: "PROCESSING" };
            const state = states[Math.min(i++, states.length - 1)];
            return { path: "tasks/abc", state, output: { results: [true] }, logs: ["ok"] };
          },
        };
      };

      describe("runLuauTask", () => {
        it("완료까지 폴링하고 통과를 판정한다", async () => {
          const r = await runLuauTask({ ...base, timeoutSeconds: 60 }, deps(["PROCESSING", "COMPLETE"]));
          expect(r.pass).toBe(true);
          expect(r.logs).toContain("ok");
        });

        it("실패 상태는 통과가 아니다", async () => {
          const r = await runLuauTask({ ...base, timeoutSeconds: 60 }, deps(["FAILED"]));
          expect(r.pass).toBe(false);
        });

        it("상한을 넘는 타임아웃은 거부한다", async () => {
          await expect(runLuauTask({ ...base, timeoutSeconds: MAX_TASK_SECONDS + 1 }, deps(["COMPLETE"])))
            .rejects.toThrow(/쪼/);
        });

        it("API 키가 없으면 네트워크를 부르지 않는다", async () => {
          let called = false;
          const spy = { sleep: async () => {}, http: async () => { called = true; return {}; } };
          const r = await runLuauTask({ ...base, apiKey: "", timeoutSeconds: 60 }, spy);
          expect(called).toBe(false);
          expect(r.configured).toBe(false);
        });

        it("동시 상한 상수를 노출한다", () => {
          expect(MAX_CONCURRENT).toBe(10);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/luau-exec.test.ts` · Expected: FAIL (luau-exec.mjs 없음)
    - [x] 최소 구현: `MAX_TASK_SECONDS = 300`, `MAX_CONCURRENT = 10`. `apiKey` 가 비면 `{ configured: false, pass: false }` 를 돌려주고 http 를 부르지 않는다. 타임아웃이 상한을 넘으면 "태스크를 쪼개라"를 포함한 메시지로 throw. 그 외에는 POST 로 태스크를 만들고 `state` 가 `PROCESSING` 인 동안 `sleep` 후 다시 조회한다. `COMPLETE` 면 `pass: true`
    - [x] 통과 확인: Run `npx vitest run tests/lib/luau-exec.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/luau-exec.mjs tests/lib/luau-exec.test.ts && git commit -m "feat(game): Luau Execution 2단 게이트"`
  - Done when: 다섯 테스트가 통과하고 네트워크·자격증명 없이 전부 검증된다

- [x] T4. NDA 가드 훅
  - Files: Create `plugins/nereus-game/hooks/scripts/nda-guard.mjs` · Modify `plugins/nereus-game/hooks/hooks.json` · Test `tests/hooks/nda-guard.test.ts`
  - Interfaces: Consumes PreToolUse 입력, `lib/nda.mjs` · Produces `ndaGuard(input, opts): { block: boolean, reason: string }`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { ndaGuard } from "../../plugins/nereus-game/hooks/scripts/nda-guard.mjs";

      const bash = (command: string) => ({ tool_name: "Bash", tool_input: { command } });

      describe("ndaGuard", () => {
        it("NDA 경로를 외부 도구에 넘기면 차단한다", () => {
          const r = ndaGuard(bash("codex review Platform/Switch/Boot.cs"));
          expect(r.block).toBe(true);
          expect(r.reason).toContain("Platform/Switch/Boot.cs");
        });

        it("NDA 경로라도 외부 도구가 아니면 막지 않는다", () => {
          expect(ndaGuard(bash("cat Platform/Switch/Boot.cs")).block).toBe(false);
        });

        it("외부 도구라도 NDA 경로가 없으면 막지 않는다", () => {
          expect(ndaGuard(bash("codex review Assets/Player.cs")).block).toBe(false);
        });

        it("NDA 파일 편집은 막지 않는다", () => {
          const edit = { tool_name: "Edit", tool_input: { file_path: "Platform/Switch/Boot.cs" } };
          expect(ndaGuard(edit).block).toBe(false);
        });

        it("warn 모드에서는 차단하지 않고 사유만 남긴다", () => {
          const r = ndaGuard(bash("agy -p Platform/Switch/Boot.cs"), { mode: "warn" });
          expect(r.block).toBe(false);
          expect(r.reason).not.toBe("");
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/hooks/nda-guard.test.ts` · Expected: FAIL (nda-guard.mjs 없음)
    - [x] 최소 구현: 외부 도구 목록을 `["codex", "agy", "ocr", "curl", "gh", "wget"]` 로 두고, Bash 명령에서 그 토큰과 `ndaPathsIn` 결과가 **둘 다** 있으면 차단한다. Bash 가 아닌 도구는 항상 통과. `mode` 가 `warn` 이면 `block: false` 로 사유만 남긴다. 기본 모드는 `block`. `hooks.json` 의 PreToolUse 에 `node "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/nda-guard.mjs"` 를 추가한다
    - [x] 통과 확인: Run `npx vitest run tests/hooks/nda-guard.test.ts tests/smoke/nda-wiring.test.ts` · Expected: nda-guard PASS, nda-wiring 은 switch 스킬 항목만 FAIL
    - [x] 커밋: `git add plugins/nereus-game/hooks tests/hooks/nda-guard.test.ts && git commit -m "feat(game): NDA 가드 훅"`
  - Done when: 다섯 테스트가 통과하고 훅이 `hooks.json` 에 실제로 배선돼 있다

- [x] T5. Switch 스택 판정과 스킬
  - Files: Create `plugins/nereus-game/lib/switch-stack.mjs` · Create `plugins/nereus-game/skills/switch/SKILL.md` · Test `tests/lib/switch-stack.test.ts`
  - Interfaces: Consumes 주입 가능한 `{ exists }`, 설정 객체 · Produces `isSwitchTarget(cwd, fsx)`, `detectSwitchBuild(cwd, fsx, config)`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { isSwitchTarget, detectSwitchBuild } from "../../plugins/nereus-game/lib/switch-stack.mjs";

      const fsWith = (files: string[]) => ({ exists: (p: string) => files.some((f) => p.replace(/\\\\/g, "/").endsWith(f)) });

      describe("switch-stack", () => {
        it("NDA 구역이 있으면 Switch 대상", () => {
          expect(isSwitchTarget("/p", fsWith(["Platform/Switch"]))).toBe(true);
        });

        it("없으면 Switch 대상이 아니다", () => {
          expect(isSwitchTarget("/p", fsWith(["Assets"]))).toBe(false);
        });

        it("빌드 명령이 설정돼 있으면 돌려준다", () => {
          const out = detectSwitchBuild("/p", fsWith(["Platform/Switch"]), { switch: { build: "make nx" } });
          expect(out).toEqual({ command: "make nx" });
        });

        it("설정이 없으면 명령을 지어내지 않는다", () => {
          expect(detectSwitchBuild("/p", fsWith(["Platform/Switch"]), {})).toBeNull();
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/switch-stack.test.ts` · Expected: FAIL (switch-stack.mjs 없음)
    - [x] 최소 구현: `isSwitchTarget` 은 `Platform/Switch` 디렉터리 존재로 판정한다. `detectSwitchBuild` 은 Switch 대상이고 `config.switch.build` 가 문자열이면 `{ command }`, 아니면 `null`. `SKILL.md` 에 플랫폼 추상화 요구(게임 로직을 플랫폼 무관 층에 두고 NDA 구역을 얇게 유지), NDA 경계 훅이 무엇을 막고 무엇을 안 막는지, Lotcheck 체크리스트를 `.nereus/lotcheck/` 에 두고 읽는 절차, 휴대·거치 두 모드와 슬립 복귀·컨트롤러 분리 점검을 적는다. 체크리스트 본문은 담지 않는다
    - [x] 통과 확인: Run `npx vitest run tests/lib/switch-stack.test.ts tests/smoke/nda-wiring.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/switch-stack.mjs plugins/nereus-game/skills/switch tests/lib/switch-stack.test.ts && git commit -m "feat(game): Switch 스택과 스킬"`
  - Done when: 네 테스트와 배선 검사 세 건이 모두 통과한다

- [x] T6. 리뷰어 헬스체크
  - Files: Modify `plugins/nereus/skills/review/scripts/review.mjs` · Modify `tests/skills/review-merge.test.ts`
  - Interfaces: Consumes 기존 `planRunners(value, available)` 의 둘째 인자와 새 셋째 인자 `probe` · Produces `planRunners(value, available, probe)` — `plan.skipped` 에 사유를 함께 담는다
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      describe("리뷰어 헬스체크", () => {
        it("PATH 에 있어도 무응답이면 계획에서 빠진다", () => {
          const probe = (bin: string) => (bin === "agy" ? { ok: false, why: "무응답" } : { ok: true });
          const plan = planRunners("both", () => true, probe);
          expect(plan.gemini).toBe(false);
          expect(JSON.stringify(plan.skipped)).toContain("agy");
        });

        it("응답하는 리뷰어는 포함된다", () => {
          const plan = planRunners("codex", () => true, () => ({ ok: true }));
          expect(plan.codex).toBe(true);
        });

        it("PATH 에 없으면 프로브를 돌리지 않는다", () => {
          let probed = 0;
          planRunners("both", () => false, () => { probed += 1; return { ok: true }; });
          expect(probed).toBe(0);
        });

        it("probe 를 주지 않으면 기존 동작 그대로다", () => {
          const plan = planRunners("codex", () => true);
          expect(plan.codex).toBe(true);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/review-merge.test.ts` · Expected: FAIL (planRunners 가 셋째 인자를 안 받음)
    - [x] 최소 구현: `planRunners` 의 시그니처를 `(value, available, probe = null)` 로 넓힌다(기본 `available` 은 그대로 둔다). `available` 이 참일 때만 `probe` 를 부르고, `probe` 결과의 `ok` 가 거짓이면 `plan[id]` 를 켜지 않고 `plan.skipped` 에 `{ id, bin, why }` 를 넣는다. `probe` 가 없으면 기존 동작을 그대로 유지한다(기존 테스트가 깨지면 안 된다)
    - [x] 통과 확인: Run `npx vitest run tests/skills/review-merge.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/review/scripts/review.mjs tests/skills/review-merge.test.ts && git commit -m "fix(harness): 리뷰어 가용을 응답으로 판정"`
  - Done when: 새 테스트 네 건과 기존 review-merge 테스트가 모두 통과하고, probe 없이 부른 기존 호출부가 그대로 동작한다

- [x] T7. 확장 선언 갱신과 통합 검증 [flow]
  - Files: Modify `plugins/nereus-game/nereus-extension.json` · Modify `plugins/nereus-game/README.md` · Modify `tests/smoke/game-wiring.test.ts`
  - Interfaces: Consumes `loadExtensions`, `routePrompt` · Produces 없음
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      it("switch 라우트가 선언돼 있고 스킬이 실재한다", () => {
        const ext = loadExtensions({ readJson, records });
        expect(ext.routes.map((r) => r.skill)).toContain("nereus-game:switch");
        const hits = routePrompt("스위치 이식 준비하자", { extraRoutes: ext.routes });
        expect(hits.some((h) => h.skill === "nereus-game:switch")).toBe(true);
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-wiring.test.ts` · Expected: FAIL (switch 라우트 미선언)
    - [x] 최소 구현: `nereus-extension.json` 의 `routes` 에 `{ skill: "nereus-game:switch", why: "닌텐도 스위치·NDA 경계·Lotcheck", re: "스위치|switch|닌텐도|nintendo|lotcheck|이식" }` 를 추가한다. README 의 지원 스택 표에서 Switch 행을 설계·경계 동작으로 바꾸고 NDA 경계 훅 설명을 추가한다
    - [x] 통과 확인: Run `npx vitest run tests/smoke/` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/nereus-extension.json plugins/nereus-game/README.md tests/smoke/game-wiring.test.ts && git commit -m "feat(game): switch 라우트 선언"`
  - Done when: 스모크 전체가 통과하고 `npm test` 전체가 통과한다

## Global Constraints

- 스택: Node 20+, ESM(`.mjs`), 테스트는 vitest(`tests/**/*.test.ts`). 커버리지 임계 lines/functions 80%.
- **외부 호출은 전부 주입 가능해야 한다.** 테스트가 네트워크·자격증명·실제 프로세스에 의존하지 않는다.
- NDA 판정은 순수 함수 하나로만 한다. 훅·리뷰·스캔이 같은 함수를 쓴다.
- NDA 차단 기본값은 `block`. 설정으로만 낮출 수 있다.
- **Lotcheck 체크리스트 본문을 저장소에 넣지 않는다.** 항목 자체가 NDA 다.
- NintendoSDK 고유 빌드 명령을 저장소에 적지 않는다. 설정에서 읽고 없으면 `null`.
- 훅은 Node 만. `bash` 금지. `${CLAUDE_PLUGIN_ROOT}` 상대 경로. win32 에서 동작해야 한다.
- 코어 수정은 T6(리뷰어 헬스체크) 한 파일뿐이다.
