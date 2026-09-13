# tasks — fix-game-real-project

실측으로 나온 결함만 고친다. 제작 층 채굴과 flutter 스택은 다음 사이클이다.

- [x] T1. countScope 가 spec-kit 형식을 세고, 못 세면 못 셌다고 낸다
  - Files: Modify `plugins/nereus-game/lib/track-advisor.mjs` · Modify `tests/lib/track-advisor.test.ts`
  - Steps:
    - [x] 실패 테스트를 `tests/lib/track-advisor.test.ts` 에 덧붙인다. 픽스처는 **ToonTone 의 실제 줄**을
          리터럴로 박는다(저장소를 읽지 않는다 — 없으면 조용히 건너뛰는 테스트가 된다):
          `- [x] T001 Flutter 프로젝트를 저장소 루트에 생성한다` → tasks 1, matched "spec-kit"
          `- [x] T1. 무언가를 한다` → tasks 1, matched "nereus"
          `- [x] 형식 없는 체크박스` → tasks 0, matched null, checkboxes 1
    - [x] 실패 확인: Run `npx vitest run tests/lib/track-advisor.test.ts` · Expected: FAIL
    - [x] `countScope` 에 spec-kit 정규식을 더하고 `matched` · `checkboxes` 를 반환에 **더한다**.
          기존 키 `tasks` · `flows` 의 형태는 바꾸지 않는다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/track-advisor.test.ts` · Expected: PASS
  - Done when: 세 형식이 각각 올바른 `matched` 를 내고 기존 테스트가 전부 초록이다

- [x] T2. recommendTrack 이 matched null 일 때 임계 비교를 하지 않는다
  - Files: Modify `plugins/nereus-game/lib/track-advisor.mjs` · Modify `tests/lib/track-advisor.test.ts`
  - Steps:
    - [x] 실패 테스트: `matched: null` 인 scope 로 추천하면 `reasons` 에 `scope-unknown` 이 있고
          `scope-exceeds-many` 는 없다. 강제 조건이 있으면 그 근거는 그대로 나온다.
    - [x] 실패 확인: Run `npx vitest run tests/lib/track-advisor.test.ts` · Expected: FAIL
    - [x] `overBudget` 계산 앞에 `matched` 판정을 둔다. 상한(`checkboxes`)으로 게이트를 돌리지 않는다 —
          Steps 체크박스가 섞여 몇 배로 부푼다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/track-advisor.test.ts` · Expected: PASS
  - Done when: 형식 미상일 때 규모 근거 대신 `scope-unknown` 이 나온다

- [x] T3. scanL10n 이 생성물과 개발자 메시지를 분류로 제외한다
  - Files: Modify `plugins/nereus-game/lib/l10n-scan.mjs` · Modify `tests/lib/l10n-scan.test.ts`
  - Steps:
    - [x] 실패 테스트. 픽스처는 ToonTone 의 실제 줄을 리터럴로 박는다:
          `String get hintGranted => 'Hint received';` (file `lib/l10n/generated/app_localizations_en.dart`)
            → violations 0, skipped 에 generated 1
          `throw ContentPackFormatException('최상위가 객체여야 한다');`
            → violations 0, skipped 에 dev-message 1
          `Text('색을 맞춰보세요')` (일반 파일) → violations 1
          예외 줄과 위젯 줄이 같이 있는 파일 → 위젯 줄만 남는다
    - [x] 실패 확인: Run `npx vitest run tests/lib/l10n-scan.test.ts` · Expected: FAIL
    - [x] `scanL10n` 에 줄 단위 분류를 넣고 `skipped: [{ reason, count }]` 를 반환에 **더한다**.
          파일 전체를 버리지 않는다 — 생성물이 아닌 파일에도 개발자 메시지는 섞인다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/l10n-scan.test.ts` · Expected: PASS
  - Done when: 네 시나리오가 통과하고 기존 l10n 테스트가 전부 초록이다

- [x] T4. 제외 규칙을 데이터로 받는다
  - Files: Modify `plugins/nereus-game/lib/l10n-scan.mjs` · Modify `tests/lib/l10n-scan.test.ts`
  - Steps:
    - [x] 실패 테스트: `exclude.generated: ["__gen__/"]` 를 주면 `__gen__/` 만 생성물이고
          `.g.dart` 는 아니다. `exclude` 를 안 주면 Dart 기본값이 적용된다.
    - [x] 실패 확인: Run `npx vitest run tests/lib/l10n-scan.test.ts` · Expected: FAIL
    - [x] 기본 패턴을 lib 상단 상수로 두고 `exclude` 인자로 덮어쓰게 한다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/l10n-scan.test.ts` · Expected: PASS
  - Done when: 덮어쓰기와 기본값이 둘 다 동작한다

- [x] T5. 실측 재현 — ToonTone 에 다시 돌려 수치가 바뀌었는지 확인한다
  - Files: none (측정만 한다)
  - Steps:
    - [x] `countScope` 를 ToonTone `tasks.md` 에 돌려 188 근처가 나오는지 본다
    - [x] `scanL10n` 을 ToonTone `lib/**/*.dart` 에 돌려 461 에서 얼마나 줄었는지, 남은 것이
          실제로 사용자 노출인지 표본으로 확인한다
    - [x] 수치를 proposal.md 에 **측정값으로** 적는다. 추정이면 추정이라고 쓴다.
  - Done when: 두 수치가 기록되고, 남은 violations 표본이 실제 사용자 노출임이 확인된다

- [x] T6. 스킬 문서와 Ruling 을 갱신한다
  - Files: Modify `plugins/nereus-game/skills/track/SKILL.md` · Modify `plugins/nereus-game/skills/localization/SKILL.md`
  - Steps:
    - [x] track SKILL 에 `matched` 와 `scope-unknown` 을 적는다
    - [x] localization SKILL 에 `skipped` 와 `exclude` 를 적는다
    - [x] `Ruling: 검사기 픽스처는 하네스 출력이 아니라 실제 프로젝트 산출물에서 뜬다` 를 남긴다
  - Done when: 두 SKILL.md 가 새 반환 키를 설명한다

- [x] T7. 전체 테스트 + 커밋
  - Steps:
    - [x] Run `node plugins/nereus/skills/build/scripts/run-tests.mjs` · Expected: PASS
    - [x] 커밋한다. **문서·리뷰 파일을 테스트 뒤에 쓰지 않는다** — evidence 가 STALE 이 된다
  - Done when: 전체 초록이고 evidence FRESH 다
