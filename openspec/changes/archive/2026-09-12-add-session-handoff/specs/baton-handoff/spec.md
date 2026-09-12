# baton-handoff (델타)

## REMOVED Requirements

### Requirement: handoff 경로는 프로젝트 상태 디렉터리에서 결정된다

세션을 구분하지 않는 단일 경로였다. 아래 "handoff 경로는 세션마다 다르다"로 대체된다.

## ADDED Requirements

### Requirement: handoff 경로는 세션마다 다르다
<!-- id: paths.sessionHandoffPath -->
<!-- entities: HandoffDocument, Session -->
<!-- enforced: paths.mjs sessionHandoffPath() -->

시스템은 세션마다 다른 handoff 파일을 써야 한다. 경로는
`<cwd>/.nereus/handoff/<YYYYMMDD-HHmm>-<session_id 앞 8자>.md` 이고,
경로 계산은 `paths.mjs` 밖에서 하지 않는다.

#### Scenario: 새 세션
- **WHEN** 디렉터리에 이 세션의 `sid8` 을 가진 파일이 없다
- **THEN** 세션 시작 시각과 `sid8` 로 새 이름을 만든다

#### Scenario: compact 이후 같은 세션
- **WHEN** 디렉터리에 같은 `sid8` 파일이 이미 있다
- **THEN** 새로 만들지 않고 그 경로를 그대로 쓴다

#### Scenario: session_id 없음
- **WHEN** 입력에 `session_id` 가 없다
- **THEN** `nosession` 을 식별자로 써서 경로를 만든다. 훅은 세션을 막지 않는다

#### Scenario: 같은 프로젝트의 두 번째 세션
- **WHEN** 같은 `cwd` 에서 다른 세션이 handoff 를 쓴다
- **THEN** 파일이 다르므로 첫 세션의 내용은 그대로 남는다

### Requirement: 읽기는 가장 최근 handoff 하나다
<!-- id: paths.latestHandoff -->
<!-- enforced: paths.mjs latestHandoff() -->

재개할 때 시스템은 세션 디렉터리에서 **mtime 이 가장 늦은** 파일 하나를 골라야 한다.
mtime 이 같으면 파일명 내림차순으로 깬다. 파일명의 시각은 세션 **시작** 시각이라
마지막 쓰기 순서와 다를 수 있기 때문이다.

#### Scenario: 자기 세션 파일이 있을 때
- **WHEN** 이 세션이 이미 handoff 를 썼다
- **THEN** 그것이 최신이므로 자기 것을 읽는다

#### Scenario: `/clear` 직후
- **WHEN** 새 session_id 이고 자기 파일이 아직 없다
- **THEN** 직전 세션이 마지막으로 쓴 파일을 읽는다

#### Scenario: 레거시 단일 파일만 있음
- **WHEN** `.nereus/handoff/` 가 비었고 `.nereus/handoff.md` 가 있다
- **THEN** 레거시 파일을 읽는다. 쓰기는 새 세션 경로로 한다

#### Scenario: 아무것도 없음
- **WHEN** 후보가 하나도 없다
- **THEN** `null` 을 반환하고 재개 블록의 본문은 비워 둔다

### Requirement: 오래된 handoff 를 정리한다
<!-- id: paths.planHandoffPrune -->
<!-- enforced: paths.mjs planHandoffPrune() -->

시스템은 세션 handoff 를 최근 10개까지만 유지하고, mtime 이 30일보다 오래된 것은 지워야 한다.
지금 세션이 쓸 파일과 방금 주입한 파일은 어떤 경우에도 삭제 대상이 아니다.

#### Scenario: 11번째 세션
- **WHEN** 디렉터리에 11개가 있다
- **THEN** 가장 오래된 1개가 삭제 목록에 들어간다

#### Scenario: 정리 실패
- **WHEN** 삭제가 예외를 던진다
- **THEN** 조용히 삼키고 세션 시작을 계속한다
