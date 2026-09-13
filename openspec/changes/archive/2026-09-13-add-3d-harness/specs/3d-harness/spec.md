## ADDED Requirements

### Requirement: 텍스처 슬롯 목록은 출처와 함께 데이터여야 한다
<!-- id: three.slotData -->
<!-- entities: Data -->
<!-- enforced: tests/lib/three-budget-data.test.ts -->
<!-- invariant: 남이 정하고 남이 바꾸는 값은 코드에 박지 않는다 -->

시스템은 three.js 머티리얼의 텍스처 슬롯 목록을 출처 URL·확인일과 함께 데이터로 가져야 한다.

#### Scenario: 슬롯 목록이 데이터다
- **WHEN** 데이터를 읽는다
- **THEN** `textureSlots` 에 `map` 과 `normalMap` 이 들어 있고 항목이 여덟 이상이다

#### Scenario: 출처와 확인일
- **WHEN** 데이터의 메타를 읽는다
- **THEN** `source` 가 `https://` 로 시작하고 `checkedAt` 이 날짜 형식이다

#### Scenario: 왜 데이터인지 적혀 있다
- **WHEN** 데이터를 읽는다
- **THEN** `textureSlotsWhy` 가 비어 있지 않다

### Requirement: 불완전한 dispose 를 정적으로 잡아야 한다
<!-- id: sceneScan.incompleteDispose -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/scene-scan.test.ts -->
<!-- invariant: 속성 순회는 슬롯 나열보다 강하다 -->

시스템은 머티리얼을 dispose 하는 함수 본문을 보고, 텍스처 슬롯 일부만 정리하는 것을
위반으로 보고해야 한다. 빠진 슬롯의 텍스처는 GPU 에 남고 아무 에러도 나지 않는다.

#### Scenario: map 만 정리한다
- **WHEN** 함수가 `material.dispose()` 를 부르면서 `material.map` 만 정리한다
- **THEN** 위반 코드 `incomplete-dispose` 와 빠진 슬롯 목록이 나온다

#### Scenario: 속성을 순회한다
- **WHEN** 함수 본문이 `isTexture` 로 속성을 순회한다
- **THEN** 위반이 없다 — 새 슬롯이 추가돼도 자동으로 덮인다

#### Scenario: 슬롯을 전부 나열한다
- **WHEN** 함수가 데이터의 모든 슬롯을 명시적으로 정리한다
- **THEN** 위반은 없지만 `unmeasured` 에 슬롯 목록 확인일 기준임이 남는다

#### Scenario: 머티리얼을 dispose 하지 않는 함수
- **WHEN** 함수가 지오메트리만 dispose 한다
- **THEN** 이 검사의 대상이 아니다

### Requirement: 정의만 되고 배선되지 않은 dispose 를 잡아야 한다
<!-- id: sceneScan.disposeUnwired -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/scene-scan.test.ts -->

시스템은 dispose 헬퍼가 선언되었는데 호출되지 않거나 한 곳에서만 호출되는 것을
보고해야 한다. 선언은 정리가 된다는 착각을 만든다.

#### Scenario: 호출이 없다
- **WHEN** dispose 헬퍼가 정의만 되고 어디서도 호출되지 않는다
- **THEN** 위반 코드 `dispose-unwired` 가 함수 이름과 함께 나온다

#### Scenario: 호출이 있다
- **WHEN** 헬퍼가 자기 정의 밖에서 호출된다
- **THEN** 위반이 없다

#### Scenario: 호출 수를 같이 낸다
- **WHEN** 헬퍼가 호출된다
- **THEN** 결과에 그 헬퍼의 호출 지점 수가 들어 있다

### Requirement: 계측이 없으면 측정 불가를 보고해야 한다
<!-- id: sceneScan.instrumentation -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/scene-scan.test.ts -->
<!-- invariant: 계측 부재를 통과로 읽지 않는다 -->

