# port-egm-goldfish

## Why

`google/elephant-goldfish-model`(EGM, Apache-2.0)을 Nereus 와 대조했다. brainstorm·draft·bootstrap 은
intake(ouroboros)·spec·역스펙과 겹친다. 두 곳만 비어 있다:

1. **문서를 쓴 사람이 자기 문서를 검토한다.** `spec` §Self-Review 는 "서브에이전트 없이" 돈다.
   대화 맥락을 가진 모델은 자기 가정을 검증해 버린다(EGM 의 "Hallucination Cascades").
   `nereus:review` 는 코드 diff 전용이라 설계 결함은 build 가 끝난 뒤에야 드러난다.
2. **스펙이 코드에서 멀어져도 아무도 모른다.** 아카이브된 `openspec/specs/` 와 README 가 가리키는
   파일·심볼이 사라져도 검사하는 곳이 없다.

## 용어

- **Elephant** — 문서를 쓴 맥락(이 세션). 발견을 해소하고 문서를 고친다.
- **Goldfish** — 대화 이력 없이 문서와 그 문서가 링크한 파일만 읽는 새 서브에이전트 리뷰어.
- **해소 4분류** — Elephant 가 발견마다 고른다. PROPOSE FIX: 지적이 맞아 문서를 고친다(Elephant 가 대상 문서를 직접 수정하고 원장 `fixed` 에 키를 남긴다).
  CONTEST: 리뷰어가 읽을 수 있던 근거로 반박한다. ESCALATE: 반박 근거가 리뷰어가 못 읽는 곳에 있어 사용자에게 묻는다. DECLINE: Nit 을 기록만 한다.
  CONTEST·DECLINE 은 원장 `settled` 에 키를 남겨 다시 열지 않는다.
- **통합 보고서 모드** — 단계 사이에 사용자 확인 없이 5단계를 끝까지 돌고 보고서 하나로 묶는 원본의 프리셋.

| # | 단계 | 무엇을 보나 | 범위 |
|---|---|---|---|
| 5 | Initial Zoom Out | 더 단순한 길·기존 코드 재사용·YAGNI | 전체 |
| 6 | Comprehension | 처음 온 사람이 문서만으로 이해하는가 | Feature+Detailed, 맥락 파일 없음 |
| 7 | Critic | 설계 위험·대안 검토·구조·문체 | Feature |
| 8 | Intermediate Zoom Out | 6·7단계 수정이 문서를 다시 복잡하게 만들었나 | 전체 |
| 9 | Implementation Readiness | 실행자가 설계 결정 없이 옮길 수 있나·코드와 맞나 | Detailed |

## What Changes

- `skills/goldfish` — 새 맥락 서브에이전트 5단계 리뷰(Zoom Out → Comprehension → Critic → Zoom Out → Readiness),
  Elephant 해소(CONTEST/ESCALATE/PROPOSE FIX/DECLINE), 연속 2회 clean 수렴·5라운드 상한.
  `scripts/goldfish.mjs` 가 대상 해석·분할 탐지·링크 수집·보고서 파싱·라운드 판정을 결정론으로 한다.
  `personas/` 9개(원본 `agents/` 에서 README 생성용 bootstrap_orchestrator 만 뺐다), `standards/` 5개는 원문 그대로 — synthesizer 의 디렉터리 두 줄만 바꿨다(NOTICE).
- `skills/drift` — `scripts/drift.mjs` 가 문서의 경로·심볼 참조를 뽑아 존재를 기계 판정, 의미 드리프트는 에이전트가 본다.
- `spec` §3 — medium/large 는 tasks 저장 뒤 goldfish 를 돌리고 나서 build.
- 라우터에 `nereus:goldfish`, `nereus:drift`.
- `NOTICE`, `LICENSES/Apache-2.0.txt`.

**비대화형으로 바꾼다.** 원본은 단계마다 질문 게이트를 둔다. Nereus 는 착수·순서 질문을 금지하므로
통합 보고서 모드가 기본이고, PROPOSE FIX 는 자동 적용, ESCALATE(리뷰어가 볼 수 없는 사실)만 묻는다.

## Impact

- 새 라우트 2개. `goldfish` 는 intake 바로 뒤(design·spec·review 앞)에 두어 "설계 문서 리뷰" 가 코드 리뷰로 가지 않게 한다.
- `nereus` 0.27.1 → 0.28.0.
