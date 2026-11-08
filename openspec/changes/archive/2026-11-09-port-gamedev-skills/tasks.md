# tasks — awesome-gamedev-agent-skills 이식

- [x] T1. 증분 경제 수식 (가격·buy max·환생 비율·오프라인·큰 수 표기) [wave:1]
  - Files: Create `plugins/nereus-game/lib/economy-curve.mjs` · Test `tests/lib/economy-curve.test.ts`
  - Interfaces: Consumes 없음 · Produces `levelCost(base, growth, level): number`, `maxAffordable({base, growth, owned, balance, maxLevel}): {levels, cost}`, `rebirthWaitRatios(rebirth, count): number[]`, `offlineEarnings({secondsAway, perSecond, maxHours, efficiency}): number`, `formatNumber(value, decimals?): string`
  - Steps:
    - [ ] 실패 테스트 작성: `tests/lib/economy-curve.test.ts`
      ```ts
      import { describe, it, expect } from "vitest";
      import { levelCost, maxAffordable, rebirthWaitRatios, offlineEarnings, formatNumber } from "../../plugins/nereus-game/lib/economy-curve.mjs";

      describe("증분 경제 수식", () => {
        it("다음 레벨 가격은 floor(base * growth^level)", () => {
          expect(levelCost(10, 1.15, 0)).toBe(10);
          expect(levelCost(10, 1.15, 1)).toBe(11);
        });
        it("buy max 는 실제 가격을 걷고 maxLevel 에서 멈춘다", () => {
          expect(maxAffordable({ base: 10, growth: 1.15, owned: 0, balance: 21, maxLevel: 100 })).toEqual({ levels: 2, cost: 21 });
          expect(maxAffordable({ base: 1, growth: 1, owned: 0, balance: 1e9, maxLevel: 50 }).levels).toBe(50);
        });
        it("가격 0 은 무한 루프 대신 던진다", () => {
          expect(() => maxAffordable({ base: 0, growth: 1, owned: 0, balance: 10, maxLevel: 5 })).toThrow();
        });
        it("가산 배율의 환생 대기 비율은 r(1+kp)/(1+(k+1)p)", () => {
          const r = rebirthWaitRatios({ baseRequirement: 1e6, requirementGrowth: 3, multiplierPerRebirth: 0.5 }, 3);
          expect(r[0]).toBeCloseTo(2.0, 9);
          expect(r[1]).toBeCloseTo(2.25, 9);
        });
        it("곱셈 배율의 환생 대기 비율은 r/q 로 일정하다", () => {
          const r = rebirthWaitRatios({ baseRequirement: 1e6, requirementGrowth: 3, multiplierGrowth: 2.4 }, 4);
          for (const x of r) expect(x).toBeCloseTo(1.25, 9);
        });
        it("오프라인 수익은 상한으로 자르고 음수·NaN 시간은 0", () => {
          expect(offlineEarnings({ secondsAway: 100 * 3600, perSecond: 10, maxHours: 8, efficiency: 0.5 })).toBe(144000);
          expect(offlineEarnings({ secondsAway: -5, perSecond: 10, maxHours: 8, efficiency: 0.5 })).toBe(0);
          expect(offlineEarnings({ secondsAway: NaN, perSecond: 10, maxHours: 8, efficiency: 0.5 })).toBe(0);
        });
        it("큰 수 표기는 반올림 후 접미사를 고른다 — 1000.0K 가 아니라 1.0M", () => {
          expect(formatNumber(999)).toBe("999");
          expect(formatNumber(1500)).toBe("1.5K");
          expect(formatNumber(999950)).toBe("1.0M");
          expect(formatNumber(-2500)).toBe("-2.5K");
          expect(formatNumber(1e66)).toBe("1.0e66");
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/economy-curve.test.ts` · Expected: FAIL (모듈 없음)
    - [ ] 최소 구현: `economy-curve.mjs` 에 다섯 함수. 접미사는 K·M·B·T·Qa·Qi·Sx·Sp·Oc·No·Dc·Ud·Dd·Td·Qad·Qid·Sxd·Spd·Ocd·Nod·Vg, 그 너머는 `x.xeN`. 곱셈 배율은 `multiplierGrowth` 가 있을 때다. 파일 머리에 원본 출처(Apache-2.0)와 "JS 로 다시 씀"을 적는다.
    - [ ] 통과 확인: Run `npx vitest run tests/lib/economy-curve.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-game/lib/economy-curve.mjs tests/lib/economy-curve.test.ts && git commit -m "feat(game): 증분 경제 수식"`
  - Done when: `tests/lib/economy-curve.test.ts` 7개 통과

