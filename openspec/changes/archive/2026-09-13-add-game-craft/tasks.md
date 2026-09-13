# tasks — add-game-craft

제작 층을 채운다. ToonTone 에서 채굴하고, 매 검사기마다 ToonTone 에 실제로 돌려 검증한다.

- [x] T1. 계층 경계 데이터를 만든다
  - Files: Create `plugins/nereus-game/layers.json` · Create `tests/lib/purity-check.test.ts`
  - Steps:
    - [x] 실패 테스트: `layers.json` 에 flutter · roblox · unity 가 있고, 각 계층 선언에
          `layer` · `forbid` · `why` 가 있으며 `why` 가 비어 있지 않다.
          알 수 없는 엔진은 던진다.
    - [x] 실패 확인: Run `npx vitest run tests/lib/purity-check.test.ts` · Expected: FAIL
    - [x] `layers.json` 을 쓴다. flutter 경계는 ToonTone `test/architecture_test.dart` 에서 채굴한다.
          roblox 는 `game.` · `:GetService` · `script.Parent`, unity 는 `UnityEngine` · `MonoBehaviour`.
    - [x] 통과 확인: Run `npx vitest run tests/lib/purity-check.test.ts` · Expected: PASS
  - Done when: 엔진 3종의 경계가 데이터로 있고 이유가 전부 붙어 있다

- [x] T2. purity-check 검사기
  - Files: Create `plugins/nereus-game/lib/purity-check.mjs` · Modify `tests/lib/purity-check.test.ts`
  - Steps:
    - [x] 실패 테스트. 스펙의 다섯 시나리오를 덮는다. Luau 시나리오로 엔진 불가지론을 고정한다.
    - [x] 실패 확인: Run `npx vitest run tests/lib/purity-check.test.ts` · Expected: FAIL
    - [x] 구현한다. 계층 판정은 경로 접두사, 금지 판정은 줄 단위 문자열 포함.
          `why` 없는 선언은 던진다. 위반에 `why` 를 싣는다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/purity-check.test.ts` · Expected: PASS
  - Done when: 다섯 시나리오가 통과한다

- [x] T3. ToonTone 에 purity-check 를 실제로 돌린다
  - Files: none (측정만 한다)
  - Steps:
    - [x] `layers.json` 의 flutter 경계로 ToonTone `lib/**` 을 검사한다
    - [x] ToonTone `test/architecture_test.dart` 가 초록이므로 **위반 0 이 나와야 한다.**
          0 이 아니면 검사기가 틀린 것이다 — 실제 프로젝트가 진실이다
    - [x] 일부러 경계를 어긴 입력을 넣어 잡히는지도 본다(초록이 검사기 부작동이 아님을 확인)
    - [x] 수치를 design.md 에 측정값으로 적는다
  - Done when: 위반 0 이고, 위반을 주입하면 잡힌다

- [x] T4. parity-check 검사기
  - Files: Create `plugins/nereus-game/lib/parity-check.mjs` · Create `tests/lib/parity-check.test.ts`
  - Steps:
    - [x] 실패 테스트. 스펙의 여섯 시나리오(분기 · 식별자 사용 · 식별자 데이터 · switch ·
          해당 없음 · 해당 있음)를 덮는다
    - [x] 실패 확인: Run `npx vitest run tests/lib/parity-check.test.ts` · Expected: FAIL
    - [x] 구현한다. `flavors` 가 비면 `applicable: false` 와 이유. 식별자는 데이터로 받는다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/parity-check.test.ts` · Expected: PASS
  - Done when: 여섯 시나리오가 통과한다

- [x] T5. ToonTone 에 parity-check 를 실제로 돌린다
  - Files: none (측정만 한다)
  - Steps:
    - [x] ToonTone `lib/**` 과 실제 플레이버 목록으로 검사한다
    - [x] ToonTone 헌법 원칙 VI 가 분기를 금지하고 실제 분기가 0건이므로 **위반 0 이 나와야 한다**
    - [x] 위반을 주입해 잡히는지 확인한다
    - [x] 수치를 design.md 에 적는다
  - Done when: 위반 0 이고, 위반을 주입하면 잡힌다

- [x] T6. craft 스킬
  - Files: Create `plugins/nereus-game/skills/craft/SKILL.md`
  - Steps:
    - [x] 코어 루프 설계 · 계층 경계(왜 · 어떻게) · 수직 슬라이스 · 서버 권위를 담는다
    - [x] 엔진 고유 토큰을 쓰지 않는다. 엔진별 금지 문자열은 `layers.json` 을 가리킨다
    - [x] 두 검사기 사용법을 적는다
  - Done when: 스킬이 "어떻게 떼는가"에 실제로 답한다

- [x] T7. gameplay-engineer 에이전트
  - Files: Create `plugins/nereus-game/agents/gameplay-engineer.md`
  - Steps:
    - [x] 기존 에이전트 5종의 형식을 따른다
    - [x] `nereus:build` 와 겹치지 않게 한다 — 워크플로는 코어가 소유하고
          여기는 게임플레이 코드의 **판단**만 한다
  - Done when: 에이전트 파일이 있고 build 와 역할이 겹치지 않는다

- [x] T8. 배선 — 라우트 · 가드 · 리그
  - Files: Modify `plugins/nereus-game/nereus-extension.json` · Modify `tests/smoke/game-domain.test.ts` · Create `tests/smoke/craft-rig.test.ts`
  - Steps:
    - [x] 실패 테스트 먼저: `game-domain.test.ts` 에 craft 스킬 · gameplay-engineer 에이전트 ·
          craft 엔진 불가지론을 넣는다. `craft-rig.test.ts` 에 프로세스 진입점 3 시나리오를 넣는다
    - [x] 실패 확인: Run `npx vitest run tests/smoke/game-domain.test.ts tests/smoke/craft-rig.test.ts` · Expected: FAIL
    - [x] 라우트 2개를 `nereus-extension.json` 에 넣고, 두 lib 에 `runCli` 진입점을 붙인다.
          **`process.exit(0)` 을 부르지 않는다** — 파이프 stdout 이 64KiB 에서 잘린다
    - [x] 통과 확인: Run `npx vitest run tests/smoke/game-domain.test.ts tests/smoke/craft-rig.test.ts` · Expected: PASS
    - [x] 역검증: 라우트 하나를 지우면 FAIL 하는지 확인하고 되돌린다
  - Done when: 가드가 실제로 물고, 역검증이 통과한다

- [x] T9. README 갱신 + 전체 테스트 + 커밋
  - Files: Modify `plugins/nereus-game/README.md`
  - Steps:
    - [x] README 에 제작 층과 두 검사기를 넣는다
    - [x] Run `node plugins/nereus/skills/build/scripts/run-tests.mjs` · Expected: PASS
    - [x] 커밋한다. **문서를 테스트 뒤에 쓰지 않는다** — evidence 가 STALE 이 된다
  - Done when: 전체 초록이고 evidence FRESH 다
