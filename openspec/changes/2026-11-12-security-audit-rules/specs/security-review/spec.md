# security-review

security 에이전트의 판정과 반증 검증을 정한다.

## ADDED Requirements

### Requirement: security 의 차단 지적은 반증 검증을 거친다
<!-- id: security.refutation -->
<!-- entities: Reviewer, Finding -->
<!-- enforced: tests/skills/security-rules.test.ts -->

security 출처의 CRITICAL/HIGH 는 발견한 맥락이 아닌 새 서브에이전트가 반박한다. `confirmed` 는 차단을 유지하고 심각도는 내려갈 수만 있다.
`rejected` 는 findings 에서 빠지고 사유가 보존된다. `needs_validation` 은 심각도 대신 `NEEDS_VALIDATION` 이 되어 게이트를 막지 않는다. 판정이 없거나 모르는 판정이면 차단을 유지한다.

#### Scenario: 오탐
- **WHEN** 반증자가 상위 미들웨어가 막는다며 rejected 를 낸다
- **THEN** 그 항목은 게이트에서 빠지고 사유와 함께 rejected 목록에 남는다

#### Scenario: 반증 실패
- **WHEN** 반증자가 판정을 돌려주지 않는다
- **THEN** 항목은 원래 심각도로 차단을 유지한다

### Requirement: security 판정은 경계와 결과를 요구한다
<!-- id: security.boundaryRule -->
<!-- entities: Agent -->
<!-- enforced: tests/skills/security-rules.test.ts -->

security 에이전트 문서는 경계+결과 요건, 심각도 기준표, `needs_validation` 규칙, 도메인 참고 경로를 적는다. 가져온 문서는 출처와 MIT 표기를 남긴다.

#### Scenario: 심층 방어 부재
- **WHEN** 다른 층이 이미 막는 공격에 대해 한 겹이 없다는 지적이 나온다
- **THEN** 강화 권고(LOW)로 기록되고 차단하지 않는다

### Requirement: 외부 스킬 설치 게이트는 실제 skillspector 보고서를 판정한다
<!-- id: skillAudit.scanGate -->
<!-- entities: InstallGate -->
<!-- enforced: tests/skills/skill-tooling.test.ts -->

`scanGate` 는 `issues`(이전 `findings`)의 critical/high 로 차단한다. 실행 실패·형식 깨짐은 차단(fail-closed), 불완전 분석은 통과시키되 `incomplete` 로 알린다.

#### Scenario: 실제 보고서
- **WHEN** skillspector 2.11 이 `--format json` 으로 낸 보고서에 HIGH 가 있다
- **THEN** 설치가 차단되고 CLI 종료 코드는 1 이다

### Requirement: 플러그인 frontmatter 는 엄격한 YAML 로 읽힌다
<!-- id: plugin.strictFrontmatter -->
<!-- entities: Skill, Agent -->
<!-- enforced: tests/skills/skill-tooling.test.ts -->

따옴표 없는 frontmatter 값은 `: ` 나 ` #` 를 담지 않는다. 담아야 하면 큰따옴표 문자열로 쓴다.

#### Scenario: 트리거 표기
- **WHEN** description 에 `트리거: "…"` 를 적는다
- **THEN** description 전체가 큰따옴표 문자열이다