시스템은 소스 어디에서도 `renderer.info` 를 읽지 않으면 보고해야 한다.
읽는 곳이 없으면 드로우콜도 GPU 메모리도 **측정 자체가 불가능**하다.

#### Scenario: 계측이 없다
- **WHEN** 소스 어디에서도 `renderer.info` 를 읽지 않는다
- **THEN** 위반 코드 `instrumentation-missing` 이 나온다

#### Scenario: 계측이 있다
- **WHEN** 어떤 파일이 `renderer.info` 를 읽는다
- **THEN** 위반이 없다

### Requirement: 정적 검사가 놓치는 것을 결과에 실어야 한다
<!-- id: sceneScan.unmeasured -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/scene-scan.test.ts -->

정규식 기반 검사가 구조적으로 못 잡는 것을 결과에 함께 내야 한다.
검사기가 다 본다고 믿게 만드는 것이 아무것도 안 보는 것보다 나쁘다.

#### Scenario: 파서가 아님을 밝힌다
- **WHEN** 검사를 돌린다
- **THEN** `unmeasured` 에 AST 파서가 아니라는 항목이 항상 들어 있다

#### Scenario: 항목마다 이유가 있다
- **WHEN** `unmeasured` 를 읽는다
- **THEN** 각 항목이 무엇을 못 봤는지와 왜인지를 갖는다

### Requirement: 렌더 예산은 기준이 있을 때만 판정해야 한다
<!-- id: renderBudget.targets -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/render-budget.test.ts -->
<!-- invariant: 기준을 지어내지 않는다 -->

시스템은 드로우콜·삼각형·지오메트리·텍스처 예산을 입력으로 받아야 하며,
주지 않은 축은 판정하지 않고 그 사실을 보고해야 한다.

#### Scenario: 기준을 주고 초과한다
- **WHEN** 드로우콜 상한을 주고 증거가 그것을 넘는다
- **THEN** 위반 코드 `budget-exceeded` 가 축·값·상한과 함께 나온다

#### Scenario: 기준을 주고 통과한다
- **WHEN** 드로우콜 상한을 주고 증거가 그 이하다
- **THEN** 그 축에 위반이 없다

#### Scenario: 기준이 없다
- **WHEN** 예산을 하나도 주지 않는다
- **THEN** 위반이 없고 `unmeasured` 에 어느 축을 판정하지 않았는지 나온다

#### Scenario: 증거가 없다
- **WHEN** 표본을 하나도 주지 않는다
- **THEN** 던지지 않고 `unmeasured` 에 증거 부재를 싣는다

### Requirement: 누수는 같은 상태의 두 표본을 비교해 판정해야 한다
<!-- id: renderBudget.leak -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/render-budget.test.ts -->
<!-- invariant: 단발 스냅샷으로 누수를 판정하지 않는다 -->

시스템은 같은 라벨의 표본이 둘 이상일 때만 증가를 누수로 보고해야 한다.
수가 크다는 것은 누수가 아니라 큰 씬일 수 있다.

#### Scenario: 같은 라벨에서 늘었다
- **WHEN** 같은 라벨의 두 표본에서 지오메트리 수가 늘었다
- **THEN** 위반 코드 `leak-suspected` 가 라벨·축·두 값과 함께 나온다

#### Scenario: 같은 라벨에서 안 늘었다
- **WHEN** 같은 라벨의 두 표본이 같은 수다
- **THEN** 위반이 없다

#### Scenario: 표본이 하나뿐이다
- **WHEN** 각 라벨의 표본이 하나씩이다
- **THEN** 누수를 판정하지 않고 `unmeasured` 에 그 사실을 싣는다

#### Scenario: 수가 커도 누수가 아니다
- **WHEN** 표본이 하나이고 지오메트리 수가 매우 크다
- **THEN** `leak-suspected` 가 나오지 않는다

