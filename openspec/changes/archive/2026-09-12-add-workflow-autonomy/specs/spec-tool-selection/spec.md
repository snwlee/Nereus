# spec-tool-selection (델타)

## ADDED Requirements

### Requirement: 규모와 신규·수정 축으로 작업 계획을 한 번에 정한다
<!-- id: plan.planWork -->
<!-- entities: ProjectKind, SpecTool, WorkSize, InterviewDepth -->
<!-- enforced: plan.mjs planWork() -->

시스템은 규모(`small`·`medium`·`large`)와 `classify()` 의 신규/수정 판정을 곱해
인터뷰 강도, 스펙 도구, 역스펙 필요 여부, PRD 여부를 한 번에 결정해야 한다.
결정이 흩어져 있으면 intake 가 규모와 무관하게 인터뷰를 돌게 된다.

| | greenfield | brownfield |
|---|---|---|
| small | none · tasks-only · 역스펙 ✗ | none · tasks-only · 역스펙 ✗ |
| medium | short · spec-kit · 역스펙 ✗ | **none** · openspec · 역스펙 ✓ |
| large | full + PRD · spec-kit · 역스펙 ✗ | short · openspec · 역스펙 ✓ |

#### Scenario: 기존 코드베이스의 중간 규모 작업
- **WHEN** `size` 가 `medium` 이고 `classify` 가 brownfield 를 준다
- **THEN** `interview: "none"`, `specTool: "openspec"`, `reverseSpec: true` 를 반환한다. 요구는 코드에 있고 역스펙이 답한다

#### Scenario: 작은 수정
- **WHEN** `size` 가 `small` 이다
- **THEN** 신규·수정과 무관하게 `interview: "none"`, `specTool: "tasks-only"`, `reverseSpec: false` 다. spec 단계 자체는 건너뛰지 않는다

#### Scenario: 새 제품
- **WHEN** `size` 가 `large` 이고 greenfield 다
- **THEN** `interview: "full"` 이고 `prd: true` 다

#### Scenario: 규모를 주지 않음
- **WHEN** `size` 가 없거나 알 수 없는 값이다
- **THEN** `medium` 으로 본다. 모르면 중간이 가장 덜 틀린다

#### Scenario: classify 결과를 보존한다
- **WHEN** `planWork` 가 결과를 만든다
- **THEN** `classify` 의 `kind`·`tool`·`reason` 이 그대로 실려 있다. 기존 호출자가 깨지지 않는다

### Requirement: 계획은 사용자 확인 없이 확정된다
<!-- id: plan.planWork -->
<!-- enforced: plan.mjs planWork(), intake/SKILL.md -->

시스템은 판정 결과를 사용자에게 한 줄로 **알리고 그대로 진행해야** 한다. 다른 판단을 원하는지 묻지 않는다.
사용자가 `--tool` 이나 `--size` 를 명시하면 그것을 따른다.

#### Scenario: 판정 직후
- **WHEN** 계획이 정해진다
- **THEN** 확인 질문 없이 다음 단계로 넘어간다
