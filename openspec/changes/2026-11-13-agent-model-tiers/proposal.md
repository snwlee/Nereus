# agent-model-tiers

에이전트 19개의 frontmatter 가 `AGENT_TIERS` 의 별칭을 가리키고, review·goldfish 서브에이전트가 `modelsFor(size)` 의 별칭으로 뜬다.

## Problem

Nereus 에이전트 19개가 전부 `model: inherit` 다. 그래서 세션이 Opus 면 반복 리뷰·문서 작업도 Opus 로, 세션이 Sonnet 이면 보안 판단도 Sonnet 으로 돌 수 있다.
`inherit` 를 고른 기록은 문서·openspec 어디에도 없다. 에이전트별 호출 빈도를 기록하는 곳이 없어 절대 비용은 추정하지 않았다.

규모(small·medium·large)에 따라 모델을 바꾸려면 **서브에이전트 호출 지점**이 있어야 한다. 현재 그런 지점은 두 스킬뿐이다:
- review: EGM 페르소나 서브에이전트, security 반박 서브에이전트 (`Agent`(general-purpose))
- goldfish: 단계별 리뷰어 서브에이전트

intake·spec·build 는 "담당 에이전트"를 라벨로만 적고 메인 세션이 직접 일한다. 세션 모델은 플러그인이 바꿀 수 없다(플러그인이 배포할 수 있는 것은 에이전트·스킬·훅이고 세션 모델 선택은 `/model`·설정의 일이다).

에이전트 frontmatter 가 효과를 내는 때는 세션이 그 에이전트에 일을 맡길 때(`Agent`, `subagent_type: nereus:<이름>`)다. 스킬 문서가 명시적으로 맡기는 곳은 review 의 security 투입("security 에이전트도 함께 투입한다")이고, 나머지는 세션이 에이전트 설명의 트리거를 보고 맡길 때다. 그래서 frontmatter 변경의 효과는 **맡겨질 때의 모델을 세션과 분리하는 것**이고, 맡겨지는 빈도는 이 변경이 바꾸지 않는다.

## Goals

- 에이전트 19개의 frontmatter 에 별칭과 `effort` 를 적는다. 기준 표 `AGENT_TIERS` 를 `model-tiers.mjs` 에 두고 테스트가 frontmatter 를 그 표와 대조한다.
- `planWork()` 가 `models: modelsFor(size)` 를 낸다. review·goldfish 의 서브에이전트가 그 별칭으로 뜬다.
- 대형 작업이면 intake 가 세션을 `fable` 로 바꾸라고 **한 줄 권고**한다(게이트 아님). 세션 모델에 닿는 유일한 경로다.
- 별칭을 쓸 수 없을 때의 재시도·하한·종료를 정한다.

관찰 가능한 완료 기준: (1) 설정 위생 — `grep -rn "model: inherit" plugins/*/agents` 0줄, (2) `reviewOutput({ runners: { egm: true }, size: "large" }).egmModel` 이 `opus`(EGM 이 도는 설정일 때 CLI 도 같다), (3) `plan.mjs --size large` 출력의 `models.session` 이 `fable`.

## Non-Goals

- 내장 `Explore` 를 haiku 로 덮기. 플러그인 에이전트는 `<플러그인>:<이름>` 으로 등록되고(예: `nereus:architect`) 내장 이름을 덮지 않는다 — 사용자 수준 `~/.claude/agents/` 의 일이다.
- intake·spec·build 를 서브에이전트 호출로 바꾸기. 별도 설계가 필요하다.
- loop-runner `claude -p` 의 `--model` 지정.
- 비용·성공률 실측. 후속 변경으로 다룬다(아래 Risks 의 승격 트리거가 첫 입력이다).

## Design

### 근거