- [x] T2. 페이싱 판정 `checkPacing` + `sim-tycoon.pacing` + CLI
  - Files: Modify `plugins/nereus-game/lib/economy-curve.mjs` · Modify `plugins/nereus-game/profiles/sim-tycoon.json` · Test `tests/lib/economy-pacing.test.ts`
  - Interfaces: Consumes `rebirthWaitRatios`, `loadProfile` · Produces `checkPacing({profile, config}): {violations, unmeasured, ratios}`
  - Steps:
    - [ ] 실패 테스트 작성: `tests/lib/economy-pacing.test.ts`
      ```ts
      import { describe, it, expect } from "vitest";
      import { execFileSync } from "node:child_process";
      import { checkPacing } from "../../plugins/nereus-game/lib/economy-curve.mjs";
      import { loadProfile } from "../../plugins/nereus-game/lib/profiles.mjs";

      const profile = loadProfile("sim-tycoon");
      const base = {
        upgrades: [{ id: "Income", baseCost: 10, costGrowth: 1.15, maxLevel: 40 }],
        rebirth: { baseRequirement: 1e6, requirementGrowth: 1.8, multiplierPerRebirth: 0.5 },
        offline: { maxHours: 8, efficiency: 0.5 },
        peakBalance: 1e12,
      };
      const codes = (r: any) => r.violations.map((v: any) => v.code);

      describe("페이싱 판정", () => {
        it("r=1.8 · p=0.5 · 8시간 · 0.5 는 통과한다", () => {
          const r = checkPacing({ profile, config: base });
          expect(r.violations).toEqual([]);
          expect(r.unmeasured).toEqual([]);
        });
        it("r=3 이면 환생이 갈수록 2배 넘게 느려진다", () => {
          const r = checkPacing({ profile, config: { ...base, rebirth: { ...base.rebirth, requirementGrowth: 3 } } });
          expect(codes(r)).toContain("rebirth-ratio");
        });
        it("50번 사는 업그레이드에 1.5 성장은 가파르다", () => {
          const r = checkPacing({ profile, config: { ...base, upgrades: [{ id: "X", baseCost: 10, costGrowth: 1.5, maxLevel: 50 }] } });
          expect(codes(r)).toContain("steep-growth");
        });
        it("가격 0 업그레이드는 buy max 를 멈추지 못한다", () => {
          const r = checkPacing({ profile, config: { ...base, upgrades: [{ id: "X", baseCost: 0, costGrowth: 1.1, maxLevel: 10 }] } });
          expect(codes(r)).toContain("free-upgrade");
        });
        it("오프라인 효율·상한이 범위를 벗어나면 위반", () => {
          const r = checkPacing({ profile, config: { ...base, offline: { maxHours: 48, efficiency: 0.9 } } });
          expect(codes(r)).toEqual(expect.arrayContaining(["offline-cap", "offline-efficiency"]));
        });
        it("잔액이 1e15 를 넘으면 정밀도 위반", () => {
          expect(codes(checkPacing({ profile, config: { ...base, peakBalance: 1e16 } }))).toContain("precision");
        });
        it("pacing 기준이 없는 장르는 no-baseline", () => {
          expect(codes(checkPacing({ profile: loadProfile("obby-platformer"), config: base }))).toEqual(["no-baseline"]);
        });
        it("환생·오프라인이 없으면 통과가 아니라 미측정", () => {
          const r = checkPacing({ profile, config: { upgrades: base.upgrades } });
          expect(r.unmeasured).toEqual(expect.arrayContaining(["rebirth", "offline", "peakBalance"]));
        });
        it("프로세스로 돌면 stdout JSON 을 낸다", () => {
          const out = execFileSync("node", ["plugins/nereus-game/lib/economy-curve.mjs"], {
            input: JSON.stringify({ genre: "sim-tycoon", config: { ...base, rebirth: { ...base.rebirth, requirementGrowth: 3 } } }),
            encoding: "utf8",
          });
          expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("rebirth-ratio");
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/economy-pacing.test.ts` · Expected: FAIL (`checkPacing` 없음)
    - [ ] 최소 구현: `sim-tycoon.json` 에 `"pacing": { "rebirthWaitRatio": [1.2, 1.6], "rebirthHorizon": 8, "manyLevels": 30, "maxGrowthForManyLevels": 1.15, "offlineEfficiency": [0.25, 0.5], "offlineMaxHours": [8, 12], "precisionLimit": 1e15, "note": "환생 대기는 직전보다 조금만 길어야 한다" }` 를 더하고 `checkPacing` 과 `runCli` 진입점을 구현한다. 비율 비교는 1e-9 허용오차.
    - [ ] 통과 확인: Run `npx vitest run tests/lib/economy-pacing.test.ts tests/lib/profiles-domains.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-game/lib/economy-curve.mjs plugins/nereus-game/profiles/sim-tycoon.json tests/lib/economy-pacing.test.ts && git commit -m "feat(game): 증분 페이싱 판정"`
  - Done when: `economy-pacing.test.ts` 9개 통과, 기존 프로파일 테스트 통과

