# tasks — add-game-domain

- [x] T1. 선언 무결성 검사를 먼저 깐다
  - Files: Create `tests/smoke/game-domain.test.ts`
  - Interfaces: Consumes `plugins/nereus-game/` 파일 트리 · Produces 없음
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import fs from "node:fs";
      import path from "node:path";

      const ROOT = "plugins/nereus-game";
      const DOMAIN_SKILLS = ["level", "narrative", "gameux", "asset", "balance"];
      const ENGINE_TOKENS = [/game\.Players/, /:GetService/, /MonoBehaviour/, /UnityEngine/];

      describe("선언한 자산은 실재한다", () => {
        it("라우트가 가리키는 스킬이 전부 있다", () => {
          const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
          for (const r of ext.routes) {
            const name = r.skill.split(":")[1];
            expect(fs.existsSync(`${ROOT}/skills/${name}/SKILL.md`), r.skill).toBe(true);
          }
        });

        it("도메인 스킬 5종이 존재한다", () => {
          for (const s of DOMAIN_SKILLS) {
            expect(fs.existsSync(`${ROOT}/skills/${s}/SKILL.md`), s).toBe(true);
          }
        });

        it("프로파일이 최소 2종 있고 필수 키를 갖는다", () => {
          const dir = `${ROOT}/profiles`;
          const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
          expect(files.length).toBeGreaterThanOrEqual(2);
          for (const f of files) {
            const p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
            for (const key of ["genre", "loop", "metrics", "balance"]) {
              expect(p[key], `${f}:${key}`).toBeDefined();
            }
          }
        });
      });

      describe("도메인 스킬은 엔진을 모른다", () => {
        it("엔진 고유 토큰이 없다", () => {
          for (const s of DOMAIN_SKILLS) {
            const text = fs.readFileSync(`${ROOT}/skills/${s}/SKILL.md`, "utf8");
            for (const re of ENGINE_TOKENS) {
              expect(re.test(text), `${s} 에 ${re}`).toBe(false);
            }
          }
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: FAIL (profiles·도메인 스킬 없음)
    - [x] 최소 구현: 없음. 이 태스크는 검사만 만든다. 이후 태스크가 이것을 초록으로 만든다
    - [x] 커밋: `git add tests/smoke/game-domain.test.ts && git commit -m "test(game): 선언 무결성 검사를 이식보다 먼저"`
  - Done when: 세 검사가 모두 실패하고, 실패 사유가 "아직 만들지 않음"이다

- [x] T2. 장르 프로파일과 로더 [wave:2]
  - Files: Create `plugins/nereus-game/lib/profiles.mjs` · Create `plugins/nereus-game/profiles/sim-tycoon.json` · Create `plugins/nereus-game/profiles/obby-platformer.json` · Test `tests/lib/profiles.test.ts`
  - Interfaces: Consumes 주입 가능한 `{ readJson, readDir }` · Produces `loadProfile(genre, deps): Profile`, `listProfiles(deps): string[]`, `validateProfile(obj): string[]`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { loadProfile, validateProfile } from "../../plugins/nereus-game/lib/profiles.mjs";

      describe("loadProfile", () => {
        it("알려진 장르를 돌려준다", () => {
          const p = loadProfile("sim-tycoon");
          expect(p.genre).toBe("sim-tycoon");
          expect(Array.isArray(p.loop)).toBe(true);
          expect(p.loop.length).toBeGreaterThan(0);
          expect(p.balance).toBeDefined();
        });

        it("알 수 없는 장르는 기본값으로 떨어지지 않고 던진다", () => {
          expect(() => loadProfile("does-not-exist")).toThrow(/알 수 없는 장르/);
        });

        it("loop 가 없으면 검증 실패", () => {
          expect(validateProfile({ genre: "x", metrics: [], balance: {} })).toContain("loop");
        });

        it("두 장르의 루프가 서로 다르다", () => {
          expect(loadProfile("sim-tycoon").loop).not.toEqual(loadProfile("obby-platformer").loop);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/profiles.test.ts` · Expected: FAIL (profiles.mjs 없음)
    - [x] 최소 구현: `validateProfile` 이 `genre`·`loop`·`metrics`·`balance` 중 빠진 키 이름 배열을 돌려준다. `loadProfile` 이 `profiles/` 에서 읽고 검증 실패나 파일 부재면 `알 수 없는 장르` 를 포함한 메시지로 throw 한다. `sim-tycoon` 의 loop 는 수집·판매·재투자·확장, `obby-platformer` 의 loop 는 도전·실패·재시도·통과로 채운다
    - [x] 통과 확인: Run `npx vitest run tests/lib/profiles.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/profiles.mjs plugins/nereus-game/profiles tests/lib/profiles.test.ts && git commit -m "feat(game): 장르 프로파일과 로더"`
  - Done when: 네 테스트가 통과하고 알 수 없는 장르가 조용히 기본값으로 떨어지지 않는다

- [x] T3. Unity 스택·러너 판정 [wave:2]
  - Files: Create `plugins/nereus-game/lib/unity-stack.mjs` · Test `tests/lib/unity-stack.test.ts`
  - Interfaces: Consumes 주입 가능한 `{ exists, readFile }` · Produces `isUnityProject(cwd, fsx)`, `detectUnityRunner(cwd, fsx)`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { detectUnityRunner } from "../../plugins/nereus-game/lib/unity-stack.mjs";

      const fsWith = (files: string[], manifest = "") => ({
        exists: (p: string) => files.some((f) => p.endsWith(f)),
        readFile: () => manifest,
      });

      describe("detectUnityRunner", () => {
        it("테스트 프레임워크가 있으면 batchmode 러너", () => {
          const fsx = fsWith(
            ["ProjectSettings/ProjectVersion.txt", "Packages/manifest.json"],
            JSON.stringify({ dependencies: { "com.unity.test-framework": "1.4.5" } }),
          );
          const out = detectUnityRunner("/p", fsx);
          expect(out?.runner).toBe("unity-test-framework");
          expect(out?.command).toContain("-batchmode");
        });

        it("테스트 프레임워크가 없으면 null", () => {
          const fsx = fsWith(
            ["ProjectSettings/ProjectVersion.txt", "Packages/manifest.json"],
            JSON.stringify({ dependencies: {} }),
          );
          expect(detectUnityRunner("/p", fsx)).toBeNull();
        });

        it("Unity 프로젝트가 아니면 null", () => {
          expect(detectUnityRunner("/p", fsWith(["package.json"]))).toBeNull();
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/unity-stack.test.ts` · Expected: FAIL (unity-stack.mjs 없음)
    - [x] 최소 구현: `ProjectSettings/ProjectVersion.txt` 가 없으면 `null`. 있고 `Packages/manifest.json` 의 `dependencies` 에 `com.unity.test-framework` 가 있으면 `{ runner: "unity-test-framework", command: "Unity -runTests -batchmode -nographics -quit" }`. 그 외 `null`
    - [x] 통과 확인: Run `npx vitest run tests/lib/unity-stack.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/unity-stack.mjs tests/lib/unity-stack.test.ts && git commit -m "feat(game): Unity 스택·러너 판정"`
  - Done when: 세 테스트가 통과하고 코어(`plugins/nereus`)를 한 줄도 고치지 않았다

- [x] T4. 밸런싱 시뮬레이터 — 결정론적 턴 진행
  - Files: Create `plugins/nereus-game/lib/balance-sim.mjs` · Test `tests/lib/balance-sim.test.ts`
  - Interfaces: Consumes `{ profile, economy, turns, seed }` · Produces `simulate(input): { turns: Array, summary: object }`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { simulate } from "../../plugins/nereus-game/lib/balance-sim.mjs";
      import { loadProfile } from "../../plugins/nereus-game/lib/profiles.mjs";

      const economy = {
        income: { base: 10, growth: 1.1 },
        stages: [
          { name: "1단계", cost: 50 },
          { name: "2단계", cost: 300 },
          { name: "3단계", cost: 5000 },
        ],
      };

      describe("simulate", () => {
        it("같은 입력은 같은 출력", () => {
          const a = simulate({ profile: loadProfile("sim-tycoon"), economy, turns: 30, seed: 7 });
          const b = simulate({ profile: loadProfile("sim-tycoon"), economy, turns: 30, seed: 7 });
          expect(a).toEqual(b);
        });

        it("턴 수만큼 기록이 남는다", () => {
          const r = simulate({ profile: loadProfile("sim-tycoon"), economy, turns: 12, seed: 1 });
          expect(r.turns).toHaveLength(12);
          expect(r.turns[0]).toHaveProperty("resource");
        });

        it("자원은 음수가 되지 않는다", () => {
          const r = simulate({ profile: loadProfile("sim-tycoon"), economy, turns: 40, seed: 3 });
          for (const t of r.turns) expect(t.resource).toBeGreaterThanOrEqual(0);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/balance-sim.test.ts` · Expected: FAIL (balance-sim.mjs 없음)
    - [x] 최소 구현: `simulate` 가 턴마다 `income.base * income.growth ** turn` 을 더하고, 도달 가능한 다음 단계가 있으면 비용을 차감한다. 각 턴을 `{ turn, resource, income, clearedStage }` 로 기록한다. 난수를 쓰는 곳은 seed 기반 선형합동생성기로만 만든다
    - [x] 통과 확인: Run `npx vitest run tests/lib/balance-sim.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/balance-sim.mjs tests/lib/balance-sim.test.ts && git commit -m "feat(game): 결정론적 밸런싱 시뮬레이터"`
  - Done when: 세 테스트가 통과하고 두 번 돌린 결과가 완전히 같다

- [x] T5. 밸런싱 판정 — 병목·인플레·난이도 절벽
  - Files: Modify `plugins/nereus-game/lib/balance-sim.mjs` · Modify `tests/lib/balance-sim.test.ts`
  - Interfaces: Consumes T4 의 턴 기록 · Produces `summary: { inflation: number, bottlenecks: string[], cliffs: number[] }`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      it("도달 불가능한 단계를 병목으로 보고한다", () => {
        const wall = { income: { base: 1, growth: 1.0 }, stages: [{ name: "벽", cost: 1e9 }] };
        const r = simulate({ profile: loadProfile("sim-tycoon"), economy: wall, turns: 20, seed: 1 });
        expect(r.summary.bottlenecks).toContain("벽");
      });

      it("수입 증가가 비용 증가를 앞지르면 인플레가 양수", () => {
        const hot = { income: { base: 10, growth: 1.5 }, stages: [{ name: "a", cost: 20 }, { name: "b", cost: 30 }] };
        const r = simulate({ profile: loadProfile("sim-tycoon"), economy: hot, turns: 20, seed: 1 });
        expect(r.summary.inflation).toBeGreaterThan(0);
      });

      it("오비 프로파일은 난이도 절벽 구간을 낸다", () => {
        const obby = { income: { base: 1, growth: 1.0 }, stages: [{ name: "s1", cost: 1 }, { name: "s2", cost: 99 }] };
        const r = simulate({ profile: loadProfile("obby-platformer"), economy: obby, turns: 20, seed: 1 });
        expect(Array.isArray(r.summary.cliffs)).toBe(true);
        expect(r.summary.cliffs.length).toBeGreaterThan(0);
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/balance-sim.test.ts` · Expected: FAIL (summary 판정 없음)
    - [x] 최소 구현: 시뮬레이션 종료 시점까지 못 깬 단계 이름을 `bottlenecks` 에 넣는다. `inflation` 은 마지막 턴 수입 증가율에서 단계 비용 증가율을 뺀 값으로 계산한다. `cliffs` 는 앞 단계 대비 비용 배수가 프로파일 `balance.cliffRatio` 를 넘는 단계 인덱스 배열이다
    - [x] 통과 확인: Run `npx vitest run tests/lib/balance-sim.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/balance-sim.mjs tests/lib/balance-sim.test.ts && git commit -m "feat(game): 밸런싱 병목·인플레·절벽 판정"`
  - Done when: 여섯 테스트가 통과하고 두 장르가 서로 다른 판정을 낸다

- [x] T6. balance 스킬과 economy 에이전트 [wave:3]
  - Files: Create `plugins/nereus-game/skills/balance/SKILL.md` · Create `plugins/nereus-game/agents/economy-designer.md`
  - Interfaces: Consumes `lib/balance-sim.mjs`, `lib/profiles.mjs` · Produces 없음
  - Steps:
    - [x] 실패 테스트 작성: 없음 — 검사는 T1 의 `tests/smoke/game-domain.test.ts` 가 이미 담당한다(도메인 스킬 존재 + 엔진 토큰 없음)
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: FAIL (balance 스킬 없음)
    - [x] 최소 구현: `SKILL.md` 에 (1) 장르 프로파일 선택, (2) 경제 정의를 `{income, stages}` 로 옮기는 절차, (3) `node lib/balance-sim.mjs` 실행과 결과 읽는 법, (4) 병목·인플레·절벽별 대응 수를 적는다. CCGS `balance-check` 에서 판단 기준만 가져와 120줄 안팎으로 압축한다. `economy-designer.md` 는 CCGS 143줄을 Nereus 에이전트 포맷으로 다시 쓴다. 엔진 고유 문법을 쓰지 않는다
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: 이 항목에 한해 PASS (다른 도메인 스킬은 아직 FAIL)
    - [x] 커밋: `git add plugins/nereus-game/skills/balance plugins/nereus-game/agents/economy-designer.md && git commit -m "feat(game): balance 스킬과 economy 에이전트"`
  - Done when: `skills/balance/SKILL.md` 와 `agents/economy-designer.md` 가 존재하고 엔진 토큰 검사를 통과한다

- [x] T7. level 스킬과 level-designer 에이전트 [wave:3]
  - Files: Create `plugins/nereus-game/skills/level/SKILL.md` · Create `plugins/nereus-game/agents/level-designer.md`
  - Interfaces: Consumes `lib/profiles.mjs` 의 `loop` · Produces 없음
  - Steps:
    - [x] 실패 테스트 작성: 없음 — T1 의 검사가 담당한다
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: FAIL (level 스킬 없음)
    - [x] 최소 구현: `SKILL.md` 에 (1) 프로파일 `loop` 를 레벨 구조로 옮기는 절차, (2) 난이도 곡선 설계와 검증, (3) 절차적 생성을 쓸 때의 규칙 — WaveFunctionCollapse·MarkovJunior 는 시드가 같으면 결과가 같아 테스트 가능하다는 점, (4) 장르별 실패 양상(타이쿤은 병목, 오비는 절벽)을 적는다. CCGS `level-designer`(115줄)와 `team-level`(194줄)에서 판단 기준만 가져온다. 엔진 고유 문법을 쓰지 않는다
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: 이 항목에 한해 PASS
    - [x] 커밋: `git add plugins/nereus-game/skills/level plugins/nereus-game/agents/level-designer.md && git commit -m "feat(game): level 스킬과 level-designer 에이전트"`
  - Done when: 두 파일이 존재하고 엔진 토큰 검사를 통과한다

- [x] T8. narrative 스킬과 writer 에이전트 [wave:3]
  - Files: Create `plugins/nereus-game/skills/narrative/SKILL.md` · Create `plugins/nereus-game/agents/writer.md`
  - Interfaces: Consumes 없음 · Produces 없음
  - Steps:
    - [x] 실패 테스트 작성: 없음 — T1 의 검사가 담당한다
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: FAIL (narrative 스킬 없음)
    - [x] 최소 구현: `SKILL.md` 에 (1) 대사를 Yarn Spinner `.yarn` 텍스트 파일로 두는 이유 — git diff·리뷰·테스트가 평범한 코드처럼 된다, (2) 분기 설계 절차, (3) 대사와 게임 상태의 결합을 최소화하는 규칙, (4) 현지화 대비 문자열 분리를 적는다. CCGS `narrative-director`(125줄)·`writer`(104줄)·`world-builder`(111줄)에서 판단 기준만 가져와 셋을 하나로 합친다. 엔진 고유 문법을 쓰지 않는다
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: 이 항목에 한해 PASS
    - [x] 커밋: `git add plugins/nereus-game/skills/narrative plugins/nereus-game/agents/writer.md && git commit -m "feat(game): narrative 스킬과 writer 에이전트"`
  - Done when: 두 파일이 존재하고 엔진 토큰 검사를 통과한다

- [x] T9. gameux 스킬과 ux 에이전트 [wave:3]
  - Files: Create `plugins/nereus-game/skills/gameux/SKILL.md` · Create `plugins/nereus-game/agents/game-ux.md`
  - Interfaces: Consumes 없음 · Produces 없음
  - Steps:
    - [x] 실패 테스트 작성: 없음 — T1 의 검사가 담당한다
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: FAIL (gameux 스킬 없음)
    - [x] 최소 구현: `SKILL.md` 에 게임 UI 가 웹과 다른 축을 적는다 — 입력 장치(터치·게임패드·마우스), 해상도와 안전영역, 게임패드 포커스 이동, 시맨틱 트리가 없다는 점. 그리고 `nereus:design` 의 Gemini 비평 라운드를 게임용 체크리스트로 바꿔 쓰는 법을 적는다. CCGS `ux-design`(989줄)과 `design-system`(871줄)에서 게임에 해당하는 부분만 뽑아 120줄 안팎으로 압축한다. 엔진 고유 문법을 쓰지 않는다
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: 이 항목에 한해 PASS
    - [x] 커밋: `git add plugins/nereus-game/skills/gameux plugins/nereus-game/agents/game-ux.md && git commit -m "feat(game): gameux 스킬과 ux 에이전트"`
  - Done when: 두 파일이 존재하고 엔진 토큰 검사를 통과한다

- [x] T10. asset 스킬과 art 에이전트 [wave:3]
  - Files: Create `plugins/nereus-game/skills/asset/SKILL.md` · Create `plugins/nereus-game/agents/art-director.md`
  - Interfaces: Consumes 없음 · Produces 없음
  - Steps:
    - [x] 실패 테스트 작성: 없음 — T1 의 검사가 담당한다
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: FAIL (asset 스킬 없음)
    - [x] 최소 구현: `SKILL.md` 에 파이프라인 경유 규칙을 적는다 — 3D 는 생성(TRELLIS·PartCrafter) 다음 **반드시 Blender MCP 를 거쳐** 리토폴로지·UV·스케일 정규화·포맷 변환을 하고 나서 엔진에 넣는다. 2D 는 ComfyUI 워크플로를 JSON 으로 고정해 결정론적으로 재생성하고 Pixelorama 로 후처리한다. 오디오는 보이스·SFX 가 ElevenLabs 호스티드 MCP, BGM 이 YuE 다. 각 도구가 없을 때의 대체 경로를 함께 적는다. CCGS `art-bible`(249줄)·`asset-spec`(352줄)에서 사양 기준만 가져온다. 엔진 고유 문법을 쓰지 않는다
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: 이 항목에 한해 PASS
    - [x] 커밋: `git add plugins/nereus-game/skills/asset plugins/nereus-game/agents/art-director.md && git commit -m "feat(game): asset 스킬과 art 에이전트"`
  - Done when: 두 파일이 존재하고 엔진 토큰 검사를 통과한다

- [x] T11. 확장 선언 갱신과 통합 검증 [flow]
  - Files: Modify `plugins/nereus-game/nereus-extension.json` · Modify `tests/smoke/game-wiring.test.ts` · Modify `plugins/nereus-game/README.md`
  - Interfaces: Consumes `loadExtensions`, `routePrompt`, `detectStack`, `detectTestRunner` · Produces 없음
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      it("도메인 라우트 5종과 Unity 스택이 확장에 선언돼 있다", () => {
        const ext = loadExtensions({ readJson, records });
        const skills = ext.routes.map((r) => r.skill);
        for (const s of ["level", "narrative", "gameux", "asset", "balance", "unity"]) {
          expect(skills, s).toContain(`nereus-game:${s}`);
        }
        expect(ext.stacks.map((s) => s.name)).toContain("unity");
      });

      it("Unity 프로젝트에서 코어가 확장 러너를 돌려준다", () => {
        const ext = loadExtensions({ readJson, records });
        const fsx = {
          exists: (p: string) => p.endsWith("ProjectSettings/ProjectVersion.txt") || p.endsWith("Packages/manifest.json"),
          readFile: () => "",
        };
        expect(detectStack("/proj", fsx, { extraStacks: ext.stacks })).toContain("unity");
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-wiring.test.ts` · Expected: FAIL (라우트 5종·unity 스택 미선언)
    - [x] 최소 구현: `nereus-extension.json` 의 `routes` 에 `nereus-game:level`(레벨·맵·난이도), `nereus-game:narrative`(스토리·대사·퀘스트), `nereus-game:gameux`(게임 UI·HUD·조작감), `nereus-game:asset`(에셋·스프라이트·모델·사운드), `nereus-game:balance`(밸런스·경제·수치), `nereus-game:unity`(유니티·폰게임·2D) 를 추가하고, `stacks` 에 `{ name: "unity", marker: "ProjectSettings/ProjectVersion.txt", runnerMarker: "Packages/manifest.json", runner: "unity-test-framework", command: "Unity -runTests -batchmode -nographics -quit" }` 를 추가한다. README 의 지원 스택 표에서 Unity 행을 동작으로 바꾼다
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-wiring.test.ts && npx vitest run tests/smoke/game-domain.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/nereus-extension.json plugins/nereus-game/README.md tests/smoke/game-wiring.test.ts && git commit -m "feat(game): 도메인 라우트 5종과 Unity 스택 선언"`
  - Done when: 두 스모크 파일이 전부 통과하고 `npm test` 전체가 통과한다

- [x] T12. unity 엔진 스킬
  - Files: Create `plugins/nereus-game/skills/unity/SKILL.md` · Modify `tests/smoke/game-domain.test.ts`
  - Interfaces: Consumes `lib/unity-stack.mjs` 의 `detectUnityRunner` · Produces 없음
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      describe("엔진 스킬은 자기 어댑터를 참조한다", () => {
        it("roblox 스킬과 unity 스킬이 있고, unity 스킬이 어댑터를 가리킨다", () => {
          expect(fs.existsSync(`${ROOT}/skills/unity/SKILL.md`)).toBe(true);
          const text = fs.readFileSync(`${ROOT}/skills/unity/SKILL.md`, "utf8");
          expect(text).toContain("unity-stack.mjs");
          expect(text).toContain("detectUnityRunner");
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: FAIL (unity 스킬 없음)
    - [x] 최소 구현: `SKILL.md` 에 (1) Unity 프로젝트 전제와 `detectUnityRunner` 로 러너를 확인하는 법, (2) 테스트는 `Unity -runTests -batchmode -nographics -quit` 로 헤드리스 실행한다는 것, (3) 2D 폰게임에서 봐야 하는 것 — 해상도 대응·터치 입력·발열과 배터리·기기 파편화, (4) AltTester 는 GPL-3.0 이 게임 빌드에 전염되므로 비GPL 경로 확보 전에는 도입하지 않는다는 금지를 적는다. 이 스킬은 엔진 스킬이므로 엔진 고유 문법 제한을 받지 않는다
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/skills/unity tests/smoke/game-domain.test.ts && git commit -m "feat(game): unity 엔진 스킬"`
  - Done when: `skills/unity/SKILL.md` 가 존재하고 `detectUnityRunner` 를 참조해 어댑터가 미배선 상태로 남지 않는다


## Global Constraints

- 스택: Node 20+, ESM(`.mjs`), 테스트는 vitest(`tests/**/*.test.ts`). 커버리지 임계 lines/functions 80%.
- **코어 `plugins/nereus` 를 수정하지 않는다.** 1차에 연 확장점만 쓴다. 고쳐야 한다면 설계가 틀린 것이다.
- 도메인 스킬 5종 본문에 엔진 고유 문법을 쓰지 않는다(`game.Players`·`:GetService`·`MonoBehaviour`·`UnityEngine`).
- 장르 분기를 코드로 쓰지 않는다. 프로파일 데이터로만 다룬다.
- 시뮬레이터는 결정론적이어야 한다. 난수는 seed 기반만 허용한다.
- CCGS 본문을 그대로 복사하지 않는다. 판단 기준만 가져와 스킬당 120줄 안팎으로 압축하고, NOTICE 귀속을 유지한다.
- 훅·스크립트는 Node 만. `bash` 금지. 경로는 win32 에서도 동작해야 한다.