- [Which Claude model should you build with?](https://claude.dev/blog/which-claude-model-should-you-build-with/) (2026-11-09)
  - 표 행(원문 인용):
    - Well-scoped coding (bug fixes, spec-driven work) → Sonnet 5.5 / `medium`, then `high`
    - Repeated agent tasks (investigation, review, drafting) → Sonnet 5.5 / `medium`
    - Major refactors, migrations, architecture planning, leading many subagents → Fable 5.2 / `medium`, then `high`
    - Everyday engineering, debugging, multi-PR features → Opus 5.5 / `medium`, then `high`
  - 가격(입력/출력, 1M 토큰당): Sonnet 5.5 $2/$10, Opus 5.5 $4/$20, Fable 5.2 $8/$40.
  - 인용: "Keep small models on work where a mistake is cheap to spot … Keep code edits and judgment calls on the main model." — 원문은 작은 모델(서브에이전트)과 메인 모델의 경계를 말한다.
  - 인용: 모델 전환은 "Switch at a natural break".
- [Claude Code model-config](https://code.claude.com/docs/en/model-config.md): 별칭은 provider 의 권장 버전을 가리키고 갱신된다(Anthropic API 에서는 최신). 고정은 `ANTHROPIC_DEFAULT_*_MODEL`.
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents.md): frontmatter `model` 은 별칭·전체 ID·`inherit`, `effort` 는 `low|medium|high|xhigh|max`(`CLAUDE_CODE_EFFORT_LEVEL` 이 있으면 그것이 이긴다). `Agent` 호출의 `model` 인자는 별칭만 받는다.

이 문서가 정한 것(원문 아님): 별칭 순서 haiku < sonnet < opus < fable.

### 배정 근거

1. **원문 표 행이 직접 지지하는 배정** — backend·frontend·app 은 "Well-scoped coding (spec-driven work)", qa·writer·seo·researcher·reviewer 는 "Repeated agent tasks (investigation, review, drafting)" → `sonnet`.
   Nereus 에서 이 에이전트들은 메인 세션이 아니라 서브에이전트로 뜬다. 원문의 "code edits … on the main model" 은 메인 세션을 가리키고, 메인 세션 모델은 이 변경이 건드리지 않는다.
2. **나머지는 이 문서의 휴리스틱** — 원문이 직접 말한 경계가 아니다. 기본은 `sonnet` 이고, **설계(architect)·보안(security)·계층 경계(gameplay-engineer)** 결정을 맡는 3개만 `opus` 다.
   이 셋은 결정이 틀려도 뒤의 어떤 단계도 그것을 판정하지 않는다(설계 타당성, 놓친 취약점, 엔진·로직 경계). 나머지 에이전트의 결정은 사람·스크립트·다음 단계가 다시 본다. 첫 실측이 이 휴리스틱을 뒤집을 수 있다.

| 키 (`<플러그인 디렉터리>/<에이전트 파일명>`) | 별칭 · effort | 근거 |
|---|---|---|
| nereus/architect | opus · medium | 휴리스틱(설계). 설계 결정의 타당성은 테스트·스크립트가 판정하지 못한다(goldfish 는 문서 결함을 본다). 원문은 아키텍처 계획에 Fable 을 권하지만 이 에이전트는 모든 규모의 intake·spec 을 맡으므로 opus 로 두고, large 는 세션 권고(fable)로 맞춘다 |
| nereus/security | opus · high | 휴리스틱(보안). 놓친 취약점을 판정할 게이트가 없다. `high` 는 원문 "then `high`" 를 이 에이전트에 적용한 것 |
| nereus-game/gameplay-engineer | opus · medium | 휴리스틱(계층 경계·서버 권위). 테스트는 동작만 보고 경계 위반은 판정하지 않는다 |
| nereus/backend·frontend·app | sonnet · medium | 근거 1 (Well-scoped coding). TDD 게이트가 테스트로 덮인 회귀를 잡는다 |
| nereus/qa·writer·seo·researcher·reviewer | sonnet · medium | 근거 1 (Repeated agent tasks) |
| nereus-game/economy-designer | sonnet · medium | 휴리스틱 기본값. 값은 이 에이전트가 고르지만 결정론적 시뮬레이터(`balance-sim.mjs`)가 병목·인플레·절벽을 다시 본다 |
| nereus-game/art-director·game-ux·level-designer·narrative-writer | sonnet · medium | 휴리스틱 기본값. 에셋 점검·체크리스트·난이도 곡선 검증이 다시 본다 |
| nereus-3d/graphics-engineer, nereus-l10n/l10n-engineer | sonnet · medium | 휴리스틱 기본값. dispose 검사·l10n-scan 게이트가 다시 본다 |
| nereus-ads/ads-engineer | sonnet · medium | 휴리스틱 기본값. 정지 사유(디버그/릴리스 광고 단위, 첫 세션 전면, 동의 순서)는 `adpolicy` 게이트가 판정한다. 배치·수익 레버는 게이트가 없지만 조언(되돌릴 수 있음)이다 |

합계: opus 3 + sonnet 16 = 19.

### Proposed Architecture

| 구성요소 | 역할 |
|---|---|
| `skills/spec/scripts/model-tiers.mjs` | `AGENT_TIERS`(기준 표), `modelsFor(size)`, `resolveSize(size)` |
| `skills/spec/scripts/plan.mjs` | `planWork()` 반환에 `models` |
| `skills/review/scripts/review.mjs` | `reviewOutput({ mode, runners, size })` — EGM 이 돌면 `egmModel`·`refuterModel`, 항상 `size`·`sizeAssumed` |
| `skills/goldfish/scripts/goldfish.mjs` | `planReview()` 반환에 `reviewerModel`·`size`·`sizeAssumed`, CLI `--size` |
| `agents/*.md` 19개 | frontmatter `model`·`effort` — Claude Code 가 실제로 읽는 값. 테스트가 `AGENT_TIERS` 와 대조 |
| intake·review·goldfish·build SKILL.md | 값을 쓰는 지시와 재시도 규칙. 문서 계약 테스트로 문구를 고정 |

흐름:
1. intake 가 `plan.mjs` 를 돌리고 `.nereus/intake.md` **1행**에 `계획: <size> · …` 를 쓴다(새 규칙, `--quick` 포함, 매 intake 가 파일을 덮어쓴다). large 면 `models.session` 별칭으로 세션을 바꾸라는 권고 한 줄을 알린다.
2. goldfish 는 `goldfish.mjs plan <대상> --size <size>` 출력의 `reviewerModel` 로 리뷰어 서브에이전트를 띄운다.
3. review 는 `review.mjs --size <size>` 출력의 `egmModel`·`refuterModel` 로 EGM·반박 서브에이전트를 띄운다.
4. `--size` 가 없거나 모르는 값이면 스크립트가 medium 으로 계산하고 `sizeAssumed: true` 를 낸다. 스킬은 "규모를 몰라 medium 으로 봤다" 한 줄을 알린다.
5. 별칭을 쓸 수 없으면 아래 규칙으로 한 번 재시도한다.

규모별 값의 정본은 openspec 스펙 spec-tool-selection 의 요구 `plan.modelTiers` 다.

### 별칭을 쓸 수 없을 때

트리거는 `Agent` 호출 오류가 모델을 알 수 없음·사용 불가·허용 안 됨이라고 말할 때뿐이다. 다른 오류는 기존 규칙(EGM 은 `skipped`)을 따른다.

| 호출 | 모델 오류 시 | 끝내 못 쓰면 |
|---|---|---|
| EGM 페르소나 (`egmModel`) | 한 단계 아래 별칭을 명시해 **한 번만** 재시도(opus→sonnet). 하한 `sonnet` | EGM 을 `skipped` 로 보고(기존 규칙). 리뷰 게이트는 OCR 결과로 판정. large 에서 sonnet 으로 내려가 돌았으면 보고서에 `degraded` |
| 반박 (`refuterModel`) | 재시도하지 않는다 — 약한 반박은 결과를 쓸 수 없다 | 반박하지 않은 것으로 둔다: 지적은 차단 유지, 보고서에 `degraded` |
| goldfish 리뷰어 (`reviewerModel`) | EGM 과 같다 | 기존 규칙대로 `not run`(한 번 다시 띄우고도 실패) |

`degraded` 는 review 보고서(`.nereus/review.md`)와 goldfish 단계 보고서의 해당 리뷰어 행에 붙는 표시다. `degraded` 차단을 풀려면 opus 를 쓸 수 있는 세션에서 반박을 다시 돌리거나, 사용자가 그 지적을 수용·기각하고 그 결정을 review.md 에 기록한다.
frontmatter 로 뜨는 에이전트(예: `nereus:security`)가 별칭을 못 쓰면 그 `Agent` 호출이 오류로 끝난다. 하네스는 재시도하지 않고 오류를 알린다 — 사용자는 `ANTHROPIC_DEFAULT_OPUS_MODEL` 등으로 해결한다.

### 서브에이전트 effort

`Agent`(general-purpose)로 띄우는 EGM·반박·goldfish 리뷰어는 frontmatter 가 없으므로 세션 effort 로 돈다. 이 변경은 그것을 바꾸지 않는다.

### 상대 비용

리뷰 한 번(EGM 페르소나 2개 + 반박 N개)의 입력/출력 단가는 medium 에서 EGM 이 opus 대비 절반(sonnet), large 에서 같다(opus). large 세션 권고를 따르면 메인 세션 단가가 Opus 의 두 배(Fable)가 된다. 절대 비용은 호출 수 기록이 없어 내지 않는다.

## Risks & Limits

| 위험 | 영향 | 대응 |
|---|---|---|
| 계정·provider 에 `opus`·`fable` 이 없다 | 서브에이전트 호출 실패 | 재시도 규칙(하한 sonnet). 반박이 내려가면 결과 미적용·`degraded`. frontmatter 에이전트는 오류를 알린다 |
| Sonnet 세션에서 opus 에이전트 3개가 세션보다 비싸진다 | 비용 상승 | 의도한 동작 — 판단 에이전트는 세션과 무관하게 opus |
| medium EGM 이 sonnet 이라 opus 에이전트 산출물을 sonnet 이 리뷰한다 | 2차 의견이 약할 수 있다 | 근거 1(Repeated agent tasks: review). 반박은 opus. **승격 트리거**: EGM 이 통과시킨 CRITICAL/HIGH 가 이후(Codex·사람·운영)에서 발견되면 `.nereus/learn` 학습 후보로 남기고, 2건이 쌓이면 `modelsFor` medium 의 `reviewer` 를 `opus` 로 올린다 |
| sonnet 16개의 품질 저하 | fix 라운드 증가 | 기존 build §5 "fix 4라운드 이후 한 티어 위" 가 그 태스크를 올린다. 같은 에이전트에서 반복되면 그 행만 올린다 |
| `--size` 를 빼먹는다 | large 인데 sonnet 리뷰어 | `sizeAssumed: true` 로 알린다. 조용히 넘어가지 않는다 |
| effort 가 세션값에서 `medium` 으로 내려간다 | 세션을 `high`·`xhigh` 로 쓰던 사용자는 맡긴 에이전트가 덜 생각한다 | 원문 표의 시작 effort 가 `medium` 이다. 같은 에이전트에서 fix 라운드가 반복되면 그 행의 effort 를 `high` 로 올린다 |
| 문서 계약 테스트는 문구가 있는지만 본다 | 모델이 지시를 따르는지는 못 잡는다 | 값은 스크립트 출력으로 주어 모델이 계산하지 않게 한다 |

## Alternatives Considered

| 안 | 버린 이유 |
|---|---|
| 버전 ID 고정(`claude-sonnet-5-5`) | 새 버전을 따라가지 않는다. 고정은 `ANTHROPIC_DEFAULT_*_MODEL` 이 맡는다 |
| `inherit` 유지, `effort` 만 지정 | 세션 모델이 그대로 모든 에이전트에 간다. 문제를 안 푼다 |
| 전부 opus | 근거 1 의 반복·스펙 기반 작업까지 두 배 단가 |
| 전부 sonnet | 판정 수단이 없는 결정(설계·보안)이 세션보다 약해질 수 있다 |
| 판단 에이전트 3개만 명시, 나머지 `inherit` | 세션이 Opus 면 반복 작업 단가가 그대로다. 대신 행 단위로 되돌릴 수 있게 표를 한 곳에 둔다 |
| architect frontmatter 를 fable | small·medium intake·spec 까지 두 배 단가. large 는 세션 권고로 맞춘다 |
| medium EGM 을 opus | 근거 1 에 반한다. 승격 트리거로 데이터가 쌓이면 바꾼다 |
| 규모별 architect·build 등급(`buildFloor`) | intake·spec·build 에 서브에이전트 호출 지점이 없어 적용될 곳이 없다(1차 설계, goldfish 2라운드에서 확인) |
| `atLeast`·`escalate`·`fallback` 헬퍼와 비용 티어 매핑 상수 | 런타임 호출자가 0곳이다 |
| 스크립트가 `.nereus/intake.md` 를 직접 읽어 size 를 얻기 | 그 파일은 마지막 intake 의 것이라 review 시점에 다른 작업의 값일 수 있다(직접 실행한 review 등). 세션이 지금 작업의 규모를 알고 넘기고, 모르면 `sizeAssumed` 로 알린다 |
| `CLAUDE_CODE_SUBAGENT_MODEL` 일괄 | 차등 불가, 사용자 환경 설정이라 플러그인이 배포할 수 없다 |
| 사용자 config 로 표를 받기 | 설정 키·검증·문서가 늘어난다. 표는 코드 한 곳에 있고, 버전 고정은 `ANTHROPIC_DEFAULT_*_MODEL` 로 이미 가능하다 |
| frontmatter 대신 호출할 때마다 `Agent` 의 `model`·`effort` 를 넘기기 | 맡기는 주체가 세션(모델)이라 매번 넘길 값을 기억해야 한다. frontmatter 는 맡길 때마다 자동 적용된다. 호출 지점이 스킬에 있는 review·goldfish 는 이 방식(스크립트 출력값)을 쓴다 |
| large 에서 세션을 자동으로 fable 로 | 플러그인이 세션 모델을 바꿀 수 없다. 권고 한 줄만 |
| `opusplan` | 메인 세션의 계획·실행 단계만 바꾸고 서브에이전트에는 닿지 않는다. 이 변경의 대상이 아니다 |

## Impact

- Create: `plugins/nereus/skills/spec/scripts/model-tiers.mjs`, `tests/skills/model-tiers.test.ts`, `tests/skills/agent-models.test.ts`, `tests/skills/model-tier-docs.test.ts`
- Modify: `plugins/nereus/skills/spec/scripts/plan.mjs`, `plugins/nereus/skills/review/scripts/review.mjs`, `plugins/nereus/skills/goldfish/scripts/goldfish.mjs`, 에이전트 19개, `intake`·`review`·`goldfish`·`build` SKILL.md, `tests/skills/spec-plan.test.ts`(단언 추가만)
- openspec: 새 capability `agent-model-tiers`(specs/agent-model-tiers/spec.md), 기존 capability `spec-tool-selection` 에 ADDED 델타(specs/spec-tool-selection/spec.md), `tasks.md`
