# baton-handoff

> **2026-10-23 변경 — 대화형 handoff 폐지(Removed).** 대화형 세션의 Baton 체인
> (baton-meter 50%/70% 경고·하드 스톱, PreCompact 의 handoff 작성 지시, SessionStart 재개 주입,
> Stop 의 handoff 갱신 알림, finish gate `handoff_stale`, auto-clear, `nereus:handoff`·`nereus:resume`)은 없어졌다.
> 컨텍스트는 Claude Code 자동 압축(`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50`)과 PreCompact 요약 지시가 맡는다.
> 이 문서에 남은 요구사항은 **`nereus:loop` 반복 사이의 handoff 파일**에만 적용된다. 루프 동작 자체는 `baton-loop` spec 이 담당한다.

루프 반복 사이로 작업 상태를 넘기는 문서(Baton)의 위치와 수명 규칙.
진입점: `plugins/nereus/hooks/scripts/lib/paths.mjs` (`handoffPath`),
`plugins/nereus/skills/baton/SKILL.md`.

Last verified: 2026-10-23

## Purpose

루프 반복은 매번 새 세션이라 대화 기억이 없다. 현재 상태를 디스크의 한 문서에 적어 다음 반복에 넘긴다.
진실은 문서·tasks·git 커밋에만 있다.

## Requirements

### Requirement: 상태 디렉터리는 git 추적 밖이다
<!-- id: gitignore.nereus -->
<!-- enforced: .gitignore -->

`.nereus/` 아래는 `config.json` 과 `rules.json` 만 추적하고 나머지는 무시해야 한다.
handoff 는 로컬 상태이지 공유 산출물이 아니다.

#### Scenario: handoff 커밋 시도
- **WHEN** `git add -A` 뒤 커밋한다
- **THEN** `.nereus/handoff.md` 는 커밋에 포함되지 않는다

### Requirement: handoff 는 전체 재작성한다
<!-- id: handoff.SKILL -->
<!-- enforced: skills/baton/SKILL.md -->

handoff 를 갱신할 때 시스템은 문서 전체를 다시 써야 하며 이전 내용에 덧붙이지 않는다.
더 이상 유효하지 않은 항목은 지우지 않고 `[superseded: 이유]` 로 표시한다.

#### Scenario: 갱신
- **WHEN** 새 상태를 기록한다
- **THEN** 목표·현재 단계·완료·진행 중·다음·MUST NOT·판단 기록·결정·열린 질문·테스트 상태가 모두 새로 채워진다

<!-- removed 2026-10-23: 임계값(50%/70%) 동작. baton-meter 는 삭제됐고 자동 압축 50% 가 대신한다 -->

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

#### Scenario: 다음 루프 반복
- **WHEN** 새 반복 세션(새 session_id)이고 자기 파일이 아직 없다
- **THEN** 직전 반복이 마지막으로 쓴 파일을 읽는다

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

#### Scenario: 11번째 반복
- **WHEN** 디렉터리에 11개가 있다
- **THEN** 가장 오래된 1개가 삭제 목록에 들어간다

#### Scenario: 정리 실패
- **WHEN** 삭제가 예외를 던진다
- **THEN** 조용히 삼키고 세션 시작을 계속한다