- [x] T3. 퍼즐 판 검증기 `checkBoard` [wave:2]
  - Files: Create `plugins/nereus-game/lib/puzzle-board.mjs` · Test `tests/lib/puzzle-board.test.ts`
  - Interfaces: Consumes 없음 · Produces `findMatches(board): [y,x][]`, `hasValidMove(board): boolean`, `slidingSolvable(tiles, width): boolean`, `checkBoard({kind, board?, tiles?, width?}): {violations}`
  - Steps:
    - [ ] 실패 테스트 작성: `tests/lib/puzzle-board.test.ts`
      ```ts
      import { describe, it, expect } from "vitest";
      import { execFileSync } from "node:child_process";
      import { findMatches, hasValidMove, slidingSolvable, checkBoard } from "../../plugins/nereus-game/lib/puzzle-board.mjs";

      const codes = (r: any) => r.violations.map((v: any) => v.code);
      const playable = [[1, 1, 2], [2, 3, 1], [3, 2, 3]];

      describe("매치-3 판", () => {
        it("시작부터 3연속이 있으면 initial-match", () => {
          expect(findMatches([[1, 1, 1], [2, 3, 2], [3, 2, 3]])).toHaveLength(3);
          expect(codes(checkBoard({ kind: "match3", board: [[1, 1, 1], [2, 3, 2], [3, 2, 3]] }))).toContain("initial-match");
        });
        it("둘 수 있는 수가 있고 시작 매치가 없으면 통과", () => {
          expect(hasValidMove(playable)).toBe(true);
          expect(checkBoard({ kind: "match3", board: playable }).violations).toEqual([]);
        });
        it("어떤 교환도 매치를 못 만들면 deadlock", () => {
          expect(codes(checkBoard({ kind: "match3", board: [[1, 2], [2, 1]] }))).toEqual(["deadlock"]);
        });
        it("검사가 판을 바꾸지 않는다", () => {
          const b = playable.map((r) => [...r]);
          hasValidMove(b);
          expect(b).toEqual(playable);
        });
      });

      describe("슬라이딩 판 패리티", () => {
        it("홀수 폭: 반전 수가 짝수면 풀린다", () => {
          expect(slidingSolvable([1, 2, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(true);
          expect(slidingSolvable([2, 1, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(false);
        });
        it("짝수 폭: 반전 수 + 빈칸의 아래에서 센 행이 홀수면 풀린다", () => {
          const solved = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
          expect(slidingSolvable(solved, 4)).toBe(true);
          expect(slidingSolvable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0], 4)).toBe(false);
          expect(codes(checkBoard({ kind: "sliding", tiles: [2, 1, 3, 4, 5, 6, 7, 8, 0], width: 3 }))).toEqual(["unsolvable-parity"]);
        });
        it("알 수 없는 종류는 던진다", () => {
          expect(() => checkBoard({ kind: "hex" } as any)).toThrow();
        });
        it("프로세스로 돌면 stdout JSON 을 낸다", () => {
          const out = execFileSync("node", ["plugins/nereus-game/lib/puzzle-board.mjs"], {
            input: JSON.stringify({ kind: "match3", board: [[1, 2], [2, 1]] }),
            encoding: "utf8",
          });
          expect(JSON.parse(out).violations[0].code).toBe("deadlock");
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/puzzle-board.test.ts` · Expected: FAIL (모듈 없음)
    - [ ] 최소 구현: 빈칸은 falsy. `hasValidMove` 는 복사본에서 교환한다. 슬라이딩은 빈칸 목표가 오른쪽 아래인 규칙. `runCli` 진입점.
    - [ ] 통과 확인: Run `npx vitest run tests/lib/puzzle-board.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-game/lib/puzzle-board.mjs tests/lib/puzzle-board.test.ts && git commit -m "feat(game): 퍼즐 판 검증기"`
  - Done when: `puzzle-board.test.ts` 8개 통과

