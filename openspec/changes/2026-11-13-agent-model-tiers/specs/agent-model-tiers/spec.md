# agent-model-tiers

에이전트와 스킬이 띄우는 서브에이전트가 어떤 모델 별칭으로 도는지 정한다.
진입점: `plugins/nereus/skills/spec/scripts/model-tiers.mjs`. 규모별 값(`modelsFor`)의 정본은 spec-tool-selection 의 요구 `plan.modelTiers` 다.

## Terms

- **별칭**: `haiku`·`sonnet`·`opus`·`fable`. Claude Code 가 provider 의 권장 버전으로 푸는 이름.
- **별칭 순서**: haiku < sonnet < opus < fable (이 스펙이 정한 순서). "한 단계 위/아래" 는 이 순서에서 한 칸이다.
- **등급**: 에이전트 하나의 `{ model: 별칭, effort }`.
- **EGM**: review 단계의 2차 의견. 대화 맥락 없는 서브에이전트가 goldfish 페르소나 파일을 읽고 diff 를 리뷰한다.
- **refuter**: security 에이전트의 CRITICAL/HIGH 를 반박해 보는 새 서브에이전트.
- **runners**: `review.mjs` `planRunners()` 결과(어떤 리뷰어가 도는지). `planWork()` 결과와 다르다.
- **리뷰어 별칭**: `modelsFor().reviewer`. EGM·goldfish 리뷰어 서브에이전트의 별칭이다. `nereus:reviewer` 에이전트(frontmatter 를 따른다)와 무관하다.
- **degraded**: 계획한 별칭보다 낮은 별칭으로 돌았거나 반박을 못 돌린 리뷰어에 붙는 표시. review 보고서·goldfish 단계 보고서의 그 리뷰어 행에 적는다.

한계: 에이전트별 등급은 실측 전 기본값이다. 실측은 별도 변경으로 다룬다.

## ADDED Requirements

### Requirement: 등급 기준 표
<!-- id: tiers.table -->
<!-- entities: ModelTier, Agent -->
<!-- enforced: tests/skills/model-tiers.test.ts -->

`model-tiers.mjs` 는 `AGENT_TIERS` 를 내보내야 한다. 키는 `<플러그인 디렉터리>/<에이전트 파일명(.md 제외)>` 이고 `plugins/*/agents/*.md` 전부를 덮는다.
값은 등급이고 `model` 은 별칭 넷 중 하나, `effort` 는 `low|medium|high|xhigh|max` 중 하나다.
배정은 proposal "배정 근거" 를 따른다: 원문 표 행이 직접 지지하는 에이전트는 `sonnet`, 나머지는 기본 `sonnet` 이고 설계·보안·계층 경계 결정을 맡는 에이전트만 `opus`. 이 테스트는 표와 frontmatter 의 어긋남을 잡는다 — 배정이 옳은지는 잡지 못한다.

#### Scenario: 값의 범위
- **WHEN** `AGENT_TIERS` 의 모든 값을 본다
- **THEN** model 은 별칭 넷 중 하나, effort 는 다섯 값 중 하나다

### Requirement: 에이전트 frontmatter 는 기준 표와 같다
<!-- id: agents.modelTier -->
<!-- entities: Agent, ModelTier -->
<!-- enforced: tests/skills/agent-models.test.ts -->

Claude Code 가 읽는 것은 frontmatter 다. 모든 `plugins/*/agents/*.md` 의 frontmatter `model`·`effort` 는 `AGENT_TIERS` 의 같은 키 값과 같아야 하고,
에이전트 파일 집합과 표의 키 집합은 같아야 한다. `inherit`·버전 ID 는 표에 없으므로 실패한다.

#### Scenario: 표 없이 에이전트 추가
- **WHEN** `plugins/nereus/agents/new.md` 를 `model: inherit` 로 추가한다
- **THEN** 테스트가 키 집합 불일치로 실패한다

#### Scenario: 등급 변경
- **WHEN** 한 에이전트의 등급을 바꾼다
- **THEN** `AGENT_TIERS` 의 그 행과 그 frontmatter 를 함께 고쳐야 테스트가 통과한다

### Requirement: 규모를 모르면 medium 으로 보고 알린다
<!-- id: tiers.resolveSize -->
<!-- entities: WorkSize -->
<!-- enforced: tests/skills/model-tiers.test.ts -->

`resolveSize(size)` 는 문자열 `small|medium|large` 면 `{ size, assumed: false }`, 없거나 그 밖의 값(문자열이 아닌 값, `"constructor"` 같은 객체 키 포함)이면 `{ size: "medium", assumed: true }` 를 돌려준다. `modelsFor` 도 이 판정을 쓴다.
medium 으로 보는 이유: 기존 `planWork` 와 같은 기본값이고, 모를 때 opus 리뷰어로 올리면 모든 `--size` 누락이 대형 단가가 된다. 대신 `sizeAssumed` 로 알린다.
`review.mjs`·`goldfish.mjs` 출력은 이 값을 `size`·`sizeAssumed` 로 싣는다.

#### Scenario: --size 누락
- **WHEN** `review.mjs` 를 `--size` 없이 돌린다
- **THEN** 출력에 `size: "medium"`, `sizeAssumed: true` 가 있다

