# spec-tool-selection

새 작업을 어떤 스펙 도구로 진행할지 고르는 판정.
진입점: `plugins/nereus/skills/spec/scripts/classify.mjs`, `plugins/nereus/skills/intake/SKILL.md`.

Last verified: 2026-09-12 (commit 3245e18)

## Purpose

프로젝트가 신규인지 기존 코드베이스인지 보고 spec-kit 과 OpenSpec 중 하나를 고른다.
판정은 읽기 전용이고, 사용자에게 다시 묻지 않는다.

## Requirements

### Requirement: 진행 중인 도구가 있으면 그것을 따른다
<!-- id: classify.classify -->
<!-- entities: ProjectKind, SpecTool -->
<!-- enforced: classify.mjs classify() -->

`openspec/` 이 있으면 brownfield/OpenSpec, `.specify/` 가 있으면 greenfield/spec-kit 으로 판정해야 한다.
이미 시작한 도구를 바꾸지 않기 위해서다. `openspec/` 이 우선한다.

#### Scenario: openspec 디렉터리 존재
- **WHEN** `openspec/` 이 있다
- **THEN** `{ kind: "brownfield", tool: "openspec", onboard: false }` 를 반환한다

### Requirement: 소스와 커밋 수로 기존 코드베이스를 가린다
<!-- id: classify.classify -->
<!-- enforced: classify.mjs classify() -->

도구 디렉터리가 없으면 소스 존재와 커밋 수로 판정해야 한다.
소스가 있고 커밋이 10개 이상이면 brownfield/OpenSpec 이고 역스펙화가 필요하다(`onboard: true`).
그 외는 greenfield/spec-kit 이다.

#### Scenario: 커밋이 적은 저장소
- **WHEN** 소스는 있으나 커밋이 10개 미만이다
- **THEN** greenfield/spec-kit 으로 본다. 초기 단계이므로 역스펙을 캘 것이 없다

#### Scenario: 판정 근거를 남긴다
- **WHEN** 어떤 경로로 판정하든
- **THEN** `reason` 에 사람이 읽을 근거 문자열이 들어 있다

### Requirement: 판정은 읽기 전용이다
<!-- id: classify.classify -->
<!-- enforced: classify.mjs — fs 는 exists/readdir 만, git 은 rev-list --count -->
<!-- invariant -->

판정은 파일을 만들거나 바꾸지 않아야 한다. 디렉터리 존재 확인, 파일 목록 읽기, 커밋 수 세기만 한다.

#### Scenario: 읽기 실패
- **WHEN** 디렉터리를 읽을 수 없다
- **THEN** 소스 없음으로 보고 계속한다. 예외를 밖으로 내보내지 않는다

<!-- deferred: 규모(small/medium/large) 축과 인터뷰 필요 여부는 현재 어떤 코드에도 없다. intake/SKILL.md 산문에만 있다 -->