- [x] T4. 세이브 검사기 `checkSave` [wave:2]
  - Files: Create `plugins/nereus-game/lib/save-check.mjs` · Test `tests/lib/save-check.test.ts`
  - Interfaces: Consumes 없음 · Produces `checkSave(plan): {violations}`
  - Steps:
    - [ ] 실패 테스트 작성: `tests/lib/save-check.test.ts`
      ```ts
      import { describe, it, expect } from "vitest";
      import { execFileSync } from "node:child_process";
      import { checkSave } from "../../plugins/nereus-game/lib/save-check.mjs";

      const good = {
        currentVersion: 3,
        migrations: [1, 2],
        write: "atomic-rename",
        backup: true,
        autosave: { separateSlot: true },
        newerVersion: "refuse",
        fixtures: [1, 2, 3],
        fields: [{ name: "coins" }, { name: "seed" }],
      };
      const codes = (r: any) => r.violations.map((v: any) => v.code);

      describe("세이브 검사", () => {
        it("갖출 것을 다 갖추면 위반 0", () => {
          expect(checkSave(good).violations).toEqual([]);
        });
        it("버전 필드가 없으면 no-version", () => {
          expect(codes(checkSave({ ...good, currentVersion: undefined }))).toContain("no-version");
        });
        it("빠진 마이그레이션 단계를 짚는다", () => {
          const r = checkSave({ ...good, migrations: [1] });
          expect(r.violations.find((v: any) => v.code === "migration-gap").missing).toEqual([2]);
        });
        it("제자리 쓰기·백업 없음·자동저장 덮어쓰기·새 버전 수용을 각각 짚는다", () => {
          const r = checkSave({ ...good, write: "in-place", backup: false, autosave: { separateSlot: false }, newerVersion: "load" });
          expect(codes(r)).toEqual(expect.arrayContaining(["in-place-write", "no-backup", "autosave-clobber", "newer-not-refused"]));
        });
        it("버전별 회귀 표본이 빠지면 fixture-gap", () => {
          expect(checkSave({ ...good, fixtures: [3] }).violations.find((v: any) => v.code === "fixture-gap").missing).toEqual([1, 2]);
        });
        it("파생 데이터를 저장하면 derived-stored", () => {
          expect(codes(checkSave({ ...good, fields: [{ name: "dps", derived: true }] }))).toContain("derived-stored");
        });
        it("프로세스로 돌면 stdout JSON 을 낸다", () => {
          const out = execFileSync("node", ["plugins/nereus-game/lib/save-check.mjs"], {
            input: JSON.stringify({ plan: { ...good, write: "in-place" } }),
            encoding: "utf8",
          });
          expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("in-place-write");
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/save-check.test.ts` · Expected: FAIL (모듈 없음)
    - [ ] 최소 구현: 규칙 7개를 순수 함수로. 위반마다 `why` 한 문장. CLI 는 `{ plan }` 을 받는다.
    - [ ] 통과 확인: Run `npx vitest run tests/lib/save-check.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-game/lib/save-check.mjs tests/lib/save-check.test.ts && git commit -m "feat(game): 세이브 검사기"`
  - Done when: `save-check.test.ts` 7개 통과

