## ADDED Requirements

### Requirement: 규모 계수는 태스크 형식을 못 알아본 것과 태스크가 없는 것을 구분해야 한다
<!-- id: track.scopeMatched -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/track-advisor.test.ts -->

`countScope` 는 spec-kit 형식(`- [x] T001 설명`)과 nereus:spec 형식(`- [ ] T1. 설명`)을
모두 세어야 하며, 어느 형식으로 셌는지를 `matched` 로 함께 내야 한다.
어떤 형식으로도 태스크를 찾지 못하면 `matched` 는 `null` 이어야 한다.

실측: ToonTone 의 spec-kit `tasks.md` 에 태스크 188개가 있었으나 0개로 셌다.
정규식이 번호 뒤 마침표를 요구했기 때문이다. `nereus:spec` 은 greenfield 에 spec-kit 을 쓴다고
선언하면서 계수기는 자기 형식만 읽었다. 결과가 에러가 아니라 조용히 뒤집혔다 —
다작 임계 24개를 7.8배 넘는 프로젝트가 근거 0건의 `many` 로 추천되었다.

#### Scenario: spec-kit 형식
- **WHEN** `- [x] T001 Flutter 프로젝트를 저장소 루트에 생성한다` 를 포함한 tasks 를 센다
- **THEN** `tasks` 가 1 이고 `matched` 가 `"spec-kit"` 이다

#### Scenario: nereus:spec 형식
- **WHEN** `- [ ] T1. 무언가를 한다` 를 포함한 tasks 를 센다
- **THEN** `tasks` 가 1 이고 `matched` 가 `"nereus"` 이다

#### Scenario: 알 수 없는 형식
- **WHEN** 체크박스는 있으나 어떤 태스크 형식과도 맞지 않는 tasks 를 센다
- **THEN** `tasks` 가 0 이고 `matched` 가 `null` 이며 `checkboxes` 가 체크박스 총수다

#### Scenario: 태스크 형식을 못 알아봤을 때의 추천
- **WHEN** `matched` 가 `null` 인 scope 로 트랙을 추천한다
- **THEN** 규모 임계 비교를 하지 않고 `reasons` 에 `scope-unknown` 을 싣는다

### Requirement: 현지화 검사는 생성물과 개발자 메시지를 위반으로 보고하지 않아야 한다
<!-- id: l10n.excludeNonUserFacing -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/l10n-scan.test.ts -->

`scanL10n` 은 l10n 도구 생성물 경로의 줄과 예외·단언·로그 줄을 `violations` 에 넣지 않아야 한다.
대신 분류와 건수를 `skipped` 로 내야 한다. 조용히 버리면 검사되지 않은 것과 통과한 것이 구분되지 않는다.

실측: ToonTone 에서 461건이 나왔고 그중 진짜 결함은 0건이었다.
`lib/l10n/generated/app_localizations_en.dart` — l10n 도구가 만든 번역 테이블 자체가
"하드코딩 문자열"로 잡혔다. 461:0 이면 사람이 게이트를 끈다.

#### Scenario: 생성물
- **WHEN** `lib/l10n/generated/app_localizations_en.dart` 의 번역 리터럴을 스캔한다
- **THEN** `violations` 가 비어 있고 `skipped` 에 `generated` 가 1건 이상이다

#### Scenario: 개발자 메시지
- **WHEN** `throw ContentPackFormatException('최상위가 객체여야 한다');` 를 스캔한다
- **THEN** `violations` 가 비어 있고 `skipped` 에 `dev-message` 가 1건 이상이다

#### Scenario: 사용자 노출 문자열은 계속 잡는다
- **WHEN** 생성물이 아닌 파일의 `Text('색을 맞춰보세요')` 를 스캔한다
- **THEN** `violations` 에 `hardcoded` 가 1건 있다

#### Scenario: 개발자 메시지가 섞인 파일의 사용자 문자열
- **WHEN** 한 파일에 예외 줄과 위젯 줄이 같이 있다
- **THEN** 위젯 줄만 `violations` 에 남는다

### Requirement: 제외 규칙은 데이터로 덮어쓸 수 있어야 한다
<!-- id: l10n.excludeIsData -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/l10n-scan.test.ts -->

생성물 경로 패턴과 개발자 메시지 토큰은 호출자가 `exclude` 로 덮어쓸 수 있어야 하며,
덮어쓰지 않으면 기본값이 적용되어야 한다. 패턴은 언어·프레임워크마다 다르다
(`.g.dart` 는 Dart, `.generated.cs` 는 Unity). 코드에 박으면 스택이 늘 때마다 lib 을 고치게 된다.

#### Scenario: 기본값
- **WHEN** `exclude` 없이 스캔한다
- **THEN** Dart 기본 패턴(`generated/`, `.g.dart`, `.freezed.dart`)이 적용된다

#### Scenario: 덮어쓰기
- **WHEN** `exclude.generated` 에 `"__gen__/"` 만 준다
- **THEN** `__gen__/` 경로만 생성물로 분류되고 `.g.dart` 는 분류되지 않는다
