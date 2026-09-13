### Requirement: 로케일 집합은 스토어가 지원하는 전체여야 한다
<!-- id: l10n.localeSet -->
<!-- entities: Data -->
<!-- enforced: tests/lib/locales.test.ts -->
<!-- invariant: 대상 로케일을 선언하지 않으면 스토어 전체를 요구 집합으로 본다 -->

시스템은 스토어별 지원 로케일 전체를 데이터로 갖고, 출처 URL·확인일과 함께
**그 목록을 어떻게 셌는지**를 같이 기록해야 한다.

#### Scenario: Play 로케일 전체
- **WHEN** 로케일 데이터를 읽는다
- **THEN** Play 로케일이 86종 있고 각각 코드·라벨·스크립트·방향을 갖는다

#### Scenario: 셈의 근거
- **WHEN** 로케일 데이터의 메타를 읽는다
- **THEN** `source` 와 `checkedAt` 과 `howCounted` 가 모두 있다

#### Scenario: 미선언은 전체를 요구한다
- **WHEN** 대상 로케일을 선언하지 않는다
- **THEN** 요구 집합이 스토어 전체가 된다 — 빈 집합이 아니다

#### Scenario: 알 수 없는 로케일
- **WHEN** 데이터에 없는 로케일을 대상으로 지정한다
- **THEN** 기본값으로 떨어지지 않고 던진다

### Requirement: 추정값은 출처를 필드마다 표시해야 한다
<!-- id: l10n.estimateBasis -->
<!-- entities: Data -->
<!-- enforced: tests/lib/locales.test.ts -->

각 로케일의 `expansion` 과 `avgCharWidth` 는 그 값이 어디서 왔는지를 나타내는
근거 필드를 함께 가져야 한다. 86종의 확장률을 실측 없이 지어낼 수 없으므로,
지어낸 것과 물려받은 것과 실측한 것이 구분되어야 한다.

#### Scenario: 근거가 빠진 로케일이 없다
- **WHEN** 모든 로케일을 훑는다
- **THEN** 각각 `expansionBasis` 와 `avgCharWidthBasis` 를 갖는다

#### Scenario: 근거 값은 열거된 것 중 하나다
- **WHEN** 근거 필드의 값을 본다
- **THEN** `legacy-estimate` · `group-estimate` · `measured` 중 하나다

#### Scenario: 두 축을 섞지 않는다
- **WHEN** 전각 스크립트 로케일을 본다
- **THEN** `expansion` 이 1 미만이어도 `avgCharWidth` 는 라틴보다 크다

### Requirement: 스토어 등재 텍스트의 선언과 실제가 일치해야 한다
<!-- id: storeL10n.parity -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/store-l10n-check.test.ts -->
<!-- invariant: 요구 집합 미달은 위반이 아니라 coverage 다 -->

시스템은 선언된 로케일과 실제 채워진 등재 필드를 대조해, 어긋난 것만 위반으로 내고
요구 집합 대비 진행 상태는 `coverage` 로 따로 내야 한다.

#### Scenario: 선언했는데 비었다
- **WHEN** 어떤 로케일을 선언했는데 그 로케일의 필드가 비어 있다
- **THEN** 위반 코드 `declared-but-empty` 가 로케일·필드와 함께 나온다

#### Scenario: 미달은 위반이 아니다
- **WHEN** 요구 집합 86 중 19 로케일만 채워져 있다
- **THEN** 위반이 없고 `coverage` 에 채운 수·빠진 로케일이 나온다

#### Scenario: 빠진 것은 이유와 함께 센다
- **WHEN** 어떤 로케일을 명시적 이유와 함께 제외한다
- **THEN** `skipped` 에 그 로케일과 이유와 셈이 나오고 `missing` 에는 없다

#### Scenario: 스토어가 모르는 코드
- **WHEN** Play 등재에 `ko` 처럼 스토어 형식이 아닌 코드를 쓴다
- **THEN** 위반 코드 `locale-code-unknown` 이 나온다

### Requirement: 번역하지 않기로 한 필드는 이유를 선언해야 한다
<!-- id: storeL10n.doNotTranslate -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/store-l10n-check.test.ts -->
<!-- invariant: 하네스는 번역 여부를 정하지 않는다. 판단이 기록에 남는 것만 강제한다 -->

모든 로케일에서 같은 문자열인 필드는 `doNotTranslate` 에 이유와 함께 선언되어야 한다.
선언이 없으면 판단해서 그렇게 한 것과 그냥 빠뜨린 것이 구분되지 않는다.

#### Scenario: 선언 없는 미번역
- **WHEN** 어떤 필드가 전 로케일에서 같은 문자열인데 `doNotTranslate` 에 없다
- **THEN** 위반 코드 `untranslated-undeclared` 가 그 필드와 함께 나온다