- [x] T5. 프레임 예산 검사기 `checkFrames` [wave:2]
  - Files: Create `plugins/nereus-game/lib/frame-budget.mjs` · Test `tests/lib/frame-budget.test.ts`
  - Interfaces: Consumes 없음 · Produces `checkFrames({targetFps, samplesMs, build, device, cpuMs?, gpuMs?, gcBytesPerFrame?}): {budgetMs, p50, p95, p99, bound, evidence, pass, violations}`
  - Steps:
    - [ ] 실패 테스트 작성: `tests/lib/frame-budget.test.ts`
      ```ts
      import { describe, it, expect } from "vitest";
      import { execFileSync } from "node:child_process";
      import { checkFrames } from "../../plugins/nereus-game/lib/frame-budget.mjs";

      const ok = { targetFps: 60, build: "release", device: "target" };
      const fill = (n: number, v: number) => Array.from({ length: n }, () => v);
      const codes = (r: any) => r.violations.map((v: any) => v.code);

      describe("프레임 예산", () => {
        it("예산 안의 릴리스·대상 기기 측정은 통과", () => {
          const r = checkFrames({ ...ok, samplesMs: fill(100, 10) });
          expect(r.budgetMs).toBeCloseTo(16.667, 2);
          expect(r.p95).toBe(10);
          expect(r.pass).toBe(true);
        });
        it("p95 가 예산을 넘으면 over-budget", () => {
          expect(codes(checkFrames({ ...ok, samplesMs: fill(100, 20) }))).toContain("over-budget");
        });
        it("예산 2배 초과 프레임이 1% 넘으면 hitch-rate", () => {
          const r = checkFrames({ ...ok, samplesMs: [...fill(95, 10), ...fill(5, 40)] });
          expect(codes(r)).toEqual(["hitch-rate"]);
          expect(r.p99).toBe(40);
        });
        it("후반이 전반보다 크게 느려지면 thermal-drop", () => {
          expect(codes(checkFrames({ ...ok, samplesMs: [...fill(100, 12), ...fill(100, 25)] }))).toContain("thermal-drop");
        });
        it("프레임당 GC 할당은 0 이어야 한다", () => {
          expect(codes(checkFrames({ ...ok, samplesMs: fill(100, 10), gcBytesPerFrame: 512 }))).toContain("gc-per-frame");
        });
        it("에디터 측정은 위반이 없어도 통과가 아니다", () => {
          const r = checkFrames({ ...ok, build: "editor", samplesMs: fill(100, 10) });
          expect(r.violations).toEqual([]);
          expect(r.evidence).toBe(false);
          expect(r.pass).toBe(false);
        });
        it("CPU·GPU 시간으로 병목 쪽을 가른다", () => {
          expect(checkFrames({ ...ok, samplesMs: fill(10, 15), cpuMs: 5, gpuMs: 14 }).bound).toBe("gpu");
          expect(checkFrames({ ...ok, samplesMs: fill(10, 15) }).bound).toBe("unknown");
        });
        it("목표 FPS 나 표본이 없으면 던진다", () => {
          expect(() => checkFrames({ ...ok, targetFps: 0, samplesMs: [10] })).toThrow();
          expect(() => checkFrames({ ...ok, samplesMs: [] })).toThrow();
        });
        it("프로세스로 돌면 stdout JSON 을 낸다", () => {
          const out = execFileSync("node", ["plugins/nereus-game/lib/frame-budget.mjs"], {
            input: JSON.stringify({ ...ok, samplesMs: fill(100, 20) }),
            encoding: "utf8",
          });
          expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("over-budget");
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/frame-budget.test.ts` · Expected: FAIL (모듈 없음)
    - [ ] 최소 구현: nearest-rank 백분위. 상수 `HITCH_FACTOR=2`, `MAX_HITCH_RATE=0.01`, `THERMAL_RATIO=1.2`, `BOUND_MARGIN=1.1`. 발열은 표본 앞 1/4 평균과 뒤 1/4 평균을 비교하고 뒤가 예산도 넘을 때만.
    - [ ] 통과 확인: Run `npx vitest run tests/lib/frame-budget.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-game/lib/frame-budget.mjs tests/lib/frame-budget.test.ts && git commit -m "feat(game): 프레임 예산 검사기"`
  - Done when: `frame-budget.test.ts` 9개 통과

