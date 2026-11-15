## ADDED Requirements

### Requirement: ThreeRT 호환 규칙은 출처와 함께 데이터여야 한다
<!-- id: threert.compatData -->
<!-- entities: Data -->
<!-- enforced: tests/lib/threert-scan.test.ts -->
<!-- invariant: 남이 정하고 남이 바꾸는 값은 코드에 박지 않는다 -->

시스템은 ThreeRT 가 무시하는 설정·라이브러리 전용 필드·lux 의심 구간을 upstream 출처 URL·커밋·확인일과 함께 데이터로 가져야 한다.

#### Scenario: 출처와 커밋
- **WHEN** 데이터를 읽는다
- **THEN** `source` 가 `https://` 로 시작하고 `commit` 이 40자 hex, `checkedAt` 이 날짜 형식이다

#### Scenario: 규칙마다 근거가 있다
- **WHEN** 데이터의 `evidence` 를 읽는다
- **THEN** 모든 code 에 upstream 파일 경로가 적혀 있다

### Requirement: ThreeRT 소스에만 적용해야 한다
<!-- id: threertScan.applies -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/threert-scan.test.ts -->

#### Scenario: plain three.js
- **WHEN** 어떤 소스도 `@threert/` 를 import 하지 않는다
- **THEN** `applies` 가 false 이고 위반이 없으며 `unmeasured` 에 사유가 있다

#### Scenario: ThreeRT import
- **WHEN** 한 소스라도 `@threert/` 를 import 한다
- **THEN** 모든 소스를 검사한다

### Requirement: ThreeRT 가 받고 무시하는 three.js 코드를 잡아야 한다
<!-- id: threertScan.silent -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/threert-scan.test.ts -->
<!-- invariant: 0 고정 스텁을 계측으로 읽지 않는다 -->

#### Scenario: 애니메이션 루프
- **WHEN** `renderer.setAnimationLoop(animate)` 가 있다
- **THEN** `threert-animation-loop` 위반이 파일·줄과 함께 나온다. `setAnimationLoop(null)`·`(undefined)` 는 아니다

#### Scenario: info 스텁
- **WHEN** `renderer.info.render.calls` 를 읽는다
- **THEN** `threert-info-stub` 위반이 나온다

#### Scenario: 무시되는 설정
- **WHEN** `renderer.toneMappingExposure = 1.5` 또는 `light.shadow.mapSize…` 에 대입한다
- **THEN** `threert-ignored-setting` 경고가 나온다

### Requirement: setup 의 비결정성을 잡아야 한다
<!-- id: threertScan.setupDeterminism -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/threert-scan.test.ts -->

#### Scenario: setup 안의 Math.random
- **WHEN** `export default function build()` 또는 `defineGame({ setup() {…} })` 본문이 `Math.random()` 을 부른다
- **THEN** `threert-setup-nondeterministic` 위반이 나온다

#### Scenario: 핸들러 안의 Math.random
- **WHEN** setup 밖의 함수가 `Math.random()` 을 부른다
- **THEN** 위반이 아니다 — 핸들러는 런타임이 결정론으로 감싼다

#### Scenario: 진입점이 아닌 같은 이름
- **WHEN** `class TowerManager { build(type) { Math.random() } }` 처럼 진입점이 아닌 setup·build 가 있다
- **THEN** 위반이 아니다 — 진입점은 `export default` 함수와 `defineGame({ setup })` 뿐이다

#### Scenario: 등록만 하는 리스너
- **WHEN** setup 안에서 `ctx.on('tap', () => Math.random())` 또는 이름으로 넘긴 콜백을 등록한다
- **THEN** 위반이 아니다 — 리스너 전달은 런타임이 결정론으로 감싼다

#### Scenario: 주석·문자열
- **WHEN** `Math.random` 이 주석이나 문자열 안에만 있다
- **THEN** 위반이 아니다

### Requirement: 표준 머티리얼에 준 라이브러리 필드와 lux 의심값을 잡아야 한다
<!-- id: threertScan.materialsLights -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/threert-scan.test.ts -->

#### Scenario: 라이브러리 필드
- **WHEN** `new MeshStandardMaterial({ color: 1, wet: 0.8 })`
- **THEN** `threert-library-field` 위반에 `fields: ["wet"]` 가 나온다

#### Scenario: lux 의심값
- **WHEN** `new DirectionalLight(0xffffff, 3)`
- **THEN** `threert-lux-suspect` 경고. `90000` 과 달빛 `0.2` 는 경고가 아니다
