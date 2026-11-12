# spec-tool-selection

기존 capability 에 모델 별칭 출력을 더한다. 진입점: `plan.mjs` `planWork()`, 값의 출처 `model-tiers.mjs` `modelsFor()`.
별칭·등급 용어는 agent-model-tiers 스펙에 정의돼 있다. 아래 표가 규모별 값의 정본이다.

## ADDED Requirements

### Requirement: 계획은 규모에 맞는 모델 별칭을 함께 낸다
<!-- id: plan.modelTiers -->
<!-- entities: WorkSize, ModelTier -->
<!-- enforced: tests/skills/spec-plan.test.ts -->

`planWork()` 는 기존 반환 필드를 그대로 두고 `models: modelsFor(size)` 를 더해야 한다. CLI 출력 JSON 에도 실린다.

| size | reviewer | refuter | session |
|---|---|---|---|
| small·medium | `sonnet` | `opus` | `null` |
| large | `opus` | `opus` | `fable` |

- `reviewer`: review EGM 과 goldfish 리뷰어 서브에이전트의 별칭. `nereus:reviewer` 에이전트와는 무관하다(그 에이전트는 frontmatter 를 따른다).
- `refuter`: security 반박 서브에이전트의 별칭.
- `session`: 메인 세션 모델 권고. `null` 이면 권고 없음. 플러그인은 세션 모델을 바꿀 수 없으므로 intake 가 알리기만 한다.

`size` 가 없거나 모르는 값이면 기존 규칙대로 medium 으로 보고 medium 의 값을 낸다. `--quick`·`--tool` 은 `models` 에 영향이 없다.

#### Scenario: 대형 작업
- **WHEN** `size` 가 `large` 다
- **THEN** `models` 는 `{ reviewer: "opus", refuter: "opus", session: "fable" }`

#### Scenario: 작은 작업
- **WHEN** `size` 가 `small` 이다
- **THEN** `models` 는 medium 과 같다

#### Scenario: 규모 미지정·오타
- **WHEN** `size` 가 없거나 `"enormous"` 다
- **THEN** `models` 는 `{ reviewer: "sonnet", refuter: "opus", session: null }`

#### Scenario: --quick
- **WHEN** intake 가 `--quick` 으로 돌고 size 가 `large` 다
- **THEN** `models.session` 은 `"fable"` 이다(`--quick` 이 값을 바꾸지 않는다)

#### Scenario: 기존 필드 보존
- **WHEN** `models` 를 더한다
- **THEN** `planWork()` 의 기존 반환 키와 값은 변경 전과 같다
