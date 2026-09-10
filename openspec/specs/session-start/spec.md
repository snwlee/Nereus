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

`.nereus/handoff.md` 가 있고 내용이 비어 있지 않으면 시스템은 그 본문을
"## Baton 재개" 블록으로 주입해야 한다. 선행 문구는 `source` 에 따라 달라진다.

#### Scenario: clear 이후
- **WHEN** `source` 가 `compact` 가 아니다
- **THEN** `RESUME_CHECKLIST`(러너 실제 실행·git 확인·열린 질문·MUST NOT)를 앞에 붙인다

#### Scenario: compact 이후
- **WHEN** `source` 가 `compact` 다
- **THEN** 검증 체크리스트 없이 짧은 안내만 붙인다. 대화가 이어지므로 이미 검증된 상태다

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

