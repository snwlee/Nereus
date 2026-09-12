# plugin-packaging (델타)

## ADDED Requirements

### Requirement: 리뷰어 가용은 응답으로 판정해야 한다
<!-- id: review.probe -->
<!-- entities: Reviewer -->
<!-- enforced: plugins/nereus/skills/review/scripts/review.mjs -->

시스템은 리뷰어의 가용 여부를 PATH 존재가 아니라 **짧은 프로브의 응답**으로 판정해야 한다.
프로브가 타임아웃 안에 의미 있는 출력을 내지 못하면 그 리뷰어는 불가로 표시하고 계획에서 뺀다.
PATH 에 있으나 무응답 후 종료 코드 0 을 내는 도구가 실재하므로, 존재만으로 가용을 단정하면
계획은 초록인데 실제로는 아무도 리뷰하지 않는 상태가 된다.

#### Scenario: 응답하는 리뷰어
- **WHEN** 프로브가 타임아웃 안에 비어 있지 않은 출력을 낸다
- **THEN** 그 리뷰어는 계획에 포함된다

#### Scenario: 무응답 리뷰어
- **WHEN** 프로브가 타임아웃을 넘기거나 빈 출력으로 끝난다
- **THEN** 그 리뷰어는 `skipped` 로 표시되고 계획에서 빠진다

#### Scenario: 전부 불가
- **WHEN** 모든 2차 의견 리뷰어가 불가다
- **THEN** 계획이 그 사실을 명시해 사용자가 한계를 알 수 있다