- [x] T6. save · perf 스킬, 라우트, 도메인 스킬 배선
  - Files: Create `plugins/nereus-game/skills/save/SKILL.md` · Create `plugins/nereus-game/skills/perf/SKILL.md` · Modify `plugins/nereus-game/nereus-extension.json` · Modify `tests/smoke/game-domain.test.ts`
  - Interfaces: Consumes `checkSave`, `checkFrames` · Produces 라우트 `nereus-game:save`, `nereus-game:perf`
  - Steps:
    - [ ] 실패 테스트 작성: `tests/smoke/game-domain.test.ts` 의 `DOMAIN_SKILLS` 에 `"save", "perf"` 를 더하고 아래 블록을 추가한다
      ```ts
      describe("이식 축 (save · perf)", () => {
        const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
        const route = (s: string) => ext.routes.find((r: any) => r.skill === `nereus-game:${s}`);
        it("두 스킬이 자기 검사기를 가리킨다", () => {
          expect(fs.readFileSync(`${ROOT}/skills/save/SKILL.md`, "utf8")).toContain("save-check.mjs");
          expect(fs.readFileSync(`${ROOT}/skills/perf/SKILL.md`, "utf8")).toContain("frame-budget.mjs");
        });
        it("save 라우트가 세이브 요청을 잡는다", () => {
          const re = new RegExp(route("save").re, "i");
          expect(re.test("세이브 마이그레이션 짜줘")).toBe(true);
          expect(re.test("자동 저장 슬롯")).toBe(true);
        });
        it("perf 라우트는 renderbudget 의 프레임 드랍·드로우 콜을 뺏지 않는다", () => {
          const re = new RegExp(route("perf").re, "i");
          expect(re.test("프레임 예산 넘는지 봐줘")).toBe(true);
          expect(re.test("게임이 끊김")).toBe(true);
          expect(re.test("프레임 드랍")).toBe(false);
          expect(re.test("드로우 콜 줄여줘")).toBe(false);
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: FAIL (스킬·라우트 없음)
    - [ ] 최소 구현: 두 SKILL.md(엔진 토큰 없음, 원본 출처 한 줄, 검사기 호출법·판정표·하지 말 것)와 라우트 2개 추가. save `re`: `세이브|save\s?(system|file|slot|data)|저장\s?(슬롯|파일)|자동\s?저장|autosave|진행도\s?(저장|소실|날아)`. perf `re`: `성능\s?(최적화|측정|예산|문제)|프레임\s?(예산|타임)|frame\s?(budget|time)|끊김|스터터|stutter|히치|hitch|gc\s?(스파이크|할당)|오브젝트\s?풀|object\s?pool|발열`.
    - [ ] 통과 확인: Run `npx vitest run tests/smoke` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-game/skills/save plugins/nereus-game/skills/perf plugins/nereus-game/nereus-extension.json tests/smoke/game-domain.test.ts && git commit -m "feat(game): save · perf 축"`
  - Done when: smoke 전부 통과, 두 스킬 본문에 엔진 토큰 없음

