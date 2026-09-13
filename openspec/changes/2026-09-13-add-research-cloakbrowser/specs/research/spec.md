## ADDED Requirements

### Requirement: CloakBrowser 는 무료 티어로 고정된 상태에서만 쓸 수 있어야 한다
<!-- id: research.cloakFreePin -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/cloak.test.ts -->

`cloakPlan` 은 환경을 읽어 `free` · `pro` · `unpinned` · `unknown` 중 하나를 내야 하며,
무료 고정이 아닌 모든 상태를 위반으로 내야 한다.

고정하지 않으면 기본값이 최신(v148+)이고 그것은 Pro 구독이 있어야 내려받아진다.
핀 없는 실행은 무료 사용이 아니라 조용한 유료 경로다.
읽을 수 없는 핀을 무료로 단정해서도 안 된다 — 다운로드가 실패하기 전까지 드러나지 않는다.

#### Scenario: 고정 없음
- **WHEN** `CLOAKBROWSER_VERSION` 이 없다
- **THEN** `tier` 가 `"unpinned"` 이고 `ok` 가 `false` 이며 위반 `unpinned` 를 낸다

#### Scenario: 무료 핀
- **WHEN** `CLOAKBROWSER_VERSION` 이 `146.0.7680.177.5` 다
- **THEN** `tier` 가 `"free"` 이고 `ok` 가 `true` 이며 위반이 없다

#### Scenario: Pro 버전
- **WHEN** 메이저가 148 이상이다
- **THEN** `tier` 가 `"pro"` 이고 위반 `pro-version` 을 낸다

#### Scenario: 라이선스 키가 설정됨
- **WHEN** 무료 핀이지만 `CLOAKBROWSER_LICENSE_KEY` 가 있다
- **THEN** `ok` 가 `false` 이고 위반 `license-key-set` 을 낸다

#### Scenario: 읽을 수 없는 핀
- **WHEN** 핀에서 메이저를 파싱할 수 없다
- **THEN** `tier` 가 `"unknown"` 이고 위반 `unparsable` 을 낸다
