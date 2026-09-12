# baton-loop

사람이 보지 않는 동안 태스크를 하나씩 끝내는 reset 루프.
진입점: `plugins/nereus/skills/baton/scripts/loop-runner.mjs`.

Last verified: 2026-09-12 (commit 0e68a13)

## Purpose

반복마다 컨텍스트를 버린 새 `claude -p` 세션을 띄워 미완료 태스크 하나(또는 한 wave)를 끝내고 커밋한다.
세션 사이에 기억은 넘기지 않는다 — 상태는 handoff·tasks·git 에만 있다.

## Requirements

### Requirement: 반복 프롬프트는 디스크 경로만 넘긴다
<!-- id: loop-runner.buildPrompt -->
<!-- entities: HandoffDocument, TasksFile -->
<!-- enforced: loop-runner.mjs buildPrompt() -->

시스템은 서브세션에게 handoff·tasks·spec 의 경로와 목표만 주고, 대화 맥락은 넘기지 않아야 한다.
프롬프트는 태스크 하나만 끝내고 handoff 를 전체 재작성한 뒤 커밋하라고 지시한다.

#### Scenario: 프롬프트 조립
- **WHEN** `buildPrompt({handoff, tasks, spec, goal})` 를 호출한다
- **THEN** 결과에 세 경로와 목표가 모두 들어가고, "그 태스크만"·"전체 재작성"·"검증 없이 완료 선언 금지"가 포함된다

#### Scenario: spec 없음
- **WHEN** `spec` 이 없다
- **THEN** `(없음)` 으로 표기하고 프롬프트는 그대로 조립된다

### Requirement: 최소 들여쓰기 체크박스만 태스크다
<!-- id: loop-runner.parseTasks -->
<!-- enforced: loop-runner.mjs parseTasks() -->

시스템은 체크박스 줄 중 들여쓰기가 가장 얕은 것만 태스크로 세야 한다.
중첩 스텝 체크박스를 태스크로 세면 반복이 스텝 단위로 쪼개지고 wave 인접 규칙이 깨진다.

#### Scenario: 중첩 스텝이 있는 tasks.md
- **WHEN** 태스크 아래 들여쓴 스텝 체크박스가 여러 개 있다
- **THEN** 태스크만 반환되고 스텝은 무시된다

#### Scenario: 잘못된 wave 태그
- **WHEN** `[wave:0]` 처럼 1 미만이거나 정수가 아닌 값이 붙어 있다
- **THEN** 오타로 보고 태그를 무시한다(`wave: null`)

### Requirement: 인접한 같은 wave 번호만 묶는다
<!-- id: loop-runner.planWaves -->
<!-- enforced: loop-runner.mjs planWaves() -->

시스템은 선언 순서에서 **인접한** 같은 wave 번호만 한 그룹으로 묶어야 한다.
떨어져 있는 같은 번호를 합치면 사이의 태스크를 앞질러 실행한다. 태그가 없으면 단독 그룹이다.

#### Scenario: 태그 없는 tasks
- **WHEN** 어떤 태스크에도 wave 태그가 없다
- **THEN** 그룹 크기는 전부 1 이고 기존 순차 동작과 같다

### Requirement: 2개 이상 병렬은 워크트리로 격리하고 순차 병합한다
<!-- id: loop-runner.runWave -->
<!-- entities: Worktree -->
<!-- enforced: loop-runner.mjs runWave() -->

그룹이 2개 이상이면 시스템은 각 태스크를 `.nereus/worktrees/wave-<i>-<slug>` 워크트리와
`baton/<이름>` 브랜치로 격리해 동시에 돌리고, 커밋을 마친 뒤 **순차로** 병합해야 한다.
그룹이 1개면 메인 워크트리에서 그대로 돈다.

#### Scenario: 병합 충돌
- **WHEN** 어떤 브랜치의 병합이 충돌한다
- **THEN** `merge --abort` 로 저장소를 되돌리고, 브랜치는 지우지 않은 채 `conflict` 로 루프를 멈춘다

#### Scenario: 실패한 태스크
- **WHEN** 어떤 서브세션이 0 이 아닌 코드로 끝난다
- **THEN** 그 워크트리는 커밋도 병합도 하지 않고 건너뛴다

### Requirement: 워크트리는 결과와 무관하게 정리한다
<!-- id: loop-runner.runWave -->
<!-- enforced: loop-runner.mjs runWave() finally -->

생성된 워크트리는 성공·실패·예외 어느 경우에도 제거되어야 한다.
남으면 다음 실행의 `worktree add` 가 경로 충돌로 실패한다.

#### Scenario: 중간 실패
- **WHEN** 병합 도중 오류로 조기 반환한다
- **THEN** 그때까지 만든 워크트리가 모두 제거된다

### Requirement: 서브세션 권한은 열거된 목록을 넘지 않는다
<!-- id: loop-runner.resolveAllowedTools -->
<!-- enforced: loop-runner.mjs LOOP_ALLOWED_TOOLS, FORBIDDEN_IN_EXTRAS -->
<!-- invariant -->

서브세션에는 테스트 러너와 `git add`·`commit`·읽기 전용 git 만 허용해야 한다.
사용자가 `loop.extraAllowedTools` 로 더할 수 있으나 `git push`·`bypassPermissions`·`--dangerously` 는
어떤 경로로도 들어갈 수 없다.

#### Scenario: 금지 항목을 extras 로 넣으려 함
- **WHEN** `loop.extraAllowedTools` 에 `Bash(git push:*)` 가 들어 있다
- **THEN** 그 항목만 걸러지고 나머지는 더해진다

<!-- deferred: runLoop 의 게이트·stuck·수렴 판정은 이번 사이클에서 캐지 않는다 -->