### Requirement: review 서브에이전트는 규모에 맞는 별칭으로 띄운다
<!-- id: review.subagentModels -->
<!-- entities: Reviewer, ModelTier -->
<!-- enforced: tests/skills/model-tiers.test.ts -->

`review.mjs` 는 출력을 `reviewOutput({ mode, runners, size })` 로 만든다. 출력 키 `plan` 은 기존대로 runners 를 담는다(호환).
`runners.egm` 이 참이면 `egmPersonas`·`securityRefuter` 와 함께 `egmModel = modelsFor(size).reviewer`, `refuterModel = modelsFor(size).refuter` 를 싣는다.
거짓이면 네 키 모두 없다.

#### Scenario: EGM 이 돈다
- **WHEN** `runners.egm` 이 참이다
- **THEN** `egmModel`·`refuterModel` 은 `modelsFor(size)` 의 `reviewer`·`refuter` 와 같다

#### Scenario: EGM 없음
- **WHEN** `runners.egm` 이 거짓이다
- **THEN** `egmPersonas`·`securityRefuter`·`egmModel`·`refuterModel` 이 모두 없다

### Requirement: goldfish 리뷰어는 규모에 맞는 별칭으로 띄운다
<!-- id: goldfish.reviewerModel -->
<!-- entities: Reviewer, ModelTier -->
<!-- enforced: tests/skills/model-tiers.test.ts -->

`planReview(target, { cwd, mode, size })` 는 반환에 `reviewerModel = modelsFor(size).reviewer` 와 `size`·`sizeAssumed` 를 더해야 한다. CLI `plan` 은 `--size` 를 받는다.

#### Scenario: 규모 전달
- **WHEN** `size` 를 준다
- **THEN** `reviewerModel` 은 `modelsFor(size).reviewer` 와 같다

### Requirement: 별칭을 쓸 수 없을 때 한 번만, 하한까지만 재시도한다
<!-- id: subagent.aliasFallback -->
<!-- entities: Reviewer, ModelTier -->
<!-- enforced: tests/skills/model-tier-docs.test.ts -->

review·goldfish 스킬 문서는 다음을 지시해야 한다(실행 주체는 모델이고, 테스트는 문구를 고정한다).
트리거는 `Agent` 호출 오류가 모델을 알 수 없음·사용 불가·허용 안 됨이라고 말할 때뿐이다.
EGM·goldfish 리뷰어는 별칭 순서에서 한 단계 아래 별칭을 명시해 **한 번만** 재시도하고, 하한은 `sonnet` 이다. 끝내 못 쓰면 기존 규칙대로 EGM 은 `skipped`, goldfish 리뷰어는 `not run` 이다. large 에서 sonnet 으로 내려가 돌았으면 `degraded` 를 붙인다.
반박은 재시도하지 않는다. 계획한 별칭으로 못 돌면 반박하지 않은 것으로 두고(지적은 차단 유지) `degraded` 를 붙인다.

#### Scenario: 모델 오류
- **WHEN** large 의 EGM `model: "opus"` 호출이 모델 사용 불가 오류로 실패한다
- **THEN** `model: "sonnet"` 으로 한 번 재시도하고, 돌면 그 리뷰어에 `degraded` 를 붙인다

#### Scenario: 다른 오류
- **WHEN** 호출이 시간 초과로 실패한다
- **THEN** 이 규칙은 적용되지 않는다(review SKILL.md §2 의 기존 규칙: 서브에이전트를 못 띄우면 EGM 을 `skipped` 로 알린다)

#### Scenario: 하한
- **WHEN** EGM `model: "sonnet"` 호출이 모델 오류로 실패한다
- **THEN** 재시도하지 않고 EGM 을 `skipped` 로 보고한다. 게이트는 OCR 결과로 판정한다

#### Scenario: 반박을 못 돌림
- **WHEN** 반박 `model: "opus"` 호출이 모델 오류로 실패한다
- **THEN** 재시도하지 않는다. 지적은 차단으로 남고 보고서에 `degraded` 가 붙는다

### Requirement: 스킬 문서가 별칭을 서브에이전트 호출로 넘긴다
<!-- id: docs.modelHandoff -->
<!-- entities: Skill -->
<!-- enforced: tests/skills/model-tier-docs.test.ts -->

- intake SKILL.md: 계획 필드 표에 `models` 행, `models.session` 이 있으면 `/model` 권고 한 줄(묻지 않는다), `.nereus/intake.md` 1행 `계획:` 규칙(`--quick` 포함).
- review SKILL.md: `review.mjs` 를 `--size` 와 함께 돌리고, EGM 을 `egmModel`, 반박을 `refuterModel` 로 띄우고, `sizeAssumed` 면 한 줄 알린다.
- goldfish SKILL.md: `goldfish.mjs plan` 을 `--size` 와 함께 돌리고 리뷰어를 `reviewerModel` 로 띄운다.
- build SKILL.md §5: 비용 티어 열을 별칭으로 적고 별칭 순서를 적는다.

#### Scenario: 문구 삭제
- **WHEN** review SKILL.md 에서 `egmModel` 지시가 지워진다
- **THEN** 문서 계약 테스트가 실패한다
