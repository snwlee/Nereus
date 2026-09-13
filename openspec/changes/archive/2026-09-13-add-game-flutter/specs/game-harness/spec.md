## ADDED Requirements

### Requirement: Flutter 게임 프로젝트의 사실을 한 번에 모을 수 있어야 한다
<!-- id: flutter.detect -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/flutter-stack.test.ts -->

`detectFlutterGame` 은 프로젝트 루트에서 테스트 러너 · Flame 유무 · 플레이버 목록 ·
적용할 계층 경계를 모아 내야 한다. 앞 두 사이클에서 이 입력을 손으로 만들었고,
손으로 만드는 입력은 프로젝트마다 다시 만들어야 하며 틀려도 아무도 모른다.

#### Scenario: Flutter 프로젝트가 아니다
- **WHEN** `pubspec.yaml` 이 없는 디렉터리를 준다
- **THEN** `null` 을 낸다

#### Scenario: 테스트 러너
- **WHEN** `pubspec.yaml` 에 `flutter_test` 가 있다
- **THEN** `runner` 가 `flutter_test` 이고 `command` 가 `flutter test` 다

#### Scenario: Flame 있음
- **WHEN** `pubspec.yaml` 의 dependencies 에 `flame` 이 있다
- **THEN** `flame.present` 가 `true` 이고 선언된 제약이 실려 있다

#### Scenario: Flame 없음은 결함이 아니다
- **WHEN** `flame` 의존이 없다
- **THEN** `flame.present` 가 `false` 이고 위반이 아니다

#### Scenario: 계층 경계를 같이 낸다
- **WHEN** 감지에 성공한다
- **THEN** `layers` 에 flutter 계층 경계가 실려 있어 `purity-check` 에 그대로 넘길 수 있다

### Requirement: 플레이버는 소스 세트 디렉터리에서 읽어야 한다
<!-- id: flutter.flavors -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/flutter-stack.test.ts -->

플레이버 목록은 `android/app/src/` 의 디렉터리에서 읽고, 빌드 타입은 제외해야 한다.
제외 목록은 데이터여야 한다. Gradle 이 그 디렉터리를 스캔해 productFlavor 를 동적 생성하는
프로젝트에서는 `build.gradle` 에 이름이 하나도 적혀 있지 않다.

#### Scenario: 소스 세트에서 읽는다
- **WHEN** `android/app/src/` 에 `main` · `debug` · `profile` · `flag` · `art` 가 있다
- **THEN** `flavors` 가 `["art", "flag"]` 다

#### Scenario: 못 찾으면 빈 배열이 아니라 null 이다
- **WHEN** `android/app/src/` 가 없다
- **THEN** `flavors` 가 `null` 이고 그 이유가 `notes` 에 실린다

#### Scenario: 제외 목록은 데이터다
- **WHEN** `buildTypes` 로 `["main"]` 만 준다
- **THEN** `debug` 와 `profile` 이 플레이버로 나온다

### Requirement: Flutter 스택 스킬이 있어야 한다
<!-- id: flutter.skill -->
<!-- entities: Skill -->
<!-- enforced: tests/smoke/game-domain.test.ts -->

`flutter` 스킬이 존재하고 자기 어댑터를 가리켜야 한다. 검증 대상이 Flutter 폰게임인데
스택 스킬이 없어 하네스가 그 프로젝트에 정식으로 붙지 못했다.

#### Scenario: 스킬과 어댑터
- **WHEN** `flutter` 스킬 본문을 읽는다
- **THEN** `flutter-stack.mjs` 와 `detectFlutterGame` 을 가리킨다

#### Scenario: 스택을 다시 선언하지 않는다
- **WHEN** `nereus-extension.json` 의 `stacks` 를 본다
- **THEN** `flutter` 항목이 없다 — 코어가 이미 판정한다
