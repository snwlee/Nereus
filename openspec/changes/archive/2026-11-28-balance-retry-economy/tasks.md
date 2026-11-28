# tasks — balance-retry-economy

기준선(2026-11-28, macOS): `npx vitest run` 전체 1770 통과, 실패 0. 모든 태스크의 완료 조건에 "기준선에 없던 실패 0" 이 포함된다.
기존 `balanceSim.run`·`balanceSim.dominant` 요구와 `tests/lib/balance-sim*.test.ts` 가 현재 동작을 고정한다. 이 변경은 새 키만 추가한다.
규범은 스펙 델타 `specs/game-harness/spec.md` 이고, proposal.md "Interface" 는 그 풀이다. 테스트 조각의 `profile` 은 `loadProfile("casual-puzzle")`(`plugins/nereus-game/lib/profiles.mjs`) 이다.

## 구현 결정 (태스크 공통)

- 비교는 반올림 전 원값으로 한다. 반올림(소수 넷째 자리)은 출력 필드와 위반의 `value` 에만 한다. `borderline` 도 원값으로 계산한다.
- `violations` 순서: `no-baseline`(있으면) 먼저, 그다음 레벨 순서대로, 레벨 안에서는 `retry-cliff`·`retry-too-easy`·`lives-wall`·`continue-weak` 순.
- `unmeasured` 순서: `"levels"`(빈 배열일 때)·`"lives"`·`"continue"`. 빈 `levels` 여도 `lives`·`continueOffer` 가 없으면 그 축도 싣는다.
- `lives`·`continueOffer` 가 `undefined`·`null` 이면 없음, 객체가 아니면 오류.
- `no-baseline` 일 때 레벨 `tier` 는 기본 `earlyLevels` 10 으로 같은 규칙대로 계산해 낸다.
- 오류 메시지 문구와 검증 순서는 자유다. 사유(어느 레벨·어느 키)가 메시지에 들어가면 된다.
- CLI 는 `economy-curve.mjs` 와 같은 main 가드(`if (process.argv[1] && import.meta.url === new URL(\`file://${process.argv[1]}\`).href)`)와 `plugins/nereus-game/lib/cli-input.mjs` 의 `runCli`·`readCliInput` 을 쓴다. CLI 테스트는 `spawnSync(process.execPath, [cliPath], { input: JSON.stringify(x) })` 로 돌리고 `status`·`stdout`·`stderr` 를 본다.
- 불변성: `simulate()` 는 summary 를 고치지 않고 `{ ...summary, retry }` 새 객체를 만든다.

## 테스트 픽스처 (진척 `[0, 2]`, 합의 평균 = moves, 표준편차 = √(moves/3) 의 정규 근사로 고른 값)

| 시나리오 | 레벨 입력 | 기대 p (근사) | 단언 |
|---|---|---|---|
| 이동 수가 클리어율을 움직인다 | moves 18 / 22, goal 20 | 0.21 / 0.77 | 차이 ≥ 0.4 |
| 범위 안 하드 레벨(cap 5) | moves 20, goal 21.7, tier hard | 0.25 | p ∈ [0.2, 0.3], `lives-wall` 없음 |
| 목숨 3개 중반 벽 | moves 20, goal 20.3, `earlyLevels` 뒤 위치 | 0.45 | p ∈ [0.4, 0.5], `lives-wall` 있음 |
| 경계 레벨 표시 | moves 20, goal 20.65 (mid) / goal 20 (mid) | 0.40 / 0.50 | 앞 `borderline: true`, 뒤 `false` |
| 실패가 적으면 이어하기를 재지 않는다 | moves 20, goal 14, continueOffer `{moves:5, price:900}` | 0.99 (실패 ≈ 20) | `continueSaveRate: null` |
| 약한 이어하기 | moves 20, goal 23, continueOffer `{moves:1, price:900}` | p 0.12, q ≈ 0.12 | `continue-weak` 있음 |
| 하드 레벨 상한 초과 | moves 20, goal 18, tier hard | 0.87 | `retry-too-easy` 있음 |
| 중반 하한 미만 | moves 20, goal 23, 위치 `earlyLevels` 뒤 | 0.12 | `retry-cliff` 있음 |
| 초반 기본 티어 | 첫 레벨 moves 20, goal 21 | 0.35 | 초반 `retry-cliff` 있음 |
| 결정적 레벨과 범위 경계 | moves 10, goal 3, progress [0.3, 0.3] | 1 | `retry-too-easy` 없음, `borderline: false` |

