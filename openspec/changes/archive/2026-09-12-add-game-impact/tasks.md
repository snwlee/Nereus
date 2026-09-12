# tasks — add-game-impact

- [x] T1. 임팩트 예산 검사기를 만든다
  - Files: Create `plugins/nereus-game/lib/impact-budget.mjs` · Test `tests/lib/impact-budget.test.ts`
  - Interfaces: Consumes `loadProfile(genre, deps): Profile` · Produces `checkImpact({ profile, plan, soundCues }): { violations: Array, unmeasured: string[] }`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/impact-budget.test.ts` — 스펙의 12개 시나리오를 그대로 옮긴다.
      히트스톱 누적, 개별은 짧지만 합이 초과, 셰이크 진폭 합, 파티클, 단일 채널, 모션 감소 미선언,
      입력 버퍼, no-baseline, 없는 사운드 큐 참조, sound 선언 자체 없음, soundCues 미주입,
      교차 검증 통과.
    - [x] 실패 확인: Run `npx vitest run tests/lib/impact-budget.test.ts` · Expected: FAIL (impact-budget.mjs 없음)
    - [x] `plugins/nereus-game/lib/impact-budget.mjs` 작성. 판정 규칙:
      - `hitstop-budget`: 큐들의 `hitstopMs * hitsPerSecond` 합이 `profile.impact.maxFrozenMsPerSec` 초과
      - `shake-amplitude`: `concurrent: true` 인 셰이크 진폭 합이 `profile.impact.maxShakeAmplitude` 초과
      - `particle-budget`: `plan.maxParticles` 가 `profile.impact.maxParticles` 초과
      - `single-channel`: 큐의 `visual`·`sound`·`haptic` 중 참인 것이 2개 미만
      - `no-reduced-motion`: `shake` 가 있는 큐에 `reducedMotion` 이 비어 있음
      - `input-buffer`: `plan.inputBufferMs` 가 `profile.impact.minInputBufferMs` 미만
      - `no-baseline`: `profile.impact` 없음 — 이 경우 다른 검사를 하지 않고 이것만 돌려준다
      - `sound-missing`: `soundCues` 가 주어졌을 때 큐의 `sound` 가 비었거나 목록에 없음
      - `soundCues` 미주입이면 `unmeasured` 에 `"sound-cross-check"` 를 넣는다
    - [x] 통과 확인: Run `npx vitest run tests/lib/impact-budget.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/lib/impact-budget.mjs tests/lib/impact-budget.test.ts && git commit -m "feat(game): 임팩트 예산 검사기"`
  - Done when: 12개 시나리오가 전부 통과하고, 기준 없는 프로파일이 `no-baseline` 만 낸다

- [x] T2. 장르 프로파일 4종에 impact 기준을 덧붙인다
  - Files: Modify `plugins/nereus-game/profiles/sim-tycoon.json` · Modify `plugins/nereus-game/profiles/obby-platformer.json` · Modify `plugins/nereus-game/profiles/battle-pvp.json` · Modify `plugins/nereus-game/profiles/narrative.json` · Test `tests/lib/profiles-domains.test.ts`
  - Interfaces: Consumes `listProfiles(deps): string[]` · `loadProfile(genre, deps): Profile` · `checkImpact` (T1) · Produces 없음 (데이터만 추가)
  - Steps:
    - [x] `tests/lib/profiles-domains.test.ts` 에 실패 테스트를 덧붙인다:
      ```ts
      it("모든 장르가 impact 기준을 갖는다", () => {
        for (const g of listProfiles()) expect(loadProfile(g).impact, g).toBeTruthy();
      });
      it("impact 기준이 있으므로 어떤 장르도 no-baseline 을 내지 않는다", () => {
        const plan = { maxParticles: 1, inputBufferMs: 999, cues: [] };
        for (const g of listProfiles()) {
          const r = checkImpact({ profile: loadProfile(g), plan });
          expect(r.violations.map((v: any) => v.code), g).not.toContain("no-baseline");
        }
      });
      ```
      파일 상단 import 에 `checkImpact` 를 추가한다:
      ```ts
      import { checkImpact } from "../../plugins/nereus-game/lib/impact-budget.mjs";
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/profiles-domains.test.ts` · Expected: FAIL (프로파일에 impact 키 없음)
    - [x] 네 프로파일에 `impact` 키를 추가한다. 값은 장르마다 다르다 — PvP 는 타격이 잦아
      정지 예산이 크고, 타이쿤은 타격이 거의 없어 작다:
      `sim-tycoon.json`:
      ```json
      "impact": { "maxFrozenMsPerSec": 40, "maxShakeAmplitude": 0.3, "maxParticles": 200, "minInputBufferMs": 80 }
      ```
      `obby-platformer.json`:
      ```json
      "impact": { "maxFrozenMsPerSec": 60, "maxShakeAmplitude": 0.5, "maxParticles": 300, "minInputBufferMs": 120 }
      ```
      `battle-pvp.json`:
      ```json
      "impact": { "maxFrozenMsPerSec": 120, "maxShakeAmplitude": 0.8, "maxParticles": 500, "minInputBufferMs": 100 }
      ```
      `narrative.json`:
      ```json
      "impact": { "maxFrozenMsPerSec": 20, "maxShakeAmplitude": 0.2, "maxParticles": 150, "minInputBufferMs": 60 }
      ```
    - [x] 통과 확인: Run `npx vitest run tests/lib/profiles-domains.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game/profiles tests/lib/profiles-domains.test.ts && git commit -m "feat(game): 장르 프로파일에 impact 기준을 데이터로 덧붙인다"`
  - Done when: 네 장르 모두 `impact` 를 갖고 `npx vitest run tests/lib/profiles-domains.test.ts` 가 통과한다

- [x] T3. impact 스킬과 라우트를 배선하고 실행 진입점을 붙인다
  - Files: Create `plugins/nereus-game/skills/impact/SKILL.md` · Modify `plugins/nereus-game/nereus-extension.json` · Modify `plugins/nereus-game/skills/gameux/SKILL.md`
  - Interfaces: Consumes `checkImpact` (T1) · Produces route `nereus-game:impact`, 실행 진입점 `node lib/impact-budget.mjs`
  - Steps:
    - [x] 실패 테스트를 `tests/smoke/game-domain-liveops.test.ts` 의 배선 검사에 덧붙인다:
      ```ts
      it("impact 스킬이 배선돼 있고 자기 검사기를 부른다", () => {
        const skills = ext.routes.map((r: any) => r.skill);
        expect(skills).toContain("nereus-game:impact");
        const md = fs.readFileSync("plugins/nereus-game/skills/impact/SKILL.md", "utf8");
        expect(md).toContain("impact-budget.mjs");
        expect(md).toMatch(/엔진과 무관|엔진 불가지론/);
      });
      it("gameux 가 임팩트를 impact 로 넘긴다 — 두 곳에 같은 기준을 두지 않는다", () => {
        const md = fs.readFileSync("plugins/nereus-game/skills/gameux/SKILL.md", "utf8");
        expect(md).toContain("nereus-game:impact");
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain-liveops.test.ts` · Expected: FAIL (route 와 SKILL.md 없음)
    - [x] `plugins/nereus-game/skills/impact/SKILL.md` 작성. frontmatter `name: impact`,
      description 에 트리거 "타격감", "임팩트", "히트스톱", "화면 흔들림", "파티클", "연출" 을 넣는다.
      본문에 "**엔진과 무관하다**", gameux 와의 경계(UI 축 대 연출 축), 계획 JSON 예시,
      `node "${CLAUDE_PLUGIN_ROOT}/lib/impact-budget.mjs"` 사용법, 위반 코드 표,
      그리고 사운드 교차 검증이 왜 핵심인지를 적는다.
    - [x] `nereus-extension.json` 의 routes 끝에 추가한다:
      ```json
      { "skill": "nereus-game:impact", "why": "타격감·임팩트·연출 예산", "re": "타격감|임팩트|히트스톱|화면\\s?흔들|스크린셰이크|파티클|연출|게임필|game\\s?feel" }
      ```
    - [x] `skills/gameux/SKILL.md` 의 "## 4. 조작감" 절 끝에 포인터 한 줄을 넣는다:
      "타격감·히트스톱·화면 흔들림·파티클 예산은 `nereus-game:impact` 가 수치로 판정한다. 여기서는 입력 타이밍만 본다."
    - [x] `plugins/nereus-game/lib/impact-budget.mjs` 끝에 실행 진입점을 붙인다.
      상단에 `import { readFileSync } from "node:fs";` 와 `import { loadProfile } from "./profiles.mjs";` 를 넣고:
      ```js
      function readStdin() {
        try { return readFileSync(0, "utf8"); } catch { return ""; }
      }

      if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
        const input = JSON.parse(readStdin() || "{}");
        const profile = loadProfile(input.genre);
        process.stdout.write(JSON.stringify(checkImpact({ profile, plan: input.plan, soundCues: input.soundCues ?? null })) + "\n");
        process.exit(0);
      }
      ```
    - [x] 리그 테스트를 `tests/smoke/liveops-rig.test.ts` 에 덧붙인다:
      ```ts
      it("impact 검사기를 프로세스로 돌려 사운드 교차 검증 결과를 받는다", () => {
        const plan = { maxParticles: 10, inputBufferMs: 999, cues: [{ name: "hit", visual: true, sound: "nope", haptic: true }] };
        const out = runNode("plugins/nereus-game/lib/impact-budget.mjs", JSON.stringify({ genre: "battle-pvp", plan, soundCues: ["swing"] }));
        expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("sound-missing");
      });
      ```
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-domain-liveops.test.ts tests/smoke/liveops-rig.test.ts` · Expected: PASS
    - [x] 역검증: `nereus-extension.json` 에서 `nereus-game:impact` route 를 임시로 지우고
      Run `npx vitest run tests/smoke/game-domain-liveops.test.ts` · Expected: FAIL. 확인 후 되돌린다.
    - [x] 전체 확인: Run `node plugins/nereus/skills/build/scripts/run-tests.mjs` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus-game tests/smoke && git commit -m "feat(game): impact 스킬·라우트·실행 진입점을 배선한다"`
  - Done when: route 가 선언되고 SKILL.md 가 실재하며, 검사기가 자식 프로세스로 돌아 `sound-missing` 을 내고, route 를 지우면 테스트가 실패하는 것을 역검증으로 확인했다

## Global Constraints

- 스택: Node.js ESM (`.mjs`), 테스트는 vitest + TypeScript (`tests/**/*.test.ts`).
- **코어 `plugins/nereus` 를 수정하지 않는다.**
- 모든 새 `export` 는 자기 파일 밖에서 참조되거나 실행 진입점에서 쓰여야 한다.
- 프로파일 키는 **선택 키**로 추가한다. `validateProfile` 의 필수 키를 늘리지 않는다.
- 사운드 큐 목록이 없다고 검사가 통째로 꺼지지 않는다. 그 항목만 `unmeasured` 로 남긴다.
- 훅에 `bash` 스크립트를 쓰지 않는다 (메인 개발 환경이 Windows).
- 문서를 테스트보다 **먼저** 쓴다. 테스트를 마지막에 돌려야 evidence 가 FRESH 로 남는다.
