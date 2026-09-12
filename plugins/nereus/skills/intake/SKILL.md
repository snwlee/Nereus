---
name: intake
description: First step of any new work. Judges request size, plans the tools (plan.mjs), interviews only when the plan calls for it, then hands off to spec. Use --quick for small edits. 트리거: 새 기능·프로젝트 시작, "개발해줘".
---

# intake

nereus:common 규칙을 따른다. 담당 에이전트: architect.

## 0. 계획 판정 — 묻지 않고 정한다

요청 크기를 판정한다. 기준은 이것뿐이다:
- **small**: 파일 1개, 재현 가능한 버그, 문구·설정 수정, 요청이 두 문장 이하이고 대상이 명확
- **medium**: 파일 2~5개, 기능 하나
- **large**: 새 모듈·새 프로젝트·여러 시스템

그 크기를 넣어 계획을 받는다. 인터뷰 강도·스펙 도구·역스펙 여부는 **여기서 결정되고, 다시 묻지 않는다**.
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/spec/scripts/plan.mjs" "$PWD" --size <small|medium|large>
```
결과를 한 줄로 **알리고 그대로 진행한다**. 다른 판단을 원하는지 묻지 않는다.
사용자가 `--quick` 이나 `--tool` 을 명시하면 그것이 이긴다(`--quick` = `interview: "none"`).

| 필드 | 의미 |
|---|---|
| `interview` | `none` 이면 §2 를 건너뛴다 · `short` 면 핵심 질문 3개 이내 · `full` 이면 전체 인터뷰 |
| `specTool` | `tasks-only` 면 스펙 문서 없이 tasks 만 · 아니면 spec-kit / OpenSpec |
| `reverseSpec` | true 면 spec 단계에서 역스펙 기준선부터 만든다 |
| `prd` | true 면 §4 의 PRD 를 먼저 만든다 |

`interview: "none"` 의 근거: 기존 코드를 고치는 중간 규모 작업에서 요구는 사람 머리가 아니라 **코드에 있다**.
역스펙이 그것을 캔다. 거기에 인터뷰를 얹으면 이미 답이 있는 질문에 토큰을 쓰고 사용자에게 되묻는다.

## 0.5 Three paths + HARD-GATE (출처: superpowers brainstorming)

| 경로 | 언제 | 산출물 |
|---|---|---|
| Spike | 답을 모르겠으면 — throwaway 조사 | 메모, 버린다 |
| Bounded (기본) | 범위 고정 가능 — 승인 전 구현·코드 전면금지 | intake.md |
| Architectural | 여러 시스템 — 설계 우선 | intake.md + 설계 스케치 |

<HARD-GATE> intake.md 를 쓰기 전에는 구현도 코드 수정도 하지 않는다. 순서는 intake → spec → build 다.

**승인은 사용자가 그 작업을 요청한 시점에 이미 끝났다.** 착수 여부를 다시 묻지 않는다 —
"시작할까요", "이대로 진행할까요", "뭐부터 할까요"는 금지다. intake.md 를 쓰고 곧바로 spec 으로 넘어간다.
답이 실제로 갈리는 질문(정보 부재·외부로 나가는 행동)만 묻는다. 병렬 실행이 필요하면 `nereus:loop`로 넘긴다 (라우터 IntentGate).

## 1. 도구 확인

`ooo` 명령이 있는지 확인한다. 없으면 ouroboros 플러그인의 `ooo interview` 스킬(MCP `ouroboros_interview`)을 시도한다. 둘 다 없으면 사용자에게 `/nereus:setup`을 안내하고, 대신 아래 "수동 인터뷰"를 진행한다.

## 2. 인터뷰 — `plan.interview` 가 `none` 이 아닐 때만

`none` 이면 이 절을 통째로 건너뛴다. 인터뷰를 "돌릴까요"라고 묻지 않는다.

```bash
ooo interview
```
또는 세션 안에서 `ooo interview` 스킬을 부른다. 질문은 한 번에 하나. 사용자의 답을 그대로 전달하고, 모호성 점수(ambiguity)가 0.2 이하가 될 때까지 계속한다. 점수가 내려가지 않고 3라운드 이상 정체되면 `ooo unstuck`을 제안한다.

**수동 인터뷰** (ooo 없을 때): 목적, 사용자, 성공 기준, 제약, 범위 밖을 각각 한 질문씩 묻고, 답에서 드러난 가정을 표로 정리해 **알린다**. 표를 승인받고 진행하는 것이 아니라, 알리고 진행한다 — 틀린 가정이 있으면 사용자가 말한다.

## 3. 게이트

- 모호성 ≤ 0.2 (인터뷰를 돌린 경우). `plan.interview` 가 `none` 이면 이 항목은 해당 없음이다.
- 결과를 `.nereus/intake.md`에 저장: 목표, 확정된 가정, 제약, 범위 밖, 열린 질문.
- `plan.reverseSpec` 이 true 면 "역스펙부터"를 intake.md 제약에 적는다 (spec 단계에서 `references/reverse-spec.md` 절차로 기준선을 만든다).
- 통과하면 "spec 단계로 넘어갑니다"라고 말하고 `nereus:spec`을 이어서 실행한다. 통과 전에는 코드를 만지지 않는다.

## 4. PRD

`plan.prd` 가 true 이거나(large greenfield) 사용자가 PRD를 원하면 `ooo pm`을 먼저 돌려 PRD를 만들고, 그 PRD를 spec-kit `specify` 입력으로 쓴다.
