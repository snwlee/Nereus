---
name: goldfish
description: "Design-doc review by fresh-context subagents (Elephant-Goldfish Model) — five stages, Elephant resolves findings, converges on two clean rounds. Runs automatically at the end of spec for medium/large work. 트리거: \"설계 문서 리뷰\", \"스펙 검토\", \"goldfish\", \"egm\"."
---

# goldfish

nereus:common 규칙을 따른다. 담당: 이 세션(Elephant)이 오케스트레이션하고, 리뷰는 **새 서브에이전트(Goldfish)**가 한다.
출처: google/elephant-goldfish-model (Apache-2.0) `egm-review`·`egm-review-loop`·`egm-resolve` — `NOTICE` 참고.

## 왜

문서를 쓴 맥락은 자기 가정을 검증해 버린다. Goldfish 는 **대화 이력 없이** 문서와 그 문서가 가리키는 파일만 읽는다.
그래서 "쓴 사람만 아는 전제"가 문서에 빠져 있으면 Goldfish 가 걸린다. 코드 diff 리뷰(`nereus:review`)와는 대상이 다르다 — 이건 build 전 설계 문서다.

**서브에이전트를 띄울 수 없으면 멈추고 그렇게 말한다.** 같은 맥락에서 하는 리뷰는 Goldfish 리뷰가 아니다.

## 1. 계획

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/goldfish/scripts/goldfish.mjs" plan <대상> [--mode full|feature|implementation] [--size small|medium|large]
```

대상: OpenSpec change 디렉터리(`openspec/changes/<이름>`), spec-kit 기능 디렉터리, 또는 md 파일.
출력의 `feature`·`detailed`(범위), `context.inside`(리뷰어에게 줄 파일), `stages`(단계별 리뷰어·페르소나·표준 절대 경로), `notes` 를 그대로 쓴다.
`--size` 는 `.nereus/intake.md` 1행 `계획:` 의 첫 값이다. 없거나 확신이 없으면 빼고 돌린다 — `sizeAssumed` 가 true 면 "규모를 몰라 medium 으로 봤다" 한 줄을 알린다. 출력의 `reviewerModel` 이 리뷰어 서브에이전트의 별칭이다.

- 모드 기본은 `full`. 구현 범위가 없으면 스크립트가 `feature` 로 낮추고 `notes` 에 적는다 — 알리고 진행한다.
- `context.outside`·`context.urls` 는 자동으로 넣지 않는다. URL 은 받아서 `.nereus/goldfish/` 에 파일로 저장해 절대 경로로 넘긴다. 작업 디렉터리 밖 파일은 넣지 않고 넣지 않았다고 알린다.
- `context.missing` 은 문서의 깨진 링크다 — 그 자체로 발견으로 기록한다.

원본은 프리셋 선택·단계별 체크포인트를 사용자에게 묻는다. **Nereus 에서는 묻지 않는다** — 통합 보고서 모드로 끝까지 돈다.

## 2. 단계 (원본 번호 유지)

| # | 단계 | 범위 | 리뷰어 (표준) | 보고서 |
|---|---|---|---|---|
| 5 | Initial Zoom Out | 전체 | zoom-out (zoom-out), inventive-catalyst | `zoom_out_report.md` |
| 6 | Comprehension | Feature+Detailed | comprehension — **직접 띄움, 맥락 파일 없음** | `comprehension_report.md` |
| 7 | Critic | Feature | design·structural (feature-spec), style | `critic_report.md` |
| 8 | Intermediate Zoom Out | 전체 | zoom-out (zoom-out) — 5단계 보고서 경로를 주고 그 뒤 변화에 집중 | `intermediate_zoom_out_report.md` |
| 9 | Implementation Readiness | Detailed | implementation-readiness·codebase-details (impl-readiness), style | `implementation_readiness_report.md` |

보고서는 `.nereus/goldfish/<대상 이름>/` 에 쓴다. 채팅에 붙이지 않고 경로만 말한다.

### 서브에이전트 띄우기

`Agent` 도구, `subagent_type: general-purpose`, model: `reviewerModel`. 모델 오류(알 수 없음·사용 불가·허용 안 됨)일 때만 별칭 순서(haiku < sonnet < opus < fable)에서 한 단계 아래 별칭을 명시해 한 번만 재시도한다. 하한은 `sonnet` 이다. 내려가 돌았으면 단계 보고서 `## Reviewer Status` 표의 그 행에 세 번째 열로 `degraded` 를 적고(`| 이름 | completed | degraded |` — 상태 칸은 그대로 둬야 `parseReport` 가 읽는다), 끝내 못 쓰면 아래 규칙대로 `not run` 이다. 단계의 리뷰어마다 하나씩 **같은 메시지에서 병렬로** 띄운다(원본의 synthesizer 대신 직접 dispatch — Claude Code 는 서브에이전트가 다시 서브에이전트를 띄우지 못한다).
프롬프트에는 아래만 넣는다. 이 대화의 결정·이유·요약을 넣으면 Goldfish 가 아니다.

```text
You are a Goldfish reviewer. First read your persona file and follow it exactly:
  <persona 절대 경로>
Mode: REVIEW
Document standard (read it and audit against it): <standard 절대 경로 또는 "none">
Target: <파일 절대 경로> lines <시작>-<끝>   (여러 파일이면 한 줄씩)
GoldfishContext (read as needed for baseline, do not review them): <context.inside 절대 경로들 또는 "none">
You are read-only. Report findings in plain language, each with Severity (Blocker | Major | Nit),
Affected Scope (lines or section header), Discrepancy, Rationale & Recommendation.
```

