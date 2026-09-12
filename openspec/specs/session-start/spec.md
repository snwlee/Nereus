# session-start

새 컨텍스트가 열릴 때 필요한 상태를 한 번에 주입하는 능력.
진입점: `plugins/nereus/hooks/scripts/session-start.mjs` (`SessionStart` 훅,
matcher `startup|resume|clear|compact`).

Last verified: 2026-09-10 (commit ddda30f)

## Purpose

새 컨텍스트가 열릴 때 handoff·학습·스킬 맵·하네스 상태를 한 번에 주입한다. 세션을 막지 않고, 스스로 아무것도 바꾸지 않는다.

## Requirements

### Requirement: handoff 를 재개 지시와 함께 주입한다
<!-- id: session-start.handle -->
<!-- entities: HandoffDocument, SessionSource -->
<!-- enforced: session-start.mjs handle() -->

세션 디렉터리(또는 레거시 단일 파일)에서 고른 **가장 최근 handoff** 가 있고 내용이 비어 있지 않으면
시스템은 그 본문을 "## Baton 재개" 블록으로 주입해야 한다. 선행 문구는 `source` 에 따라 달라진다.

#### Scenario: clear 이후
- **WHEN** `source` 가 `compact` 가 아니다
- **THEN** `RESUME_CHECKLIST`(러너 실제 실행·git 확인·열린 질문·MUST NOT)를 앞에 붙인다

#### Scenario: compact 이후
- **WHEN** `source` 가 `compact` 다
- **THEN** 검증 체크리스트 없이 짧은 안내만 붙인다

#### Scenario: 읽을 handoff 가 없음
- **WHEN** 후보 파일이 하나도 없다
- **THEN** 본문 없이 이 세션의 handoff 경로만 알린다

### Requirement: compact 에는 반복 주입하지 않는다
<!-- id: session-start.handle -->
<!-- enforced: session-start.mjs handle() -->

스킬 맵과 "Nereus 상태" 블록은 `source` 가 `compact` 일 때 주입하지 않아야 한다.
같은 대화 안에서 이미 주입됐기 때문이다.

#### Scenario: compact
- **WHEN** `source === "compact"`
- **THEN** 출력에 스킬 맵과 상태 블록이 없다

### Requirement: 도구 상태를 캐시로 조회한다
<!-- id: session-start.toolStatusCached -->
<!-- enforced: session-start.mjs toolStatusCached() -->

시스템은 `REQUIRED_TOOLS` 의 미설치 목록을 `<userConfigDir>/tools.json` 에 캐시하고,
`checkedAt` 이 24시간 이내면 재조사 없이 캐시를 써야 한다. 매 세션 8개 바이너리를
PATH 조회하는 비용을 피하기 위해서다.

#### Scenario: 캐시 만료
- **WHEN** `now - checkedAt >= 24시간`
- **THEN** 다시 조사하고 캐시를 갱신한다

#### Scenario: 캐시 파일 손상
- **WHEN** 캐시 파일이 없거나 JSON 파싱에 실패한다
- **THEN** 조용히 재조사한다(fail-open). 훅은 세션을 막지 않는다

### Requirement: 상태 알림은 한 줄씩 모아 한 블록으로 낸다
<!-- id: session-start.handle -->
<!-- enforced: session-start.mjs handle() -->

codegraph 인덱스 부재, 미설치 도구, 검토 대기 학습 후보를 각각 한 줄로 모아
"## Nereus 상태" 한 블록으로 출력해야 한다. 알릴 것이 없으면 블록 자체가 없다.

#### Scenario: 알릴 것 없음
- **WHEN** 인덱스가 있고 도구가 다 깔려 있고 대기 후보가 0건이다
- **THEN** 상태 블록을 내지 않는다

### Requirement: 훅은 실패해도 세션을 막지 않는다
<!-- invariant: 항상 참. 트리거가 없다 -->
<!-- enforced: session-start.mjs -->
<!-- verified_by: tests/hooks/session-start.test.ts -->

파일 읽기·캐시 쓰기 실패는 전부 삼키고 진행한다. 주입할 것이 하나도 없으면
`null` 을 반환한다(빈 페이로드를 내지 않는다).

#### Scenario: 파일 읽기 실패
- **WHEN** handoff 읽기나 캐시 쓰기가 예외를 던진다
- **THEN** 예외를 삼키고 진행하며, 주입할 것이 없으면 null 을 반환한다