#### Scenario: 선언된 미번역
- **WHEN** 그 필드가 이유와 함께 `doNotTranslate` 에 선언되어 있다
- **THEN** 위반이 없다

#### Scenario: 이유 없는 선언
- **WHEN** `doNotTranslate` 항목에 `why` 가 없다
- **THEN** 위반 코드 `declaration-without-why` 가 나온다

### Requirement: 등재 필드 길이는 스토어 제한 안이어야 한다
<!-- id: storeL10n.fieldLength -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/store-l10n-check.test.ts -->

시스템은 스토어별 필드 길이 제한을 데이터로 읽고, 넘는 필드를 로케일과 함께 보고해야 한다.
넘으면 잘린 채 발행되고 에러가 나지 않는다.

#### Scenario: 제한 초과
- **WHEN** 어떤 로케일의 제목이 그 스토어의 제목 길이 제한을 넘는다
- **THEN** 위반 코드 `field-length-overflow` 가 로케일·필드·길이·제한과 함께 나온다

#### Scenario: 제한은 데이터다
- **WHEN** 스토어 데이터를 읽는다
- **THEN** 필드 길이 제한이 출처·확인일과 함께 스토어별로 들어 있다

#### Scenario: 제한이 없는 스토어
- **WHEN** 제한이 선언되지 않은 스토어를 대상으로 한다
- **THEN** 그 검사를 통과로 내지 않고 검사하지 않았음을 보고한다

### Requirement: 글리프 검증 증거가 없으면 통과시키지 않아야 한다
<!-- id: typeface.tofu -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/store-l10n-check.test.ts -->
<!-- invariant: 미설정을 통과로 읽지 않는다 -->

이미지에 텍스트를 렌더하는 로케일은 렌더 직후 글리프 검증을 돌린 증거를 제출해야 한다.
렌더러는 빠진 글리프를 두부로 그리고 성공 코드로 끝난다 — 로케일 하나가 통째로
두부로 나가는데 모든 게이트가 초록이다.

#### Scenario: 증거 없음
- **WHEN** 렌더 대상 로케일에 `glyphCheck` 가 없다
- **THEN** 위반 코드 `tofu-unverified` 가 그 로케일과 함께 나온다

#### Scenario: 증거에 빠진 글리프가 있다
- **WHEN** `glyphCheck.missing` 이 비어 있지 않다
- **THEN** 위반 코드 `glyph-missing` 이 폰트·문자와 함께 나온다

#### Scenario: 하네스는 폰트를 파싱하지 않는다
- **WHEN** 검사를 돌린다
- **THEN** 폰트 파일을 읽지 않고 제출된 증거만 판정한다

### Requirement: RTL 로케일의 타이틀은 한 런으로 그려야 한다
<!-- id: typeface.rtlRun -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/store-l10n-check.test.ts -->

RTL 로케일에서 타이틀을 여러 조각으로 나눠 그린다고 선언하면 위반으로 보고해야 한다.
셰이퍼에 조각을 따로 넘기면 공백이 사라지고 조각 순서가 뒤집힌다.

#### Scenario: RTL 에서 쪼갠 런
- **WHEN** RTL 로케일의 타이틀 렌더가 두 조각 이상으로 선언되어 있다
- **THEN** 위반 코드 `rtl-split-run` 이 그 로케일과 함께 나온다

#### Scenario: LTR 은 쪼개도 된다
- **WHEN** LTR 로케일의 타이틀이 두 조각으로 선언되어 있다
- **THEN** 위반이 없다

#### Scenario: 방향은 데이터다
- **WHEN** 어떤 로케일이 RTL 인지 판정한다
- **THEN** 로케일 데이터의 `direction` 을 읽고 코드에 목록을 박지 않는다

### Requirement: 로케일 우선순위는 조언이지 게이트가 아니어야 한다
<!-- id: aso.advisor -->
<!-- entities: Advisor -->
<!-- enforced: tests/lib/aso-advisor.test.ts -->
<!-- invariant: violations 를 내지 않는다 -->

시스템은 어느 로케일을 먼저 채울지에 대해 레버와 답할 수 없는 질문만 내야 한다.
실측 점유율은 하네스에 두지 않고 입력으로 받는다.

#### Scenario: 조언자는 막지 않는다
- **WHEN** 어떤 입력으로든 조언자를 돌린다
- **THEN** 결과에 `violations` 키가 없다

#### Scenario: 점유 신호가 없으면 순위를 매기지 않는다
- **WHEN** 로케일별 점유 신호를 주지 않는다
- **THEN** 순위를 단정하지 않고 그 사실을 `unanswerable` 에 싣는다