6단계는 `GoldfishContext` 를 `none` 으로 둔다. 문서 하나만으로 이해되는지가 검사 대상이다.

### 보고서 합치기 (이 세션이 synthesizer 역할)

리뷰어 응답을 `personas/synthesizer.md` 의 REVIEW 형식으로 합쳐 단계 보고서에 쓴다: 맨 위 `## Reviewer Status` 표(`completed`/`not run`), 그 아래 `### <이슈> - Severity: <Blocker|Major|Nit>` 와 `* **Reviewer Lens:**`, `* **Affected Scope:**`. 이 형식이어야 `judge` 가 읽는다.
6단계는 리뷰어의 의역 두 절(**What this proposes** / **How the existing system works, per this document**)을 보고서 맨 앞에 그대로 둔다 — 의역이 의도와 다르면 그것이 발견이다.

리뷰어가 시간 초과·실패·빈 응답이면 **한 번** 다시 띄운다. 또 실패하면 `not run` 이다. 발견 0개로 세지 않는다.

## 3. 해소 (Elephant)

발견마다 하나로 분류해 보고서 아래 `## Resolution` 에 적는다:

| 분류 | 언제 | 처리 |
|---|---|---|
| PROPOSE FIX | 지적이 맞다 | **자동 적용**. `settle --fixed <key>` |
| CONTEST | 틀렸고, 리뷰어가 읽을 수 있던 근거(파일·심볼·문서 안 결정)를 댈 수 있다 | 근거를 적고 `settle --settle <key>` |
| ESCALATE | 틀렸지만 근거가 리뷰어가 못 읽는 곳(팀 관례·구두 결정)에 있다 | **사용자에게 묻는다** — 하네스가 알 수 없는 정보다 |
| DECLINE | Nit 이고 고칠 가치가 없다 | 기록만. `settle --settle <key>` |

규칙(원본 그대로):
- "의도한 것이다"는 근거가 아니다. 리뷰어가 읽을 수 있는 근거가 없으면 CONTEST 가 아니라 ESCALATE 나 PROPOSE FIX 다.
- 6단계(이해) 결함은 CONTEST 하지 않는다. 새 독자가 못 따라가면 문서에 맥락이 빠진 것이다.
- Goldfish 만 필요로 하는 맥락이면 문서에 덧붙이지 말고 ESCALATE 한다. 사람 독자가 필요로 할 때만 덧붙인다.
- 심각도를 바꾸지 않는다. Blocker 가 Nit 같으면 CONTEST 하고 이유를 쓴다.
- 문서를 쓴 것은 이 세션이다. 반박하고 싶다는 마음은 리뷰어가 틀렸다는 증거가 아니다.

`key` 는 `goldfish.mjs parse <보고서>` 출력의 `key` 를 쓴다.
ESCALATE 가 있으면 한 번에 모아 질문 하나로 묻고, 답을 받은 뒤 이어간다. 나머지는 묻지 않는다.

## 4. 라운드 수렴 (7·9단계)

7·9단계는 고친 뒤 같은 단계를 다시 돌린다. 매 라운드 끝에:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/goldfish/scripts/goldfish.mjs" judge .nereus/goldfish/<이름>/ledger-<단계>.json <단계 보고서>
```

**해소를 적용하기 전에** 돌린다 — clean 판정은 그 라운드의 리뷰 결과로 한다.

- clean = 정착되지 않은 차단 발견 없음 **그리고** `not run` 없음 **그리고** `unparsed` 없음. Nit·Minor·Low 만 막지 않는다 — 모르는 심각도는 막는다. `unparsed` 는 형식이 어긋난 발견 제목이니 보고서를 §2 형식으로 고쳐 다시 judge 한다(라운드를 하나 쓴다).
- `next: converged` — 연속 2회 clean. 다음 단계로. 한 번의 clean 으로는 부족하다(다음 Goldfish 가 다른 틈을 찾는다).
- `next: continue` — 해소 적용 후 같은 단계를 다시 돈다. 매 라운드 문서를 다시 읽어 줄 범위를 새로 잡는다(`plan` 재실행).
- `next: cap` — 5라운드. 남은 발견을 심각도순으로 짧게 적고 사용자에게 하나만 묻는다: 수용하고 진행 / 상한 넘겨 계속 / 문서를 spec 으로 되돌림.
- `reopened` 가 있으면 고친 것이 실패했거나 다른 수정이 되살렸다. 같은 범위에서 새 발견이 나오고 그 수정을 되돌리면 사라진다면 **churn** 이다 — cap 과 같이 처리한다.

5·6·8단계는 한 번 돈다. Blocker·Major 는 해소하고 다음으로 간다.

## 5. 끝

`.nereus/goldfish/<이름>/consolidated_review_report.md` 에 단계별 발견을 🔴 Blocker / 🟡 Major / 🟢 Nit 로 묶고, 발견 → 해소 추적 표를 남긴다.
Nereus 심각도는 Blocker=CRITICAL, Major=HIGH, Nit=LOW (`judge` 출력의 `nereusSeverity`). 남은 CRITICAL/HIGH 가 0 이면 통과다.

spec 에서 불렸으면 `nereus:build` 로 넘어간다. 직접 불렸으면 보고서 경로와 남은 항목 수만 말한다.
