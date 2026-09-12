# tasks — add-final-wiring

- [x] T1. OCR 을 커밋된 브랜치 범위로 호출한다 [wave:1]
  - Files: Modify `plugins/nereus/skills/review/scripts/review.mjs` · Modify `tests/skills/review-merge.test.ts` · Modify `plugins/nereus/skills/review/SKILL.md`
  - Interfaces: Consumes 없음 · Produces `ocrDelegateArgs(base)` — 인자 문자열 배열
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      describe("ocrDelegateArgs", () => {
        it("base 가 있으면 범위 인자를 만든다", () => {
          expect(ocrDelegateArgs("main")).toEqual(["--from", "main", "--to", "HEAD"]);
        });

        it("base 가 없으면 범위 인자 없이 워크스페이스 모드", () => {
          expect(ocrDelegateArgs()).toEqual([]);
          expect(ocrDelegateArgs("")).toEqual([]);
        });

        it("공백만 있는 base 도 워크스페이스 모드", () => {
          expect(ocrDelegateArgs("   ")).toEqual([]);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/review-merge.test.ts` · Expected: FAIL (ocrDelegateArgs 없음)
    - [x] 최소 구현: `export function ocrDelegateArgs(base)` 가 문자열을 trim 해 비어 있지 않으면 `["--from", base, "--to", "HEAD"]`, 아니면 `[]` 를 돌려준다. `review/SKILL.md` 의 OCR 호출 설명을 `ocr delegate preview --from BASE --to HEAD` 형태로(BASE 는 비교 기준 브랜치) 고치고, 인자 없이 부르면 워크스페이스 모드로 떨어져 커밋된 변경이 빠진다는 사실을 적는다
    - [x] 통과 확인: Run `npx vitest run tests/skills/review-merge.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/review tests/skills/review-merge.test.ts && git commit -m "fix(harness): OCR 을 커밋된 브랜치 범위로 호출"`
  - Done when: 세 테스트가 통과하고 SKILL.md 가 범위 인자를 쓰는 호출을 안내한다

- [x] T2. 지배 전략 판정 [wave:1]
  - Files: Modify `plugins/nereus-game/lib/balance-sim.mjs` · Modify `tests/lib/balance-sim.test.ts` · Create `plugins/nereus-game/profiles/battle-pvp.json` · Create `plugins/nereus-game/profiles/narrative.json`
  - Interfaces: Consumes `economy.options` 배열 · Produces `summary.dominant: string[]`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      describe("지배 전략", () => {
        const stages = [{ name: "s", cost: 10 }];

        it("한 선택지가 압도하면 보고한다", () => {
          const eco = {
            income: { base: 10, growth: 1 },
            stages,
            options: [
              { name: "강검", cost: 10, effect: 500 },
              { name: "평검", cost: 10, effect: 10 },
              { name: "약검", cost: 10, effect: 8 },
            ],
          };
          const r = simulate({ profile: loadProfile("battle-pvp"), economy: eco, turns: 5, seed: 1 });
          expect(r.summary.dominant).toContain("강검");
        });

        it("균형 잡히면 비어 있다", () => {
          const eco = {
            income: { base: 10, growth: 1 },
            stages,
            options: [
              { name: "a", cost: 10, effect: 10 },
              { name: "b", cost: 10, effect: 11 },
              { name: "c", cost: 10, effect: 9 },
            ],
          };
          const r = simulate({ profile: loadProfile("battle-pvp"), economy: eco, turns: 5, seed: 1 });
          expect(r.summary.dominant).toEqual([]);
        });

        it("선택지가 없으면 빈 배열", () => {
          const r = simulate({ profile: loadProfile("narrative"), economy: { income: { base: 1, growth: 1 }, stages }, turns: 5, seed: 1 });
          expect(r.summary.dominant).toEqual([]);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/balance-sim.test.ts` · Expected: FAIL (battle-pvp 프로파일·dominant 없음)
    - [x] 최소 구현: `battle-pvp.json` 은 loop 를 조우·교전·정산·재장비, `balance.failureMode` 를 `dominant-strategy`, `balance.dominanceRatio` 를 3 으로 둔다. `narrative.json` 은 loop 를 도입·선택·전개·귀결, `failureMode` 를 `pacing`, `dominanceRatio` 를 3 으로 둔다. 두 프로파일 모두 `genre`·`metrics`·`cliffRatio` 를 채운다. `summarize` 가 `economy.options` 에서 효율(effect/cost)을 구해 최고 효율이 중앙값의 `dominanceRatio` 배를 넘으면 그 이름을 `dominant` 에 담는다. 선택지가 없거나 둘 이하면 빈 배열
    - [x] 통과 확인: Run `npx vitest run tests/lib/balance-sim.test.ts tests/smoke/game-domain.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/balance-sim.mjs plugins/nereus-game/profiles tests/lib/balance-sim.test.ts && git commit -m "feat(game): 지배 전략 판정과 프로파일 2종"`
  - Done when: 새 테스트 세 건과 기존 balance-sim·game-domain 테스트가 모두 통과한다

- [x] T3. 로블록스 2단 게이트 배선
  - Files: Create `plugins/nereus-game/lib/roblox-gate.mjs` · Modify `plugins/nereus-game/skills/roblox/SKILL.md` · Test `tests/lib/roblox-gate.test.ts`
  - Interfaces: Consumes `lib/roblox-stack.mjs`, `lib/luau-exec.mjs` · Produces `robloxStageTwo(input, deps)` — 판정 객체를 resolve 하는 Promise
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { robloxStageTwo } from "../../plugins/nereus-game/lib/roblox-gate.mjs";

      const robloxFs = { exists: (p: string) => p.endsWith("default.project.json"), readFile: () => "" };
      const plainFs = { exists: () => false, readFile: () => "" };

      describe("robloxStageTwo", () => {
        it("로블록스가 아니면 건너뛴다", async () => {
          const r = await robloxStageTwo({ cwd: "/p", env: {} }, { fsx: plainFs, run: async () => ({}) });
          expect(r.status).toBe("skipped");
        });

        it("자격증명이 없으면 미설정으로 통과시킨다", async () => {
          let called = false;
          const r = await robloxStageTwo(
            { cwd: "/p", env: {} },
            { fsx: robloxFs, run: async () => { called = true; return {}; } },
          );
          expect(r.status).toBe("unconfigured");
          expect(r.pass).toBe(true);
          expect(called).toBe(false);
        });

        it("2단이 실패하면 통과가 아니다", async () => {
          const env = { ROBLOX_API_KEY: "k", ROBLOX_UNIVERSE_ID: "1", ROBLOX_PLACE_ID: "2" };
          const r = await robloxStageTwo(
            { cwd: "/p", env },
            { fsx: robloxFs, run: async () => ({ configured: true, pass: false, logs: ["boom"] }) },
          );
          expect(r.status).toBe("failed");
          expect(r.pass).toBe(false);
          expect(r.logs).toContain("boom");
        });

        it("2단이 통과하면 통과다", async () => {
          const env = { ROBLOX_API_KEY: "k", ROBLOX_UNIVERSE_ID: "1", ROBLOX_PLACE_ID: "2" };
          const r = await robloxStageTwo(
            { cwd: "/p", env },
            { fsx: robloxFs, run: async () => ({ configured: true, pass: true, logs: [] }) },
          );
          expect(r.status).toBe("passed");
          expect(r.pass).toBe(true);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/roblox-gate.test.ts` · Expected: FAIL (roblox-gate.mjs 없음)
    - [x] 최소 구현: `robloxStageTwo` 가 `isRobloxProject` 로 대상을 가리고, `env` 에서 `ROBLOX_API_KEY`·`ROBLOX_UNIVERSE_ID`·`ROBLOX_PLACE_ID` 를 읽어 하나라도 없으면 `{ status: "unconfigured", pass: true }` 를 돌려주며 `run` 을 부르지 않는다. 전부 있으면 `deps.run`(기본값은 `runLuauTask`)을 불러 `pass` 로 `passed`/`failed` 를 정한다. `roblox/SKILL.md` 에 finish 단계에서 이 함수가 2단을 시도한다는 것과 세 환경변수 이름을 적는다
    - [x] 통과 확인: Run `npx vitest run tests/lib/roblox-gate.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/roblox-gate.mjs plugins/nereus-game/skills/roblox tests/lib/roblox-gate.test.ts && git commit -m "feat(game): 로블록스 2단 게이트 배선"`
  - Done when: 네 테스트가 통과하고 미설정·실패·통과·대상아님 네 상태가 구분된다

- [x] T4. 에셋 파이프라인 doctor
  - Files: Create `plugins/nereus-game/lib/asset-doctor.mjs` · Modify `plugins/nereus-game/skills/asset/SKILL.md` · Test `tests/lib/asset-doctor.test.ts`
  - Interfaces: Consumes 주입 가능한 `{ which, env }` · Produces `assetDoctor(deps)` — 단계별 가용 보고 배열
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { assetDoctor } from "../../plugins/nereus-game/lib/asset-doctor.mjs";

      describe("assetDoctor", () => {
        it("전부 없으면 단계별로 막힌 이유를 낸다", () => {
          const r = assetDoctor({ which: () => false, env: {} });
          expect(r.length).toBeGreaterThan(0);
          for (const s of r) {
            expect(s.ok).toBe(false);
            expect(s.why).not.toBe("");
          }
        });

        it("Blender 가 있으면 3D 단계가 가용", () => {
          const r = assetDoctor({ which: (b: string) => b === "blender", env: {} });
          const three = r.find((s: any) => s.stage === "3d");
          expect(three.ok).toBe(true);
        });

        it("오디오는 API 키로 판정한다", () => {
          const r = assetDoctor({ which: () => false, env: { ELEVENLABS_API_KEY: "k" } });
          const audio = r.find((s: any) => s.stage === "audio");
          expect(audio.ok).toBe(true);
        });

        it("예외를 던지지 않는다", () => {
          expect(() => assetDoctor({})).not.toThrow();
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/asset-doctor.test.ts` · Expected: FAIL (asset-doctor.mjs 없음)
    - [x] 최소 구현: 단계 `3d`(전제 `blender`), `2d`(전제 `COMFYUI_URL` 환경변수), `audio`(전제 `ELEVENLABS_API_KEY`) 를 각각 확인해 `{ stage, ok, why }` 배열을 돌려준다. `deps` 가 비어 있어도 기본값으로 동작하고 예외를 던지지 않는다. `asset/SKILL.md` 에 doctor 로 먼저 확인하라는 절차와 각 전제 이름을 적는다
    - [x] 통과 확인: Run `npx vitest run tests/lib/asset-doctor.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/asset-doctor.mjs plugins/nereus-game/skills/asset tests/lib/asset-doctor.test.ts && git commit -m "feat(game): 에셋 파이프라인 doctor"`
  - Done when: 네 테스트가 통과하고 도구 부재가 예외가 아니라 보고로 나온다

- [x] T5. 배선 검증과 문서 정정 [flow]
  - Files: Modify `plugins/nereus-game/README.md` · Modify `tests/smoke/game-domain.test.ts`
  - Interfaces: Consumes `profiles/`, `lib/` · Produces 없음
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      describe("4차 배선", () => {
        it("장르 프로파일이 4종이고 실패 양상이 셋 이상이다", () => {
          const dir = `${ROOT}/profiles`;
          const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
          expect(files.length).toBeGreaterThanOrEqual(4);
          const modes = new Set(
            files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).balance.failureMode),
          );
          expect(modes.size).toBeGreaterThanOrEqual(3);
        });

        it("README 가 2단 게이트와 doctor 를 안내한다", () => {
          const text = fs.readFileSync(`${ROOT}/README.md`, "utf8");
          expect(text).toContain("robloxStageTwo");
          expect(text).toContain("assetDoctor");
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: FAIL (README 미갱신)
    - [x] 최소 구현: README 에 2단 게이트(`robloxStageTwo` 와 세 환경변수)와 에셋 doctor(`assetDoctor` 와 세 전제)를 안내하는 절을 추가하고, 장르 프로파일 표에 `battle-pvp`·`narrative` 행을 넣는다
    - [x] 통과 확인: Run `npx vitest run tests/smoke/` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/README.md tests/smoke/game-domain.test.ts && git commit -m "docs(game): 2단 게이트·doctor·프로파일 4종 안내"`
  - Done when: 스모크 전체와 `npm test` 전체가 통과한다

## Global Constraints

- 스택: Node 20+, ESM(`.mjs`), 테스트는 vitest(`tests/**/*.test.ts`). 커버리지 임계 lines/functions 80%.
- 외부 호출(HTTP·프로세스·환경변수)은 전부 주입 가능. 테스트가 네트워크·자격증명에 의존하지 않는다.
- **미설정과 실패를 구분한다.** `skipped`·`unconfigured`·`failed`·`passed` 네 상태를 섞지 않는다.
- 전제 도구 부재는 예외가 아니라 보고다.
- `tests/smoke/no-unwired-exports.test.ts` 를 통과해야 한다 — 새 모듈의 호출부를 같은 태스크에서 만든다.
- 기존 export 의 반환 형태를 바꾸지 않는다. 확장은 새 키로 한다.
- 새 도메인 스킬·에이전트를 만들지 않는다. 배선과 데이터만 늘린다.
