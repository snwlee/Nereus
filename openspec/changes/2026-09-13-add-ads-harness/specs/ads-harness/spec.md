## ADDED Requirements

### Requirement: 디버그 빌드는 프로덕션 광고 단위를 쓰지 않아야 한다
<!-- id: adPolicy.testUnits -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/ad-policy-check.test.ts -->

디버그 빌드에서 프로덕션 광고 단위가 해석되면 위반으로 보고해야 한다.
개발 기기가 프로덕션 광고 단위에 트래픽을 만들면 무효 트래픽으로 집계되고,
누적되면 계정이 정지된다. 되돌릴 수 없는 손실이다.

#### Scenario: 디버그에서 프로덕션 단위
- **WHEN** `debug: true` 인데 해석된 단위가 구글 데모 단위가 아니다
- **THEN** 위반 코드 `prod-unit-in-debug` 가 나온다

#### Scenario: 디버그에서 데모 단위
- **WHEN** `debug: true` 이고 해석된 단위가 그 포맷·플랫폼의 데모 단위다
- **THEN** 위반이 없다

#### Scenario: 릴리스 빌드
- **WHEN** `debug: false` 이고 프로덕션 단위를 쓴다
- **THEN** 위반이 없다

#### Scenario: 릴리스에 데모 단위가 남았다
- **WHEN** `debug: false` 인데 데모 단위를 쓴다
- **THEN** 위반 코드 `demo-unit-in-release` 가 나온다 — 수익이 0 이 되고 조용하다

### Requirement: 첫 세션 보호는 미설정일 때 켜져야 한다
<!-- id: adPolicy.firstSession -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/ad-policy-check.test.ts -->

실행 횟수를 알 수 없으면 첫 세션으로 보고 중단형 광고를 억제해야 한다.
한 세션 더 보호하는 비용이 진짜 첫 세션에 전면 광고를 띄우는 비용보다 싸다.
미설정을 보호 해제로 읽으면 조용히 최악으로 떨어진다.

#### Scenario: 카운터 미상
- **WHEN** `launchCount` 가 0 이거나 없다
- **THEN** 보호가 적용된 것으로 판정한다

#### Scenario: 첫 세션에 중단형 광고 계획
- **WHEN** 보호 구간인데 계획에 전면 광고가 있다
- **THEN** 위반 코드 `first-session-interruptive` 가 나온다

#### Scenario: 사용자가 시작한 포맷은 막지 않는다
- **WHEN** 보호 구간에 리워드 광고가 있다
- **THEN** 위반이 없다 — 사용자가 스스로 고른 것이다

#### Scenario: 킬 스위치
- **WHEN** 보호를 명시적으로 껐다
- **THEN** 보호가 적용되지 않는다

### Requirement: 동의 전에 건너뛴 로드는 재시도되어야 한다
<!-- id: adPolicy.consentRetry -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/ad-policy-check.test.ts -->

동의가 준비되기 전에 건너뛴 포맷에 재시도 등록이 없으면 위반으로 보고해야 한다.
재시도가 없으면 그 세션 동안 그 포맷은 영원히 비어 있고, 아무 에러도 나지 않는다.

#### Scenario: 재시도 없음
- **WHEN** `skippedForConsent` 에 있는 포맷이 `consentRetry` 에 없다
- **THEN** 위반 코드 `consent-retry-missing` 가 나온다

#### Scenario: 재시도 있음
- **WHEN** 건너뛴 포맷이 전부 재시도에 등록되어 있다
- **THEN** 위반이 없다

#### Scenario: 동의 전에 초기화했다
- **WHEN** `initBeforeConsent` 가 true 다
- **THEN** 위반 코드 `init-before-consent` 가 나온다

### Requirement: 모든 포맷이 같은 타게팅 신호를 보내야 한다
<!-- id: adPolicy.targetingParity -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/ad-policy-check.test.ts -->

포맷마다 타게팅 신호가 다르면 위반으로 보고해야 한다.
도너에서는 배너와 인라인 네이티브만 빈 요청을 보내 매치율이 깎였다.
이 손실은 에러가 아니라 낮은 매치율로만 나타나므로 보고서를 열기 전에는 보이지 않는다.

#### Scenario: 신호가 갈린다
- **WHEN** 어떤 포맷의 타게팅 신호가 다른 포맷과 다르다
- **THEN** 위반 코드 `targeting-mismatch` 와 어느 포맷인지가 나온다

#### Scenario: 빈 요청
- **WHEN** 어떤 포맷이 타게팅 신호를 하나도 안 보낸다
- **THEN** 위반 코드 `targeting-empty` 가 나온다

#### Scenario: 개인화는 여기서 판정하지 않는다
- **WHEN** 포맷들이 개인화 설정을 선언하지 않았다
- **THEN** 그것을 위반으로 보지 않는다 — UMP 동의와 SDK 가 정한다

### Requirement: 퍼널 병목을 단계별로 지목해야 한다
<!-- id: adFunnel.bottleneck -->
<!-- entities: Advisor -->
<!-- enforced: tests/lib/ad-funnel.test.ts -->

요청·매치·노출을 받아 match rate 와 show rate 를 **따로** 내고 낮은 쪽을 병목으로 지목해야 한다.
둘을 하나의 효율 지표로 뭉치면 결론이 뒤집힌다 — 채움이 멀쩡한데 지면이 문제인 경우와
그 반대는 고칠 곳이 완전히 다르다.

