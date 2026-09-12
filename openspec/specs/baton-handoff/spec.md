# baton-handoff

세션 사이로 작업 상태를 넘기는 문서(Baton)의 위치와 수명 규칙.
진입점: `plugins/nereus/hooks/scripts/lib/paths.mjs` (`handoffPath`),
`plugins/nereus/skills/handoff/SKILL.md`, `plugins/nereus/skills/baton/SKILL.md`.

Last verified: 2026-09-12 (commit 0e68a13)

## Purpose

대화 기억이 사라져도 작업이 이어지도록, 현재 상태를 디스크의 한 문서에 적어 다음 컨텍스트에 넘긴다.
진실은 문서·tasks·git 커밋에만 있다.

## Requirements

### Requirement: handoff 경로는 프로젝트 상태 디렉터리에서 결정된다
<!-- id: paths.handoffPath -->
<!-- entities: HandoffDocument -->
<!-- enforced: paths.mjs handoffPath() -->

시스템은 handoff 문서의 경로를 `<cwd>/.nereus/handoff.md` 하나로 결정해야 한다.
경로 계산은 `paths.mjs` 밖에서 하지 않는다.

#### Scenario: 경로 조회
- **WHEN** `handoffPath(cwd)` 를 호출한다
- **THEN** `<cwd>/.nereus/handoff.md` 를 반환한다

#### Scenario: 같은 프로젝트의 두 번째 세션
- **WHEN** 같은 `cwd` 에서 다른 세션이 handoff 를 쓴다
- **THEN** 같은 파일을 가리키므로 나중 쓰기가 앞 내용을 대체한다
<!-- uncertainty: 이 대체는 설계된 동작이 아니라 경로가 세션을 구분하지 않는 데서 오는 결과다 -->

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
<!-- enforced: skills/handoff/SKILL.md 1., skills/baton/SKILL.md -->

handoff 를 갱신할 때 시스템은 문서 전체를 다시 써야 하며 이전 내용에 덧붙이지 않는다.
더 이상 유효하지 않은 항목은 지우지 않고 `[superseded: 이유]` 로 표시한다.

#### Scenario: 갱신
- **WHEN** 새 상태를 기록한다
- **THEN** 목표·현재 단계·완료·진행 중·다음·MUST NOT·판단 기록·결정·열린 질문·테스트 상태가 모두 새로 채워진다

<!-- deferred: 임계값(50%/70%/80%) 동작은 baton-meter capability 로 따로 캔다 -->