- [x] T7. balance · level 스킬에 새 검사기 연결
  - Files: Modify `plugins/nereus-game/skills/balance/SKILL.md` · Modify `plugins/nereus-game/skills/level/SKILL.md` · Test `tests/smoke/game-domain.test.ts`
  - Interfaces: Consumes `checkPacing`, `checkBoard` · Produces 없음
  - Steps:
    - [ ] 실패 테스트 작성: `tests/smoke/game-domain.test.ts` 에 추가
      ```ts
      describe("이식 검사기 배선", () => {
        it("balance 가 페이싱 검사기를, level 이 퍼즐 판 검사기를 가리킨다", () => {
          expect(fs.readFileSync(`${ROOT}/skills/balance/SKILL.md`, "utf8")).toContain("economy-curve.mjs");
          expect(fs.readFileSync(`${ROOT}/skills/level/SKILL.md`, "utf8")).toContain("puzzle-board.mjs");
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: FAIL
    - [ ] 최소 구현: balance 끝에 "증분·방치형 페이싱" 절(파일 끝 — 진행 중인 수명 축 절과 hunk 가 겹치지 않게), level §5 뒤에 "퍼즐 판" 절.
    - [ ] 통과 확인: Run `npx vitest run tests/smoke/game-domain.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-game/skills/balance/SKILL.md plugins/nereus-game/skills/level/SKILL.md tests/smoke/game-domain.test.ts && git commit -m "docs(game): 페이싱·퍼즐 판 검사기 연결"`
  - Done when: smoke 통과, 엔진 토큰 검사 통과

- [x] T8. roblox 참고 자료 3장 + Luau 경제 템플릿
  - Files: Create `plugins/nereus-game/skills/roblox/references/datastores.md` · Create `plugins/nereus-game/skills/roblox/references/remote-validation.md` · Create `plugins/nereus-game/skills/roblox/references/simulator-economy.md` · Create `plugins/nereus-game/skills/roblox/templates/economy_math.luau` · Create `plugins/nereus-game/skills/roblox/templates/test_economy_math.luau` · Modify `plugins/nereus-game/skills/roblox/SKILL.md` · Test `tests/smoke/roblox-references.test.ts`
  - Interfaces: Consumes 없음 · Produces 없음 (문서·템플릿)
  - Steps:
    - [ ] 실패 테스트 작성: `tests/smoke/roblox-references.test.ts`
      ```ts
      import { describe, it, expect } from "vitest";
      import fs from "node:fs";
      import { execFileSync, spawnSync } from "node:child_process";

      const DIR = "plugins/nereus-game/skills/roblox";
      const REFS = ["datastores.md", "remote-validation.md", "simulator-economy.md"];
      const hasLune = spawnSync("lune", ["--version"]).status === 0;

      describe("roblox 참고 자료", () => {
        it("SKILL.md 가 세 장을 전부 가리키고 실재한다", () => {
          const skill = fs.readFileSync(`${DIR}/SKILL.md`, "utf8");
          for (const r of REFS) {
            expect(skill, r).toContain(`references/${r}`);
            expect(fs.existsSync(`${DIR}/references/${r}`), r).toBe(true);
          }
        });
        it("옮긴 파일마다 출처와 라이선스를 적는다", () => {
          const files = [...REFS.map((r) => `${DIR}/references/${r}`), `${DIR}/templates/economy_math.luau`, `${DIR}/templates/test_economy_math.luau`];
          for (const f of files) {
            const t = fs.readFileSync(f, "utf8");
            expect(t, f).toContain("awesome-gamedev-agent-skills");
            expect(t, f).toContain("Apache-2.0");
          }
        });
        it("라우트를 늘리지 않는다 — 흡수는 references 로만", () => {
          const ext = JSON.parse(fs.readFileSync("plugins/nereus-game/nereus-extension.json", "utf8"));
          expect(ext.routes.filter((r: any) => /roblox/.test(r.skill))).toHaveLength(1);
        });
        it.skipIf(!hasLune)("Luau 경제 수식 테스트가 lune 으로 통과한다", () => {
          execFileSync("lune", ["run", "test_economy_math.luau"], { cwd: `${DIR}/templates`, stdio: "pipe" });
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/smoke/roblox-references.test.ts` · Expected: FAIL (파일 없음)
    - [ ] 최소 구현: 참고 자료는 판단 지식만(세션 잠금·UpdateAsync 콜백 규칙·재시도 멱등성·RTBF / 전송 선택·검증 순서·yield 경합·남용 매트릭스 / 서버 소유 구매·환생·서버 시계 오프라인·유료 확률 아이템은 `compliance` 로). 템플릿 두 파일은 원본 그대로에 출처 헤더만 붙인다. SKILL.md 에 §6 참고 자료 표, §3 리뷰 항목에서 링크.
    - [ ] 통과 확인: Run `npx vitest run tests/smoke/roblox-references.test.ts tests/smoke/roblox-rig.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus-game/skills/roblox tests/smoke/roblox-references.test.ts && git commit -m "docs(roblox): DataStore·Remote·경제 판단 자료 + Luau 템플릿"`
  - Done when: 4개 통과(lune 있으면 Luau 테스트 포함)

- [x] T9. NOTICE · 라이선스 동봉 · README · 버전
  - Files: Modify `plugins/nereus-game/NOTICE` · Create `plugins/nereus-game/LICENSES/Apache-2.0.txt` · Modify `tests/lib/game-packaging.test.ts`
  - Interfaces: Consumes 없음 · Produces 없음
  - Steps:
    - [ ] 실패 테스트 작성: `tests/lib/game-packaging.test.ts` 에 추가
      ```ts
      it("awesome-gamedev-agent-skills 귀속과 Apache 전문을 동봉한다", () => {
        const notice = fs.readFileSync("plugins/nereus-game/NOTICE", "utf8");
        expect(notice).toContain("awesome-gamedev-agent-skills");
        expect(notice).toContain("Apache License, Version 2.0");
        expect(notice).toContain("All skills in this repository are original works");
        expect(fs.readFileSync("plugins/nereus-game/LICENSES/Apache-2.0.txt", "utf8")).toContain("TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION");
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/game-packaging.test.ts` · Expected: FAIL
    - [ ] 최소 구현: NOTICE 에 출처·커밋·원본 NOTICE 문구·옮긴 파일 목록·수정 사실. 원본 LICENSE 를 그대로 복사. README 의 스킬·검사기 목록에 새 항목, plugin.json·marketplace.json 버전 0.6.0.
    - [ ] 통과 확인: Run `node plugins/nereus/skills/build/scripts/run-tests.mjs` · Expected: PASS (진행 중인 balance-lives 테스트 제외 실패 0)
    - [ ] 커밋: `git add plugins/nereus-game/NOTICE plugins/nereus-game/LICENSES plugins/nereus-game/README.md plugins/nereus-game/.claude-plugin/plugin.json .claude-plugin/marketplace.json tests/lib/game-packaging.test.ts && git commit -m "chore: nereus-game 0.6.0 — gamedev 스킬 이식"`
  - Done when: 전체 테스트 통과, NOTICE 검사 통과

## Global Constraints

- 스택: Node ESM (`.mjs`) + vitest. 새 런타임 의존성 금지.
- 검사기는 순수 함수 + `runCli` 진입점(stdin JSON → stdout JSON). 성공 경로에서 `process.exit(0)` 금지.
- 도메인 스킬 본문(balance·level·save·perf)에 `game.Players` · `:GetService` · `MonoBehaviour` · `UnityEngine` 금지.
- **건드리지 않는다**: `lib/balance-sim.mjs` · `profiles/casual-puzzle.json` · `tests/lib/balance-sim-lives.test.ts` · `openspec/changes/2026-09-15-add-balance-lives-axis/`. 커밋에 섞지 않는다.
- unity-\* 는 이식하지 않는다(공식 플러그인 위임 원칙).
- 옮긴 파일에는 출처(`awesome-gamedev-agent-skills`, Apache-2.0)와 수정 사실을 적는다.
- 난수 금지 — 모든 검사기는 결정론적이다.