"중반 위치" 레벨은 앞에 `earlyLevels`(10) 개의 쉬운 채움 레벨(moves 20, goal 10)을 두거나, 테스트용 프로파일 복사본의 `retry.earlyLevels` 를 0 으로 둔다.
기준 없는 프로파일은 `{ ...loadProfile("sim-tycoon") }`(`retry` 없음)를 쓴다.

- [x] T1. 시드 난수 모듈 분리
  - Files: Create `plugins/nereus-game/lib/seeded-random.mjs` · Modify `plugins/nereus-game/lib/balance-sim.mjs` (lcg 정의를 import 로) · Test `tests/lib/seeded-random.test.ts`
  - Interfaces: Produces `lcg(seed): () => number`(balance-sim 의 것을 코드 변경 없이 옮겨 export) · `mixSeed(seed: number, key: string): number`
  - `mixSeed` 정의: key 를 UTF-8 바이트로 인코딩(`TextEncoder`), FNV-1a 32비트(offset `0x811c9dc5`, prime `0x01000193`, `Math.imul`), 결과와 `seed >>> 0` 을 XOR, fmix32(`h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16`), `>>> 0`, 0 이면 `0x9e3779b9`
  - Steps:
    - [x] 실패 테스트 작성(기대값은 별도 Python 참조 구현으로 미리 계산한 값):
      ```ts
      import { lcg, mixSeed } from "../../plugins/nereus-game/lib/seeded-random.mjs";
      it("한글 키의 시드는 고정값이다", () => {
        expect(mixSeed(1, "레벨1")).toBe(1789633814);
        expect(mixSeed(1, "L1")).toBe(2309713719);
        expect(mixSeed(7, "continue")).toBe(1451885671);
      });
      it("lcg 수열은 옮기기 전과 같다", () => {
        const r = lcg(1);
        expect([r(), r(), r()]).toEqual([0.23645552527159452, 0.3692706737201661, 0.5042420323006809]);
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/seeded-random.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 최소 구현: 위 정의대로
    - [x] 통과 확인: Run `npx vitest run tests/lib/seeded-random.test.ts tests/lib/balance-sim.test.ts tests/lib/balance-sim-lives.test.ts` · Expected: PASS
  - Done when: 세 파일 통과(기존 simulate 결과 불변), 기준선에 없던 실패 0

- [x] T2. 재시도 경제 측정·판정
  - Files: Create `plugins/nereus-game/lib/retry-economy.mjs` · Modify `plugins/nereus-game/profiles/casual-puzzle.json` (`retry` 블록 — proposal "프로파일 기본값" 그대로) · Test `tests/lib/retry-economy.test.ts`
  - Interfaces: Consumes `lib/seeded-random.mjs: lcg, mixSeed` · (CLI 만) `lib/profiles.mjs: loadProfile`, `lib/cli-input.mjs: readCliInput, runCli` · Produces `measureRetry({ profile, levels, lives?, continueOffer?, seed? }) → { levels, violations, unmeasured }` · CLI stdin `{ genre, retry?, levels, lives?, continueOffer?, seed? }` — `retry` 가 있으면 `{ ...loadProfile(genre), retry }` 로 통째로 대신한다(같은 검증)
  - Steps:
    - [x] 실패 테스트 작성: 스펙 `balanceSim.retry` 시나리오 26개 중 "한글 키의 시드는 고정값이다"(T1 소관)를 뺀 25개를 같은 이름의 `it` 로, 위 픽스처 표대로. 대표:
      ```ts
      it("이동 수가 클리어율을 움직인다", () => {
        const levels = [
          { name: "짧음", moves: 18, goal: 20, progress: [0, 2] },
          { name: "김", moves: 22, goal: 20, progress: [0, 2] },
        ];
        const r = measureRetry({ profile, levels, seed: 1 });
        expect(r.levels[1].firstTryWinRate - r.levels[0].firstTryWinRate).toBeGreaterThanOrEqual(0.4);
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/retry-economy.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 최소 구현: 스펙의 판 모델(기본·이어하기 난수열 분리, 판마다 정확히 `moves` 개 추출, `goal − 1e-9`)·지표 7종·위반 5종·`unmeasured`·입력 검증(프로파일 `retry` 필수 키·상한·총 추출 수, seed 는 `(Number(seed) || 1) >>> 0`)·CLI
    - [x] 통과 확인: Run `npx vitest run tests/lib/retry-economy.test.ts` · Expected: PASS
  - Done when: 25개 시나리오 통과, 기준선에 없던 실패 0

- [x] T3. 1회 한정 첫 구매 상품 판정
  - Files: Create `plugins/nereus-game/lib/starter-offer.mjs` · Test `tests/lib/starter-offer.test.ts`
  - Interfaces: Consumes `lib/cli-input.mjs: readCliInput, runCli` · Produces `checkStarterOffer({ shop }) → { violations, metrics: { starterSku, valueRatio } }` · CLI stdin `{ shop }`
  - Steps:
    - [x] 실패 테스트 작성(스펙 `balanceSim.starterOffer` 시나리오 12개). 대표:
      ```ts
      it("더 비싼 상품으로 교체", () => {
        const shop = { products: [
          { sku: "starter", price: 0.99, value: 500, oneTime: true, starter: true, replacedBy: "starter2" },
          { sku: "starter2", price: 6.99, value: 500 },
        ] };
        expect(checkStarterOffer({ shop }).violations.map((v) => v.code)).toContain("starter-replaced-pricier");
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/starter-offer.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 최소 구현: 위반 5종(교체 사슬 추적, 같은 `currency` 끼리만 가격 비교), `valueRatio`(짝수 개 중앙값은 가운데 둘의 평균 — balance-sim 의 지배 전략 중앙값과 달리 상품 수가 적어 위쪽 값 하나로 치우치지 않게 한다), 입력 검증(sku 중복·price·없는 replacedBy·순환), CLI
    - [x] 통과 확인: Run `npx vitest run tests/lib/starter-offer.test.ts` · Expected: PASS
  - Done when: 12개 시나리오 통과, 기준선에 없던 실패 0

- [x] T4. 시뮬레이터 배선(재시도만 — 스타터 판정은 배선하지 않음, MODIFIED `balanceSim.run`)
  - Files: Modify `plugins/nereus-game/lib/balance-sim.mjs` (`simulate` 의 반환 직전) · Test `tests/lib/balance-sim-retry.test.ts`
  - Interfaces: Consumes `lib/retry-economy.mjs: measureRetry` · Produces `summary.retry?`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { simulate } from "../../plugins/nereus-game/lib/balance-sim.mjs";
      import { measureRetry } from "../../plugins/nereus-game/lib/retry-economy.mjs";
      import { loadProfile } from "../../plugins/nereus-game/lib/profiles.mjs";
      const profile = loadProfile("casual-puzzle");
      const base = { income: { base: 10, growth: 1 }, stages: [{ name: "a", cost: 5 }] };
      const levels = [{ name: "L1", moves: 20, goal: 15, progress: [0, 2] }];
      it("재시도 측정 배선", () => {
        const r = simulate({ profile, economy: { ...base, levels }, turns: 5, seed: 3 });
        expect(r.summary.retry).toEqual(measureRetry({ profile, levels, seed: 3 }));
        const { retry, ...rest } = r.summary;
        expect(rest).toEqual(simulate({ profile, economy: base, turns: 5, seed: 3 }).summary);
        expect(simulate({ profile, economy: { ...base, levels: [] }, turns: 5 }).summary.retry.unmeasured).toContain("levels");
      });
      it("레벨 없는 경제", () => {
        expect(simulate({ profile, economy: base, turns: 5 }).summary).not.toHaveProperty("retry");
        expect(simulate({ profile, economy: { ...base, levels: undefined }, turns: 5 }).summary).not.toHaveProperty("retry");
      });
      it("잘못된 레벨은 시뮬레이터에서도 오류", () => {
        expect(() => simulate({ profile, economy: { ...base, levels: [{ ...levels[0], moves: 0 }] }, turns: 5 })).toThrow(/moves/);
        expect(() => simulate({ profile, economy: { ...base, levels: null }, turns: 5 })).toThrow();
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/balance-sim-retry.test.ts` · Expected: FAIL
    - [x] 최소 구현: `simulate` 에서 `economy?.levels !== undefined` 이면 `measureRetry({ profile, levels: economy.levels, lives: economy.lives, continueOffer: economy.continueOffer, seed })` 를 불러 `{ ...summary, retry }` 를 돌려준다. 배열이 아닌 값은 `measureRetry` 의 오류가 그대로 던져진다
    - [x] 통과 확인: Run `npx vitest run tests/lib` · Expected: PASS
  - Done when: 새 시나리오 3개 통과, 기존 balance-sim 테스트 통과, 기준선에 없던 실패 0

- [x] T5. 문서·샘플·버전
  - Files: Modify `plugins/nereus-game/skills/balance/SKILL.md` (frontmatter 불변) · Modify `plugins/nereus-game/profiles/casual-puzzle.json` (`balance.note` 의 "아직 측정되지 않는다" 문장을 "재시도 경제는 `retry` 블록과 retry-economy 로 잰다 — 범위·상한은 잠정값" 으로 교체) · Create `plugins/nereus-game/skills/balance/assets/puzzle-levels.sample.json` · Modify `plugins/nereus-game/README.md`, `plugins/nereus-game/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `tests/lib/profiles-casual-puzzle.test.ts`
  - Interfaces: 없음(문서·데이터)
  - 샘플 파일: `{ "genre": "casual-puzzle", "seed": 1, "lives": { "cap": 5 }, "continueOffer": { "moves": 5, "price": 900 }, "levels": [아래 14개] }`. 레벨 14개 — 초반 10개(moves 20, goal 13~17 로 점점 어렵게), 그 뒤 `mid` 2개(goal 20·20.5), `tier: "hard"` 1개(goal 21.7), 표시 없는 벽 레벨 1개(goal 23 — `retry-cliff` 가 나는 예시). `measureRetry` 는 `genre` 키를 무시한다
  - SKILL.md 체크리스트("시뮬레이터가 아직 재지 않는 것" 절을 교체하고, 그 이름의 절에는 회복 시간 축만 남긴다):
    - 재시도 경제 절: CLI 사용 예(샘플 파일), 지표 표, 위반 표(`retry-cliff`·`retry-too-easy`·`lives-wall`·`continue-weak`·`no-baseline`), 티어별 목표 범위 표(잠정값), 게임별 `retry` 덮어쓰기
    - 비통과 세 경우: `no-baseline`, 비어 있지 않은 `unmeasured`, `null` 지표는 통과로 읽지 않는다
    - 읽는 방향: 실력 차가 있으면 `livesOutRate` 는 하한·`cumulativeWinRate` 는 상한, `livesOutRate` 는 레벨 단위(세션 벽의 하한)
    - 보정: `progress` 는 플레이테스트·텔레메트리 클리어율로 보정하고 출처를 적는다, 실력 차가 크면 약한 층 기준
    - 적용 범위: 무작위 리필 매치-3 류에 맞고 고정 판 퍼즐에는 맞지 않는다
    - 목숨 단위: 재시도 판정은 목숨 1 = 실패한 시도 1, `simulate()` 턴 루프는 목숨 1 = 시도한 턴 1
    - 게이트: 레벨이 많으면 레벨마다 `tier` 를 적는다(하드 레벨이 `mid` 기준 절벽으로 잡힌다), 게이트의 시드는 완료 조건에 고정해 적는다
    - 스타터 절: 위반 5종, `currency`, `valueRatio`, 정적 검사라 데이터에 없는 런타임 교체는 잡지 못한다(런타임 가격은 compliance)
  - README: "밸런싱 시뮬레이터" 단락에 `summary.retry` 한 줄, 검사기 표에 `retry-economy.mjs`·`starter-offer.mjs` 두 행
  - 버전: `plugin.json` 과 `marketplace.json` 의 nereus-game 버전을 같은 값으로 패치 1 올린다(`tests/smoke/extension-wiring.test.ts` 가 둘을 비교). PR 을 열 때 main 최신의 nereus-game 버전 + 1 로 맞춘다
  - Steps:
    - [x] 실패 테스트 작성: `tests/lib/profiles-casual-puzzle.test.ts` 에 `import { measureRetry } from "../../plugins/nereus-game/lib/retry-economy.mjs";` 를 더하고
      ```ts
      it("SKILL.md 가 재시도·스타터 판정과 비통과 규칙을 적는다", () => {
        const md = fs.readFileSync("plugins/nereus-game/skills/balance/SKILL.md", "utf8");
        for (const c of ["retry-cliff", "retry-too-easy", "lives-wall", "continue-weak", "no-baseline", "unmeasured",
          "starter-missing", "starter-duplicate", "starter-not-one-time", "starter-not-cheapest", "starter-replaced-pricier",
          "회복 시간", "잠정"]) expect(md).toContain(c);
      });
      it("샘플 레벨 파일이 measureRetry 로 돈다", () => {
        const sample = JSON.parse(fs.readFileSync("plugins/nereus-game/skills/balance/assets/puzzle-levels.sample.json", "utf8"));
        const r = measureRetry({ profile: loadProfile("casual-puzzle"), ...sample });
        expect(r.levels.length).toBe(sample.levels.length);
        expect(r.violations.map((v) => v.code)).toContain("retry-cliff");
      });
      ```
      기존 "수명 게이트가 아직 축이 아니라는 사실이 적혀 있다" 테스트는 이름을 "수명(목숨) 판정이 문서에 적혀 있다" 로 바꾼다(단언은 그대로)
    - [x] 실패 확인: Run `npx vitest run tests/lib/profiles-casual-puzzle.test.ts` · Expected: FAIL
    - [x] 최소 구현: 위 체크리스트·README·샘플·note·버전
    - [x] 통과 확인: Run `npx vitest run` · Expected: 기준선에 없던 실패 0
  - Done when: 기준선에 없던 실패 0, `node plugins/nereus-game/lib/retry-economy.mjs < plugins/nereus-game/skills/balance/assets/puzzle-levels.sample.json` 가 레벨별 지표 JSON 을 내고 종료 코드 0

## Global Constraints

- 플러그인 런타임은 Node 표준 라이브러리만. `Math.random` 금지, 시드 기반만.
- 규칙 워커(PR #5)가 고친 스킬(craft·level·gameux·liveops·compliance·adpolicy)의 파일은 수정하지 않는다. README·버전 파일은 스킬 파일이 아니다. balance 스킬 frontmatter description 불변.
- 근거 노트의 원 출처(미확인 영상)에 나온 특정 게임 이름·주장을 스킬·코드에 넣지 않는다. 판정 규칙과 기본 수치만.
- 기존 `simulate()` summary 키·값 불변(새 키는 `levels` 를 줄 때만).
