# baton-loop (델타)

## MODIFIED Requirements

### Requirement: 반복 프롬프트는 디스크 경로만 넘긴다
<!-- id: loop-runner.buildPrompt -->
<!-- entities: HandoffDocument, TasksFile, WaveSummary -->
<!-- enforced: loop-runner.mjs buildPrompt() -->

시스템은 서브세션에게 tasks·spec·wave 요약 디렉터리의 경로와 목표만 주고, 대화 맥락은 넘기지 않아야 한다.
handoff 파일은 **경로를 프롬프트에 박지 않는다** — 세션 시작 훅이 그 세션의 경로를 알려주기 때문이다.
프롬프트는 태스크 하나만 끝내고, 남은 wave 요약을 흡수하고, handoff 를 전체 재작성한 뒤 커밋하라고 지시한다.

#### Scenario: 프롬프트 조립
- **WHEN** `buildPrompt({tasks, spec, waves, goal})` 를 호출한다
- **THEN** 결과에 tasks·spec·waves 경로와 목표가 들어가고, "그 태스크만"·"전체 재작성"·"검증 없이 완료 선언 금지"가 포함된다

#### Scenario: 고정 handoff 경로를 넣지 않는다
- **WHEN** 프롬프트를 조립한다
- **THEN** `.nereus/handoff.md` 같은 고정 파일명이 들어가지 않고, 세션 시작이 알려준 경로를 쓰라고 지시한다

#### Scenario: spec 없음
- **WHEN** `spec` 이 없다
- **THEN** `(없음)` 으로 표기하고 프롬프트는 그대로 조립된다

## ADDED Requirements

### Requirement: wave handoff 를 병합 전에 회수한다
<!-- id: loop-runner.runWave -->
<!-- entities: Worktree, WaveSummary -->
<!-- enforced: loop-runner.mjs runWave() -->

`.nereus/` 는 git 추적 밖이라 워크트리의 handoff 는 커밋으로 따라오지 않고 워크트리와 함께 사라진다.
그래서 시스템은 워크트리를 제거하기 전에 각 워크트리의 최신 handoff 를
`<root>/.nereus/waves/<wave 이름>.md` 로 복사해야 한다. 메인 handoff 를 러너가 직접 편집하지는 않는다.

#### Scenario: 성공한 wave
- **WHEN** 서브세션 2개가 각자 handoff 를 남기고 끝난다
- **THEN** 워크트리 제거 전에 두 파일이 `.nereus/waves/` 로 복사된다

#### Scenario: 실패한 태스크
- **WHEN** 어떤 서브세션이 0 이 아닌 코드로 끝난다
- **THEN** 그 워크트리의 handoff 도 회수한다. 실패한 이유가 거기 적혀 있다

#### Scenario: handoff 를 남기지 않은 워크트리
- **WHEN** 워크트리에 handoff 가 없다
- **THEN** 조용히 건너뛴다. 회수 실패가 wave 결과를 바꾸지 않는다

### Requirement: 루프 서브세션임을 환경에 알린다
<!-- id: loop-runner.defaultRunClaude -->
<!-- enforced: loop-runner.mjs defaultRunClaude() -->

시스템은 서브세션을 띄울 때 환경변수 `NEREUS_LOOP=1` 을 넣어야 한다.
SessionStart 훅이 이 값으로 "다른 세션 활동" 경고를 생략한다.

#### Scenario: 서브세션 스폰
- **WHEN** 러너가 `claude -p` 를 띄운다
- **THEN** 자식 프로세스 환경에 `NEREUS_LOOP=1` 이 있다
