# session-start (델타)

## ADDED Requirements

### Requirement: 되묻지 않는다는 규칙을 매 세션 주입한다
<!-- id: session-start.handle -->
<!-- enforced: session-start.mjs ASK_POLICY -->

시스템은 새 컨텍스트마다 한 줄 정책을 주입해야 한다:
순서·우선순위·착수 승인은 묻지 않고 스스로 정해 끝까지 한다. 질문은 하네스가 알 수 없는 정보와
외부로 나가는 행동에만 쓴다. 스킬 문서에만 적으면 그 스킬을 부르지 않은 턴에는 적용되지 않기 때문이다.

#### Scenario: 새 컨텍스트
- **WHEN** `source` 가 `compact` 가 아니다
- **THEN** 주입 내용에 그 정책 한 줄이 들어 있다

#### Scenario: compact
- **WHEN** `source` 가 `compact` 다
- **THEN** 다시 주입하지 않는다. 같은 대화에 이미 들어 있다