#### Scenario: 답할 수 없는 것을 항상 싣는다
- **WHEN** 신호를 충분히 주고 조언자를 돌린다
- **THEN** 번역 품질은 판정하지 않았다는 항목이 `unanswerable` 에 남는다

### Requirement: 요구 임베딩 미선언을 허용으로 읽지 않아야 한다
<!-- id: typeface.embedding -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/font-check.test.ts -->
<!-- invariant: 모름은 허용이 아니다 -->

폰트 임베딩 라이선스 검사는 요구 임베딩 종류를 입력으로 받아야 하며,
주지 않았을 때 검사를 건너뛰지 않고 미선언으로 보고해야 한다.

#### Scenario: 요구 임베딩을 주고 충족한다
- **WHEN** `requiredEmbedding` 을 주고 폰트가 그것을 선언한다
- **THEN** 위반이 없다

#### Scenario: 요구 임베딩을 주고 불충족한다
- **WHEN** `requiredEmbedding` 을 주고 폰트가 그것을 선언하지 않는다
- **THEN** 위반 코드 `license-embedding` 이 나온다

#### Scenario: 요구 임베딩 미선언
- **WHEN** `requiredEmbedding` 을 주지 않는다
- **THEN** 위반 코드 `required-embedding-undeclared` 가 나오고 통과로 치지 않는다

### Requirement: l10n 플러그인은 다른 플러그인을 전제하지 않아야 한다
<!-- id: l10nPlugin.wiring -->
<!-- entities: Plugin, Skill, Agent -->
<!-- enforced: tests/smoke/l10n-wiring.test.ts -->

`nereus-l10n` 은 단독으로 동작해야 하고, 스킬·에이전트 이름이 다른 플러그인과 겹치지 않아야 하며,
모든 스킬이 라우트를 가져야 한다.

#### Scenario: 등재와 매니페스트
- **WHEN** 마켓플레이스 매니페스트를 읽는다
- **THEN** `nereus-l10n` 항목이 있고 매니페스트의 이름·버전과 같다

#### Scenario: 이름 충돌 없음
- **WHEN** 네 플러그인의 이름을 종류별로 모은다
- **THEN** 각 종류 안에 중복이 없다

#### Scenario: 다른 플러그인을 import 하지 않는다
- **WHEN** `nereus-l10n` 의 모든 소스에서 import 지정자를 뽑는다
- **THEN** 다른 플러그인이나 코어 내부 모듈을 가리키는 지정자가 없다

#### Scenario: 대표어 단독을 잡지 않는다
- **WHEN** 각 라우트의 정규식에 `번역` 또는 `언어` 한 단어만 넣는다
- **THEN** 어느 라우트도 매치하지 않는다

### Requirement: 게임 플러그인은 l10n 플러그인을 동반으로 안내해야 한다
<!-- id: l10nPlugin.companion -->
<!-- entities: Plugin -->
<!-- enforced: tests/smoke/l10n-wiring.test.ts -->
<!-- invariant: 형제 플러그인의 검사기를 직접 호출하지 않는다 -->

`nereus-game` 은 현지화 검사기를 `nereus-l10n` 에 넘기고, 그것을 동반 플러그인으로 선언해야 한다.

#### Scenario: 동반 선언
- **WHEN** `nereus-game` 의 확장 선언을 읽는다
- **THEN** `companions` 에 `nereus-l10n` 이 이유와 함께 들어 있다

#### Scenario: 호출하지 않는다
- **WHEN** `nereus-game` 의 소스와 스킬 문서를 훑는다
- **THEN** `nereus-l10n` 의 검사기를 프로세스로 부르는 명령이 없다

<!-- 아래 5건은 game-harness 기준선에서 **그대로 이관**했다(2026-09-13).
     문구를 다시 쓰지 않는다 — ToonTone 461:0 같은 실측 결론이 문장에 박혀 있고,
     다시 쓰면 그 근거가 조용히 희석된다. enforced 경로만 새 위치로 고쳤다. -->

### Requirement: 현지화 위험을 번역 전에 판정해야 한다
<!-- id: l10n.scan -->
<!-- entities: Locale, StringTable, Source -->
<!-- enforced: plugins/nereus-l10n/lib/l10n-scan.mjs -->
<!-- invariant: 알 수 없는 로케일은 기본값으로 떨어지지 않고 던진다 -->

시스템은 대상 로케일 집합을 `locales.json` 에서 데이터로 읽고, 소스의 하드코딩 문자열,
로케일별 키 누락, 언어별 확장률을 적용했을 때 `maxWidth` 를 넘길 문자열을 찾아내야 한다.

#### Scenario: 하드코딩 문자열
- **WHEN** 소스에 문자열 테이블을 거치지 않은 사용자 노출 문자열이 있다
- **THEN** 위반에 파일·줄과 함께 `hardcoded` 가 들어 있다