### Requirement: 훅은 자동으로 무엇도 변경하지 않는다
<!-- invariant: 항상 참. 트리거가 없다 -->
<!-- enforced: session-start.mjs -->

이 훅은 알림과 컨텍스트 주입만 한다. 사용자 설정이나 프로젝트 파일을 고치지 않는다.
유일한 쓰기는 자기 도구 캐시(`tools.json`)다.

#### Scenario: 훅 1회 실행
- **WHEN** SessionStart 훅이 실행된다
- **THEN** tools.json 캐시 외에 어떤 사용자 설정·프로젝트 파일도 바뀌지 않는다

### Requirement: 새 플러그인 지문이 생겼을 때만 한 줄 알린다
<!-- entities: PluginSnapshot -->

SessionStart 훅은 활성 플러그인 집합의 스냅샷을 `~/.config/nereus/plugin-snapshot.json` 과
비교해, 새로 설치되거나 활성화된 것이 있으면 "## Nereus 상태" 블록에 한 줄을 추가해야 한다.
훅은 어떤 설정도 자동으로 바꾸지 않는다.

#### Scenario: 새 플러그인 설치됨
- **WHEN** 이전 스냅샷에 없던 플러그인이 활성 상태로 발견된다
- **THEN** `새 플러그인 N개 감지 → /nereus:doctor` 한 줄이 상태 블록에 추가되고 스냅샷이 갱신된다

#### Scenario: 변화 없음
- **WHEN** 활성 플러그인 집합이 이전 스냅샷과 같다
- **THEN** 알림 줄을 추가하지 않는다

#### Scenario: 스냅샷 파일 없음 (첫 실행)
- **WHEN** 스냅샷 파일이 없다
- **THEN** 현재 집합을 기준선으로 기록만 하고 알리지 않는다. 첫 실행에 전체를 "새 플러그인"으로 보고하지 않는다

#### Scenario: compact
- **WHEN** `source === "compact"`
- **THEN** 상태 블록 자체를 내지 않는 기존 규칙을 따르며 스냅샷도 갱신하지 않는다

### Requirement: 이 세션이 쓸 handoff 경로를 알린다
<!-- id: session-start.handle -->
<!-- enforced: session-start.mjs handle() -->

모델은 자기 `session_id` 를 모른다. 그래서 시스템은 매 세션 시작에 이 세션이 쓸 handoff 경로를
주입해, 이후 handoff·finish 가 **그 경로에만** 쓰게 해야 한다. 파일을 미리 만들지는 않는다.

#### Scenario: 경로 안내
- **WHEN** 새 컨텍스트가 열린다(`startup`·`resume`·`clear`)
- **THEN** 주입 내용에 `.nereus/handoff/` 아래 이 세션의 경로와 "여기에만 쓴다"는 지시가 들어 있다

#### Scenario: compact 이고 재개할 내용도 없음
- **WHEN** `source` 가 `compact` 이고 읽을 handoff 본문이 없다
- **THEN** 아무것도 주입하지 않는다. 같은 대화가 이어지는 중이라 경로는 이미 알렸다

#### Scenario: 파일을 만들지 않는다
- **WHEN** 훅이 경로를 계산한다
- **THEN** 디스크에 파일을 만들지 않는다. 훅은 스스로 무엇도 바꾸지 않는다

### Requirement: 다른 세션의 최근 활동을 경고한다
<!-- id: session-start.handle -->
<!-- enforced: session-start.mjs handle() -->

최근 30분 안에 **다른 세션**이 갱신한 handoff 가 있으면 시스템은 재개 블록 끝에 경고를 붙여야 한다.
경고에는 파일명과 그 문서의 목표 한 줄을 넣는다. 작업을 막지는 않는다.

#### Scenario: 다른 세션 2개가 활동 중
- **WHEN** 30분 내 갱신된 다른 세션 파일이 2개 있다
- **THEN** 둘의 파일명과 요약을 담은 경고 한 블록이 붙는다

#### Scenario: 조용한 프로젝트
- **WHEN** 다른 세션 파일이 없거나 전부 30분보다 오래됐다
- **THEN** 경고를 붙이지 않는다

#### Scenario: 루프 서브세션
- **WHEN** 환경변수 `NEREUS_LOOP` 이 설정돼 있다
- **THEN** 경고를 생략한다. 반복마다 새 세션이라 매번 뜨는 소음이다
