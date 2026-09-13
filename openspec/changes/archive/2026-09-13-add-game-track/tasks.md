# tasks — add-game-track

- [x] T1. 트랙 규칙과 임계값을 데이터로 선언한다
  - Files: Create `plugins/nereus-game/tracks.json` · Create `plugins/nereus-game/lib/tracks.mjs` · Test `tests/lib/tracks.test.ts`
  - Interfaces: Produces `loadTracks(deps): Tracks` · `platformRule(tracks, id): object` · `revenueRule(tracks, id): object`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/tracks.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { loadTracks, platformRule, revenueRule } from "../../plugins/nereus-game/lib/tracks.mjs";

      describe("tracks", () => {
        it("규모 임계값은 추정이라고 표시돼 있다 — 실측 이력이 없다", () => {
          const t = loadTracks();
          expect(t.manyTrack.maxTasks).toBeGreaterThan(0);
          expect(t.manyTrack.estimate).toBe(true);
          expect(t.manyTrack.basis).toBeTruthy();
        });
        it("로블록스는 깊게를 강제한다", () => {
          expect(platformRule(loadTracks(), "roblox").forcesDeep).toBe(true);
        });
        it("스팀은 강제하지 않는다", () => {
          expect(platformRule(loadTracks(), "steam").forcesDeep).toBe(false);
        });
        it("IAP 는 깊게를 강제하고 유료 단품은 강제하지 않는다", () => {
          const t = loadTracks();
          expect(revenueRule(t, "iap").forcesDeep).toBe(true);
          expect(revenueRule(t, "premium").forcesDeep).toBe(false);
        });
        it("알 수 없는 플랫폼은 기본값으로 떨어지지 않고 던진다", () => {
          expect(() => platformRule(loadTracks(), "nope")).toThrow(/알 수 없는 플랫폼/);
        });
        it("알 수 없는 수익 모델은 던진다", () => {
          expect(() => revenueRule(loadTracks(), "nope")).toThrow(/알 수 없는 수익 모델/);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/tracks.test.ts` · Expected: FAIL (tracks.mjs 없음)
    - [x] `tracks.json` 작성. `platforms` 에 `roblox`(forcesDeep true, why 포함) · `steam` · `play` ·
      `switch` 를, `revenue` 에 `premium` · `iap` · `ads` 를 둔다.
      `manyTrack` 에 `maxTasks`, `estimate: true`, `basis`(메챠 카멜레온 2개월 기준점이며
      우리 실측 이력이 없다는 설명)를 둔다.
    - [x] `lib/tracks.mjs` 작성. `loadTracks` 는 `manyTrack.estimate` 가 없으면 던진다 —
      추정을 추정이라고 표시하지 않은 임계값은 틀린 확신을 준다.
      `platformRule`·`revenueRule` 은 모르는 id 에 던진다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/tracks.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/tracks.json plugins/nereus-game/lib/tracks.mjs tests/lib/tracks.test.ts && git commit -m "feat(game): 트랙 규칙과 규모 임계값을 데이터로 선언한다"`
  - Done when: 임계값에 `estimate: true` 와 근거가 붙어 있고, 모르는 플랫폼·수익 모델이 예외를 던진다

- [x] T2. 트랙 추천기를 만든다
  - Files: Create `plugins/nereus-game/lib/track-advisor.mjs` · Test `tests/lib/track-advisor.test.ts`
  - Interfaces: Consumes `loadTracks(deps): Tracks` · `platformRule(tracks, id)` · `revenueRule(tracks, id)` (T1) · Produces `countScope(tasksText): { tasks: number, flows: number }` · `recommendTrack({ tracks, scope, model }): { recommendation: string, reasons: Array, mismatches: Array }`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/track-advisor.test.ts` — 스펙의 16개 시나리오를 옮긴다.
      로블록스·IAP·라이브이벤트·멀티플레이어 각각의 강제, 작은 규모면 many,
      큰 규모면 deep + `scope-exceeds-many`, 규모 근거의 추정 표시,
      모르는 플랫폼·수익 모델 예외, `premium-with-live-events` 모순,
      모순이 deep 에서도 보고됨, `scope-over-budget` 에 임계·실제값 포함,
      정합하면 불일치 없음, 태스크 수 세기(완료·미완료 합산), flow 수 따로, 빈 내용 0.
    - [x] 실패 확인: Run `npx vitest run tests/lib/track-advisor.test.ts` · Expected: FAIL (track-advisor.mjs 없음)
    - [x] `lib/track-advisor.mjs` 작성.
      `countScope(tasksText)` 는 `- [ ] T` 와 `- [x] T` 를 합해 세고 `[flow]` 를 따로 센다.
      `recommendTrack` 은 강제 조건을 먼저 본다: 플랫폼 · 수익 모델 · `liveEvents` ·
      `persistentMultiplayer`. 하나라도 걸리면 `deep` 이고 각각의 근거 코드를 넣는다.
      아무것도 안 걸리면 태스크 수를 임계와 비교해 `many` 또는 `deep`(+ `scope-exceeds-many`).
      규모로 낸 근거에는 `estimate: true` 를 붙인다.
      불일치는 추천과 **독립적으로** 계산한다: `premium-with-live-events`,
      그리고 강제 조건이 없는데 임계를 넘으면 `scope-over-budget`(임계·실제값 포함).
    - [x] 통과 확인: Run `npx vitest run tests/lib/track-advisor.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/track-advisor.mjs tests/lib/track-advisor.test.ts && git commit -m "feat(game): 트랙 추천기 — 강제 조건 우선, 불일치는 독립 보고"`
  - Done when: 16개 시나리오가 통과하고, 모순이 deep 추천에서도 보고된다

- [x] T3. 스킬·라우트·실행 진입점을 배선한다
  - Files: Create `plugins/nereus-game/skills/track/SKILL.md` · Modify `plugins/nereus-game/nereus-extension.json` · Modify `plugins/nereus-game/lib/track-advisor.mjs`
  - Interfaces: Consumes `recommendTrack` · `countScope` (T2) · `loadTracks` (T1) · Produces route `nereus-game:track`, 실행 진입점 `node lib/track-advisor.mjs`
  - Steps:
    - [x] 실패 테스트를 `tests/smoke/game-domain-liveops.test.ts` 에 덧붙인다:
      ```ts
      it("track 스킬이 배선돼 있고 자기 추천기를 부른다", () => {
        const skills = ext.routes.map((r: any) => r.skill);
        expect(skills).toContain("nereus-game:track");
        const md = fs.readFileSync("plugins/nereus-game/skills/track/SKILL.md", "utf8");
        expect(md).toContain("track-advisor.mjs");
      });
      it("track SKILL 이 추천은 강제가 아님을 밝힌다", () => {
        const md = fs.readFileSync("plugins/nereus-game/skills/track/SKILL.md", "utf8");
        expect(md).toMatch(/강제하지 않는다|게이트가 아니다/);
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain-liveops.test.ts` · Expected: FAIL
    - [x] `skills/track/SKILL.md` 작성. frontmatter `name: track`,
      트리거 "트랙", "다작", "깊게", "규모 판정", "어디에 낼까".
      본문에 두 트랙의 KPI·게이트 두께 대비표, 강제 조건표, 사용법,
      **추천은 게이트가 아니라는 것**, 임계값이 추정이라는 것,
      그리고 실측이 생기면 `tracks.json` 만 고친다는 것을 적는다.
    - [x] `nereus-extension.json` routes 끝에 추가:
      ```json
      { "skill": "nereus-game:track", "why": "다작·깊게 트랙 판정과 규모 대비", "re": "트랙|다작|깊게|규모\\s?판정|어디에\\s?낼|플랫폼\\s?선택" }
      ```
    - [x] `lib/track-advisor.mjs` 끝에 실행 진입점을 붙인다.
      `import { readCliInput, runCli } from "./cli-input.mjs";` 를 쓰고,
      stdin 의 `{ tasksText, model }` 을 받아 `countScope` + `recommendTrack` 결과를 JSON 으로 낸다.
      **`process.exit(0)` 를 부르지 않는다.**
    - [x] 리그 테스트를 `tests/smoke/liveops-rig.test.ts` 에 덧붙인다:
      ```ts
      it("트랙 추천기를 프로세스로 돌려 로블록스 강제를 받는다", () => {
        const input = JSON.stringify({ tasksText: "- [ ] T1. a\n- [x] T2. b [flow]\n", model: { platform: "roblox", revenue: "iap" } });
        const out = runNode("plugins/nereus-game/lib/track-advisor.mjs", input);
        const r = JSON.parse(out);
        expect(r.recommendation).toBe("deep");
        expect(r.reasons.map((x: any) => x.code)).toContain("platform-roblox");
        expect(r.scope.tasks).toBe(2);
        expect(r.scope.flows).toBe(1);
      });
      ```
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-domain-liveops.test.ts tests/smoke/liveops-rig.test.ts` · Expected: PASS
    - [x] 역검증: `nereus-extension.json` 에서 `nereus-game:track` route 를 임시로 지우고
      Run `npx vitest run tests/smoke/game-domain-liveops.test.ts` · Expected: FAIL. 확인 후 되돌린다.
    - [x] 전체 확인: Run `node plugins/nereus/skills/build/scripts/run-tests.mjs` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game tests && git commit -m "feat(game): track 스킬·라우트·실행 진입점을 배선한다"`
  - Done when: route 가 선언되고 SKILL.md 가 추천의 비강제성을 밝히며, 추천기가 자식 프로세스로 돌아 로블록스 강제와 규모를 함께 내고, route 를 지우면 테스트가 실패하는 것을 역검증으로 확인했다

## Global Constraints

- 스택: Node.js ESM (`.mjs`), 테스트는 vitest + TypeScript.
- **코어 `plugins/nereus` 를 수정하지 않는다.**
- **추천은 게이트가 아니다.** `violations` 를 내지 않고 `recommendation`·`reasons`·`mismatches` 를 낸다.
  사업 판단을 하네스가 강제하지 않는다.
- 임계값을 코드에 박지 않는다. `tracks.json` 에 두고 `estimate: true` 와 근거를 붙인다.
- 알 수 없는 플랫폼·수익 모델은 기본값으로 떨어지지 않고 던진다.
- 실행 진입점에서 `process.exit(0)` 를 부르지 않는다. `lib/cli-input.mjs` 를 쓴다.
- 모든 새 `export` 는 자기 파일 밖에서 참조되거나 실행 진입점에서 쓰여야 한다.
- 문서를 테스트보다 먼저 쓴다. 테스트를 마지막에 돌려야 evidence 가 FRESH 로 남는다.