#### Scenario: 로케일 키 누락
- **WHEN** 어떤 로케일의 문자열 테이블에 기준 로케일의 키가 빠져 있다
- **THEN** 위반에 로케일과 키 이름과 함께 `missing-key` 가 들어 있다

#### Scenario: 확장률로 폭 초과
- **WHEN** 기준 문자열 길이에 그 로케일의 확장률을 곱한 값이 `maxWidth` 를 넘는다
- **THEN** 위반에 로케일·키와 함께 `overflow` 가 들어 있다

#### Scenario: 알 수 없는 로케일
- **WHEN** `locales.json` 에 없는 로케일을 대상으로 지정한다
- **THEN** 기본값으로 떨어지지 않고 예외를 던진다

### Requirement: 폰트를 라이선스·글리프·용량·가독성으로 판정해야 한다
<!-- id: font.check -->
<!-- entities: Font, Locale, Profile -->
<!-- enforced: plugins/nereus-l10n/lib/font-check.mjs -->
<!-- invariant: 요구 임베딩을 선언하지 않은 폰트는 통과시키지 않는다 (요구 종류는 typeface.embedding 이 정한다) -->

시스템은 선언된 폰트 목록을 대상 로케일과 대조해 위반 목록을 돌려주어야 한다.
검사 항목은 다섯이다: 게임 임베딩 라이선스, 로케일이 요구하는 스크립트 커버리지,
유저 생성 텍스트가 있을 때의 서브셋 금지, 파일 크기 예산, 최소 표시 크기.

#### Scenario: 임베딩이 허용되지 않은 폰트
- **WHEN** 폰트의 `embedding` 이 `"game"` 을 포함하지 않는다
- **THEN** 위반에 그 폰트 이름과 함께 `license-embedding` 이 들어 있다

#### Scenario: 임베딩 선언 자체가 없음
- **WHEN** 폰트에 `embedding` 선언이 없다
- **THEN** 위반에 `license-embedding` 이 들어 있다

#### Scenario: 로케일 스크립트 미커버
- **WHEN** 대상 로케일이 요구하는 `script` 를 어떤 폰트도 `scripts` 에 선언하지 않았다
- **THEN** 위반에 그 로케일과 함께 `script-uncovered` 가 들어 있다

#### Scenario: 유저 생성 텍스트가 있는데 서브셋
- **WHEN** `userGeneratedText` 가 참인데 어떤 폰트의 `subset` 이 참이다
- **THEN** 위반에 그 폰트 이름과 함께 `subset-unsafe` 가 들어 있다

#### Scenario: 폰트 용량 초과
- **WHEN** 폰트 파일 크기 합이 프로파일의 `typography.maxFontKb` 를 넘는다
- **THEN** 위반에 `font-size-budget` 이 들어 있다

#### Scenario: 최소 표시 크기 미만
- **WHEN** 폰트의 `minSizePx` 가 프로파일의 `typography.minSizePx` 미만이다
- **THEN** 위반에 그 폰트 이름과 함께 `min-size` 가 들어 있다

#### Scenario: 프로파일에 기준이 없음
- **WHEN** 장르 프로파일에 `typography` 키가 없다
- **THEN** 예산·크기 항목을 판정하지 않고 `unmeasured` 에 `typography-baseline` 이 들어 있다

### Requirement: 문자열 폭 판정은 근사 여부를 표시해야 한다
<!-- id: l10n.approxWidth -->
<!-- entities: Locale, Font, StringTable -->
<!-- enforced: plugins/nereus-l10n/lib/l10n-scan.mjs -->
<!-- invariant: 폰트 메트릭 없이 낸 폭 판정은 approx 로 표시한다. 조용한 근사는 틀린 확신을 만든다 -->

시스템은 폰트 메트릭이 주어지면 그것으로 문자열 폭을 계산하고, 주어지지 않으면
언어 확장률로 근사하되 그 위반에 근사임을 표시해야 한다. 기존 반환 형태는 유지한다.

#### Scenario: 폰트 메트릭 없이 폭 판정
- **WHEN** `fonts` 인자 없이 `maxWidth` 를 넘는 문자열을 검사한다
- **THEN** `overflow` 위반이 나오고 그 위반의 `approx` 가 참이다

#### Scenario: 폰트 메트릭으로 폭 판정
- **WHEN** 그 로케일의 폰트 `avgCharWidth` 가 주어진다
- **THEN** `overflow` 판정에 그 값이 쓰이고 위반의 `approx` 가 거짓이다

#### Scenario: 기존 반환 형태 유지
- **WHEN** `fonts` 를 주지 않고 기존처럼 호출한다
- **THEN** `violations` 배열이 기존과 같은 코드 집합으로 나온다

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