### Requirement: 3D 플러그인은 단독으로 동작하고 이름이 겹치지 않아야 한다
<!-- id: threePlugin.wiring -->
<!-- entities: Plugin, Skill, Agent -->
<!-- enforced: tests/smoke/three-wiring.test.ts -->

`nereus-3d` 는 다른 플러그인을 전제하지 않고, 모든 스킬이 라우트를 가지며,
스킬·에이전트 이름이 다섯 플러그인 사이에서 겹치지 않아야 한다.

#### Scenario: 등재와 매니페스트
- **WHEN** 마켓플레이스 매니페스트를 읽는다
- **THEN** `nereus-3d` 항목이 있고 매니페스트의 이름·버전과 같다

#### Scenario: 모든 스킬이 라우트를 갖는다
- **WHEN** 스킬 디렉터리를 확장 선언과 대조한다
- **THEN** 라우트가 없는 스킬이 없다

#### Scenario: 대표어 단독을 잡지 않는다
- **WHEN** 각 라우트의 정규식에 `3D` 또는 `씬` 또는 `렌더` 한 단어만 넣는다
- **THEN** 어느 라우트도 매치하지 않는다

#### Scenario: 이름 충돌 없음
- **WHEN** 다섯 플러그인의 이름을 종류별로 모은다
- **THEN** 각 종류 안에 중복이 없다

#### Scenario: 다른 플러그인을 import 하지 않는다
- **WHEN** `nereus-3d` 의 모든 소스에서 import 지정자를 뽑는다
- **THEN** 다른 플러그인이나 코어 내부 모듈을 가리키는 지정자가 없다

### Requirement: 검사기는 프로세스 진입점으로 돌아야 한다
<!-- id: threePlugin.cliEntry -->
<!-- entities: Checker -->
<!-- enforced: tests/smoke/three-rig.test.ts -->

두 검사기는 stdin JSON 을 받아 stdout JSON 을 내는 프로세스로 동작해야 하며,
깨진 입력에는 스택트레이스 없이 사유만 내고 0 이 아닌 코드로 끝나야 한다.

#### Scenario: 정적 검사기 진입점
- **WHEN** map 만 정리하는 소스를 넣는다
- **THEN** stdout JSON 에 `incomplete-dispose` 가 있다

#### Scenario: 예산 검사기 진입점
- **WHEN** 상한을 넘는 표본을 넣는다
- **THEN** stdout JSON 에 `budget-exceeded` 가 있다

#### Scenario: 빈 입력
- **WHEN** 입력을 주지 않는다
- **THEN** 0바이트가 아니라 유효한 JSON 이 나온다

#### Scenario: 깨진 입력
- **WHEN** JSON 이 아닌 입력을 넣는다
- **THEN** 0 이 아닌 코드로 끝나고 stderr 에 스택 프레임이 없다

### Requirement: 도너 저장소에서 실제 결함을 잡아야 한다
<!-- id: threePlugin.donorProof -->
<!-- entities: Checker -->
<!-- enforced: tests/smoke/three-donor.test.ts -->
<!-- invariant: 픽스처 초록을 검증으로 치지 않는다 -->

검사기는 하네스가 만든 픽스처가 아니라 **실제 프로젝트 산출물**에서 결함을 잡아야 한다.
단위 테스트가 전부 초록인데 실제 프로젝트에서 한 번도 발동하지 않는 것을 이미 겪었다.

#### Scenario: 도너의 불완전 dispose
- **WHEN** 도너 저장소의 three.js 소스를 검사한다
- **THEN** `incomplete-dispose` 가 나오고 빠진 슬롯에 `normalMap` 이 들어 있다

#### Scenario: 도너의 계측 부재
- **WHEN** 같은 소스를 검사한다
- **THEN** `instrumentation-missing` 이 나온다

#### Scenario: 도너가 없으면 건너뛴다
- **WHEN** 도너 경로가 이 기기에 없다
- **THEN** 테스트가 실패하지 않고 건너뛴 사실을 남긴다
