# tasks — add-unity-agent-plugin

판정 코드 하나와 문서 경계만 넣는다. **엔진 절차를 베껴 적지 않는다** — 그것이 위임하는 이유다.

- [x] T1. detectUnityAgentPlugin 이 네 상태를 구분한다
  - Files: Modify `plugins/nereus-game/lib/unity-stack.mjs` · Modify `tests/lib/unity-stack.test.ts`
  - Steps:
    - [x] 실패 테스트를 덧붙인다: ready · disabled · absent · unknown · scope-user 다섯 갈래
    - [x] 실패 확인: Run `npx vitest run tests/lib/unity-stack.test.ts` · Expected: FAIL
    - [x] `detectUnityAgentPlugin({ pluginsFile, settingsFile, readJson })` 를 더한다.
          기존 `detectUnityRunner` 의 시그니처와 반환은 **바꾸지 않는다**.
          코어 `plugin-inventory.mjs` 를 import 하지 않는다 — 확장이 코어 내부에 붙으면
          코어가 바뀔 때 확장이 조용히 깨진다. 인벤토리 두 파일만 직접 읽는다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/unity-stack.test.ts` · Expected: PASS
  - Done when: 다섯 갈래가 전부 초록이고 기존 세 테스트도 초록이다

- [x] T2. unity 스킬에 위임 경계를 적는다
  - Files: Modify `plugins/nereus-game/skills/unity/SKILL.md`
  - Steps:
    - [x] 판정 명령, 위임 표(우리 도메인 → Unity 스킬), 위임하지 않는 것(게이트 전부),
          스코프 권고, Unity 문서가 밝힌 한계를 적는다
    - [x] 스모크 테스트로 문서에 경계가 있는지 확인한다
  - Done when: `npx vitest run tests/smoke/game-domain.test.ts` 가 초록이다

- [x] T3. compliance 스킬에 배선 위임 한 줄
  - Files: Modify `plugins/nereus-game/skills/compliance/SKILL.md`
  - Steps:
    - [x] 판정 통과 후 IAP·LevelPlay SDK 배선은 Unity 스킬로 넘긴다고 적는다.
          **판정 자체는 넘기지 않는다** — 규정은 엔진이 아니라 플랫폼과 법령이 정한다
  - Done when: 한 줄이 들어가고 기존 "엔진과 무관하다" 선언과 모순되지 않는다

- [x] T4. 전체 테스트 + 커밋
  - Steps:
    - [x] Run `node plugins/nereus/skills/build/scripts/run-tests.mjs` · Expected: PASS
    - [x] 커밋한다. 문서를 테스트 뒤에 쓰지 않는다 — evidence 가 STALE 이 된다
  - Done when: 전체 초록이고 evidence FRESH 다

## 2차 — 설치·업데이트 경로

판정만으로는 반쪽이다. 설치돼 있지 않을 때 **어떻게 깔지**, 깔려 있을 때 **어떻게 올릴지**가 없었다.

- [x] T5. 확장 계약에 companions 를 더한다
  - Files: Modify `plugins/nereus/hooks/scripts/lib/extensions.mjs` · Modify `tests/lib/extensions.test.ts`
  - Steps:
    - [x] 실패 테스트: 수집 · 유도 불가 선언 버리기 · 미선언 확장도 안 깨짐
    - [x] `toCompanion` 을 더한다. 명령 문자열은 받지 않는다 — id·marketplace·scope 에서 유도한다
    - [x] 기존 반환 형태 비교 테스트를 `companions: []` 포함으로 갱신한다
  - Done when: `npx vitest run tests/lib/extensions.test.ts` 초록

- [x] T6. setup 이 상태에 맞는 명령을 낸다
  - Files: Add `plugins/nereus/skills/setup/scripts/companions.mjs` · Add `tests/lib/companions.test.ts` · Modify `plugins/nereus/skills/setup/SKILL.md`
  - Steps:
    - [x] 실패 테스트 6갈래: 미설치 · 설치됨(업데이트) · 비활성(enable) · 무관 · when 없음 · 스택 선언 없음
    - [x] `companionRows` · `renderCompanions` 를 만든다. 코어는 Unity 를 모른다
    - [x] setup SKILL 3장에 실행 절차를 적는다
  - Done when: `npx vitest run tests/lib/companions.test.ts` 초록

- [x] T7. 게임 확장이 Unity 플러그인을 선언한다
  - Files: Modify `plugins/nereus-game/nereus-extension.json` · Modify `plugins/nereus-game/skills/unity/SKILL.md`
  - Steps:
    - [x] `companions` 에 `unity@unity-agent-plugin` 을 `when.stack: "unity"`, `scope: "project"` 로 선언
    - [x] unity 스킬의 `absent`·`disabled` 분기에서 setup 표를 가리킨다. **명령을 두 번 적지 않는다**
    - [x] Unity 버전을 올리면 플러그인도 올린다고 적는다 — 갱신을 못 받으면 위임할 이유가 사라진다
  - Done when: 확장 선언 → setup 표 → 명령까지 실제로 이어지는 것을 확인한다
