## ADDED Requirements

### Requirement: 리뷰 대상을 기능 범위와 구현 범위로 나눠야 한다
<!-- id: goldfish.target -->
<!-- entities: ReviewTarget -->
<!-- enforced: plugins/nereus/skills/goldfish/scripts/goldfish.mjs resolveTarget() findSplit() -->

시스템은 OpenSpec change 디렉터리, spec-kit 기능 디렉터리, 단일 md 파일을 받아 기능 범위(Feature)와
구현 범위(Detailed)를 정해야 한다. 기능 범위만 있는 문서는 구현 범위를 비운다.

#### Scenario: OpenSpec change
- **WHEN** 대상이 `proposal.md` 를 가진 디렉터리다
- **THEN** proposal·design·specs 는 Feature, tasks.md 는 Detailed 다

#### Scenario: 단일 문서의 구현 계획 헤더
- **WHEN** 문서에 `## Implementation Plan`·`## 구현 계획`·`## Tasks` 류 헤더가 하나 있다
- **THEN** 그 줄 앞은 Feature, 그 줄부터 끝까지는 Detailed 다

#### Scenario: 헤더가 여럿
- **WHEN** 구현 계획 헤더가 둘 이상이다
- **THEN** 첫 헤더로 나누고 `ambiguous` 를 표시한다

### Requirement: 모드가 도는 단계를 정해야 한다
<!-- id: goldfish.modes -->
<!-- entities: ReviewMode -->
<!-- enforced: goldfish.mjs stagesFor() planReview() -->

모드는 `full`(5~9), `feature`(5~8), `implementation`(9) 셋뿐이다. Feature 범위는 7단계, Detailed 범위는 9단계,
둘 다는 6단계가 읽는다. 5·8단계는 문서 전체를 읽는다.

#### Scenario: 구현 범위 없음
- **WHEN** Detailed 가 비어 있고 모드가 `full` 이다
- **THEN** `feature` 로 낮추고 notes 에 적는다. `implementation` 이면 거부한다

### Requirement: 문서가 가리키는 작업 디렉터리 안 파일만 리뷰어 맥락에 자동으로 넣어야 한다
<!-- id: goldfish.links -->
<!-- entities: GoldfishContext -->
<!-- enforced: goldfish.mjs collectLinks() -->

#### Scenario: 링크 분류
- **WHEN** 문서에 상대 링크·앵커·URL·작업 디렉터리 밖 링크가 섞여 있다
- **THEN** 앵커는 버리고, 안쪽의 존재하는 파일만 `inside` 로, 나머지는 `outside`·`urls` 로 나눈다

### Requirement: 라운드 수렴을 결정론으로 판정해야 한다
<!-- id: goldfish.judge -->
<!-- entities: Ledger, Finding -->
<!-- enforced: goldfish.mjs judgeRound() -->

발견의 키는 `영향 범위|제목` 을 소문자로 이은 것이다(원본의 "같은 범위, 같은 이슈"). 미실행(not run)은 리뷰어가
시간 초과·실패·빈 응답으로 한 번 재시도 뒤에도 보고서를 내지 못한 것이다.
clean 라운드는 정착되지 않은 차단 발견(Nit·Minor·Low 가 아닌 것), 미실행 리뷰어, 형식이 어긋난 발견 제목이 모두 없는 라운드다.
연속 2회 clean 이면 수렴, 5라운드에서 수렴하지 않으면 상한이다 — 상한에서는 남은 발견을 보이고 사용자에게
수용·계속·spec 으로 되돌림 중 하나를 묻는다. 고친 발견이 같은 키로 다시 나오면 재개방한다.

#### Scenario: 미실행 리뷰어
- **WHEN** 리뷰어 하나가 not run 이다
- **THEN** 그 라운드는 발견이 없어도 clean 이 아니다

#### Scenario: 정착된 발견
- **WHEN** CONTEST·DECLINE 으로 정착된 발견이 다시 나온다
- **THEN** clean 판정을 막지 않는다

#### Scenario: 모르는 심각도·어긋난 형식
- **WHEN** 발견의 심각도가 Critical 처럼 목록에 없거나, 발견 절의 `###` 제목이 형식과 다르다
- **THEN** 막는 쪽으로 센다 — 조용히 clean 이 되지 않는다

#### Scenario: 고친 발견의 재등장
- **WHEN** PROPOSE FIX 로 고친 발견이 같은 키로 다시 나온다
- **THEN** `reopened` 에 싣고 clean 이 아니다

### Requirement: 문서 참조의 존재를 기계로 판정해야 한다
<!-- id: drift.refs -->
<!-- entities: DocRef -->
<!-- enforced: plugins/nereus/skills/drift/scripts/drift.mjs -->

#### Scenario: 사라진 파일
- **WHEN** 문서가 백틱이나 링크로 가리킨 경로가 문서 폴더와 저장소 루트 어느 쪽에도 없다
- **THEN** `missingPaths` 에 싣는다

#### Scenario: 사라진 심볼
- **WHEN** 문서가 호출 형태(`name()`, `Obj.name()`)로 적은 이름이 문서를 뺀 저장소에 단어로 없다
- **THEN** `missingSymbols` 에 싣는다. 저장소가 아니라 찾을 수 없으면 `uncheckedSymbols` 이고 없다고 하지 않는다

#### Scenario: 플러그인 기준 상대 경로
- **WHEN** 경로가 문서 폴더·루트에는 없지만 저장소 파일 하나의 접미사와 맞는다
- **THEN** 존재로 친다

#### Scenario: 코드 예시 안의 이름
- **WHEN** 이름이 펜스 코드 블록 안에만 있다
- **THEN** 참조로 뽑지 않는다