#### Scenario: 지면 병목
- **WHEN** match rate 는 높은데 show rate 가 낮다
- **THEN** 병목이 `show` 이고 근거에 두 비율이 함께 실린다

#### Scenario: 재고 병목
- **WHEN** match rate 가 낮다
- **THEN** 병목이 `match` 다

#### Scenario: 기준이 없으면 판정하지 않는다
- **WHEN** `targets` 를 주지 않았다
- **THEN** 병목을 단정하지 않고 비율만 내며 그 사실을 `unanswerable` 에 싣는다

#### Scenario: 0 요청
- **WHEN** 요청이 0 이다
- **THEN** 나눗셈을 하지 않고 비율을 `null` 로 낸다

### Requirement: 노출 점유와 수익 점유의 역전을 표시해야 한다
<!-- id: adFunnel.mixInversion -->
<!-- entities: Advisor -->
<!-- enforced: tests/lib/ad-funnel.test.ts -->

포맷별 노출 점유율과 수익 점유율을 나란히 내고, 노출 점유가 수익 점유보다 큰 포맷을
역전으로 표시해야 한다. 비율 하나만 보면 그 포맷을 없애라는 뜻으로 읽히는데,
답은 제거가 아니라 믹스 재배분이다.

#### Scenario: 역전
- **WHEN** 어떤 포맷의 노출 점유가 수익 점유보다 크다
- **THEN** 레버 코드 `mix-inversion` 과 두 점유율이 나온다

#### Scenario: 역전 아님
- **WHEN** 노출 점유가 수익 점유보다 작거나 같다
- **THEN** 그 포맷에 `mix-inversion` 이 없다

#### Scenario: 처방은 제거가 아니다
- **WHEN** 역전이 보고된다
- **THEN** 처방 문구가 노출을 줄이라고 말하지 않는다

### Requirement: 답할 수 없는 질문을 결과에 실어야 한다
<!-- id: adFunnel.unanswerable -->
<!-- entities: Advisor -->
<!-- enforced: tests/lib/ad-funnel.test.ts -->

광고 리포트만으로 답할 수 없는 질문은 무엇이 더 필요한지와 함께 결과에 실려야 한다.
검사기가 다 본다고 믿게 만드는 것이 아무것도 안 보는 것보다 나쁘다.

#### Scenario: 원인 질문
- **WHEN** show rate 병목이 지목된다
- **THEN** `unanswerable` 에 "왜 낮은지는 앱 내 이벤트 로그가 필요하다"가 실린다

#### Scenario: 무효 트래픽 질문
- **WHEN** 어떤 포맷의 CTR 이 주어진 임계를 넘는다
- **THEN** `unanswerable` 에 정책 리포트가 필요하다는 항목이 실린다

### Requirement: 플러그인이 실재하고 이름이 겹치지 않아야 한다
<!-- id: adsPlugin.wiring -->
<!-- entities: Plugin, Skill, Agent -->
<!-- enforced: tests/smoke/ads-wiring.test.ts -->

`nereus-ads` 는 마켓플레이스에 등재되고, 라우트가 가리키는 스킬이 실재하며,
스킬·에이전트 이름이 다른 두 플러그인과 겹치지 않아야 한다.
에이전트 이름은 이름 공간이 하나뿐인 표면이라 한쪽이 다른 쪽을 가린다.

#### Scenario: 등재
- **WHEN** 마켓플레이스 매니페스트를 읽는다
- **THEN** `nereus-ads` 항목이 있고 매니페스트의 이름·버전과 같다

#### Scenario: 라우트가 가리키는 스킬
- **WHEN** 확장 선언의 모든 라우트를 따라간다
- **THEN** 각 스킬의 SKILL.md 가 존재한다

#### Scenario: 이름 충돌 없음
- **WHEN** 세 플러그인의 스킬·에이전트 이름을 모은다
- **THEN** 중복이 없다

#### Scenario: 다른 플러그인을 import 하지 않는다
- **WHEN** `nereus-ads` 의 모든 소스를 검사한다
- **THEN** `nereus-game` 이나 코어 내부 모듈을 import 하지 않는다

### Requirement: 검사기는 프로세스 진입점으로 돌아야 한다
<!-- id: adsPlugin.cliEntry -->
<!-- entities: Checker -->
<!-- enforced: tests/smoke/ads-rig.test.ts -->

두 lib 은 stdin JSON 을 받아 stdout JSON 을 내는 프로세스로 동작해야 하며,
깨진 입력에는 스택트레이스 없이 사유만 내고 0 이 아닌 코드로 끝나야 한다.

#### Scenario: 정책 진입점
- **WHEN** 디버그에 프로덕션 단위를 쓰는 입력을 넣는다
- **THEN** stdout JSON 에 `prod-unit-in-debug` 가 있다

#### Scenario: 퍼널 진입점
- **WHEN** 퍼널 수치를 넣는다
- **THEN** stdout JSON 에 병목과 비율이 있다

#### Scenario: 깨진 입력
- **WHEN** JSON 이 아닌 입력을 넣는다
- **THEN** 0 이 아닌 코드로 끝나고 stderr 에 스택 프레임이 없다
