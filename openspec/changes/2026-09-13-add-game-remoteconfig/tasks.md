# tasks — add-game-remoteconfig

- [x] T1. 분류 체계 데이터 + 로더
  - Files: Create `plugins/nereus-game/remote-config.json` · Create `tests/lib/remote-config-check.test.ts`
  - Steps:
    - [x] 실패 테스트: 분류 2개 이상, 각각 `bundleSafe` 와 `why`(20자 초과), `why` 없으면 던진다
    - [x] 실패 확인: Run `npx vitest run tests/lib/remote-config-check.test.ts` · Expected: FAIL
    - [x] ToonTone `ad_remote_config.dart` 의 5분류를 일반화해 쓴다
    - [x] 통과 확인: Expected PASS
  - Done when: 5분류가 데이터로 있고 이유가 전부 붙어 있다

- [x] T2. 검사기 — 합집합·배타·번들 안전·이름 규칙
  - Files: Create `plugins/nereus-game/lib/remote-config-check.mjs` · Modify `tests/lib/remote-config-check.test.ts`
  - Steps:
    - [x] 실패 테스트: 스펙의 시나리오 전부. `unclassified`·`phantom` 을 **다른 코드**로 고정한다
    - [x] 실패 확인: Expected FAIL
    - [x] 구현한다. `bundle-unsafe` 는 `severity: "incident"`, 나머지는 `"trust"`
    - [x] 통과 확인: Expected PASS
  - Done when: 네 검사가 각각 자기 코드로 나온다

- [x] T3. ToonTone 의 실제 분류로 돌린다
  - Files: none (측정만 한다)
  - Steps:
    - [x] ToonTone `ad_remote_config.dart` 에서 5집합과 번들 기본값을 뽑아 검사기에 넣는다
    - [x] 계약 테스트가 초록이므로 **위반 0 이 나와야 한다**
    - [x] 하위 계층 키를 번들에 주입해 `bundle-unsafe` 가 잡히는지 본다
    - [x] 수치를 design.md 에 적는다
  - Done when: 위반 0 이고, 사고를 재현하면 잡힌다

- [x] T4. liveops 스킬 확장 + 배선
  - Files: Modify `plugins/nereus-game/skills/liveops/SKILL.md` · Modify `nereus-extension.json` · Modify `tests/smoke/craft-rig.test.ts` · Modify `tests/smoke/game-domain-liveops.test.ts`
  - Steps:
    - [x] 실패 테스트 먼저: liveops 스킬이 `remote-config-check.mjs` 를 가리킨다, 프로세스 진입점
    - [x] 실패 확인: Expected FAIL
    - [x] 스킬에 5분류·번들 함정·값 해석 규율(0 은 무제한이 아니다)을 적고 라우트 정규식을 넓힌다
    - [x] 통과 확인: Expected PASS
    - [x] 역검증: 스킬 참조를 지우면 FAIL 하는지 확인하고 되돌린다
  - Done when: 가드가 물고 역검증이 통과한다

- [x] T5. README + 전체 테스트 + 커밋
  - Done when: 전체 초록이고 evidence FRESH 다
