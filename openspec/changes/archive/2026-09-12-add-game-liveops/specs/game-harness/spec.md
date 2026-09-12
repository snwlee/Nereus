# game-harness Specification (delta: add-game-liveops)

## ADDED Requirements

### Requirement: 오디오 예산과 피드백 커버리지를 수치로 판정해야 한다
<!-- id: sound.budget -->
<!-- entities: Profile, SoundPlan -->
<!-- enforced: plugins/nereus-game/lib/sound-budget.mjs -->
<!-- invariant: 프로파일에 sound 기준이 없으면 통과시키지 않고 "기준 없음"으로 보고한다 -->

시스템은 사운드 계획을 장르 프로파일의 `sound` 기준과 대조해 위반 목록을 돌려주어야 한다.
검사 항목은 넷이다: 동시 발음수 상한, 큐당 변형(variant) 최소 개수, 라우드니스 목표 범위,
피드백 SFX 가 없는 플레이어 동작.

#### Scenario: 동시 발음수 초과
- **WHEN** 계획의 `maxConcurrent` 가 프로파일의 `sound.maxConcurrent` 를 넘는다
- **THEN** 위반에 `concurrency` 가 들어 있다

#### Scenario: 변형 부족
- **WHEN** 한 큐의 variants 가 프로파일의 `sound.minVariants` 미만이다
- **THEN** 위반에 그 큐 이름과 함께 `variants` 가 들어 있다

#### Scenario: 피드백 없는 동작
- **WHEN** 계획의 `actions` 중 어떤 큐에도 매핑되지 않은 동작이 있다
- **THEN** 위반에 그 동작 이름과 함께 `no-feedback` 이 들어 있다

#### Scenario: 프로파일에 기준이 없음
- **WHEN** 장르 프로파일에 `sound` 키가 없다
- **THEN** 통과가 아니라 `no-baseline` 을 돌려준다

### Requirement: 라이브옵스 계획의 내적 정합성을 지표 없이도 판정해야 한다
<!-- id: liveops.plan -->
<!-- entities: Profile, LiveopsPlan, Metrics -->
<!-- enforced: plugins/nereus-game/lib/liveops-plan.mjs -->
<!-- invariant: 실측 지표가 없다고 게이트가 꺼지지 않는다. 지표가 필요한 항목만 unmeasured 로 보고한다 -->

시스템은 라이브옵스 계획에서 이벤트 구간 겹침, 경제 싱크/소스 비율, 리텐션 곡선 형태,
이벤트별 롤백 경로 선언을 검사해야 한다. 실측 지표는 선택 인자로 받고,
주어지지 않으면 지표가 필요한 항목만 `unmeasured` 로 남긴다.

#### Scenario: 이벤트 구간 겹침
- **WHEN** 두 이벤트의 `[start, end)` 구간이 겹친다
- **THEN** 위반에 두 이벤트 이름과 함께 `overlap` 이 들어 있다

#### Scenario: 경제가 싱크 없이 소스만 있다
- **WHEN** 선언된 sink 합이 0 이고 source 합이 0 보다 크다
- **THEN** 위반에 `no-sink` 가 들어 있다

#### Scenario: 리텐션 가정이 단조 감소가 아니다
- **WHEN** 선언된 리텐션이 D1 < D7 처럼 뒤로 갈수록 올라간다
- **THEN** 위반에 `retention-shape` 가 들어 있다

#### Scenario: 롤백 경로 없음
- **WHEN** 어떤 이벤트에 `rollback` 선언이 없다
- **THEN** 위반에 그 이벤트 이름과 함께 `no-rollback` 이 들어 있다

#### Scenario: 지표 미주입
- **WHEN** `metrics` 인자가 주어지지 않았다
- **THEN** 결과의 `unmeasured` 에 `retention-actual` 이 들어 있고, 나머지 항목은 정상 판정된다

#### Scenario: 지표 주입
- **WHEN** `metrics` 에 실측 리텐션이 주어지고 가정과의 편차가 프로파일의 허용치를 넘는다
- **THEN** 위반에 `retention-drift` 가 들어 있고 `unmeasured` 는 비어 있다

### Requirement: 현지화 위험을 번역 전에 판정해야 한다
<!-- id: l10n.scan -->
<!-- entities: Locale, StringTable, Source -->
<!-- enforced: plugins/nereus-game/lib/l10n-scan.mjs -->
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

### Requirement: 새 도메인 스킬이 라우터에 실제로 배선되어야 한다
<!-- id: liveops.routes -->
<!-- entities: Plugin, Route -->
<!-- enforced: plugins/nereus-game/nereus-extension.json -->

`sound` · `liveops` · `localization` 세 스킬은 `nereus-extension.json` 의 routes 에 선언되고,
선언된 각 route 의 `skill` 에 대응하는 `SKILL.md` 가 실재해야 한다.

#### Scenario: 라우트와 스킬의 실재 대응
- **WHEN** routes 를 훑는다
- **THEN** 모든 route 의 skill 에 대응하는 `skills/<name>/SKILL.md` 가 존재한다

#### Scenario: 프로세스 수준 확인
- **WHEN** 실제 형태의 설치 기록으로 코어 라우터를 자식 프로세스로 돌린다
- **THEN** 세 스킬이 라우팅 후보에 나타난다
