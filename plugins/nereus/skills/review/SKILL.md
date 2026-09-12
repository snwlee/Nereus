---
name: review
description: OCR delegation plus parallel Codex/Gemini(agy) review, gated at 0 CRITICAL/HIGH. Runs automatically right after build. 트리거: "리뷰", "코드 검토".
---

# review

nereus:common 규칙을 따른다. 담당 에이전트: reviewer. 인증·입력 처리·외부 호출·파일시스템·DB 쿼리를 만진 변경이면 security 에이전트도 함께 투입한다.

## 0. 사전 게이트
`node "${CLAUDE_PLUGIN_ROOT}/skills/finish/scripts/gate.mjs"`를 먼저 돌린다. evidence가 FRESH·통과가 아니거나 완료 무결성 항목이 있으면 리뷰어를 부르지 않고 build로 돌려보낸다. 리뷰어 비용을 아끼고, 리뷰어가 스텁·TODO를 지적하느라 진짜 결함을 놓치는 일을 막는다.

## 1. 계획

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/review.mjs"
```
설정 `secondOpinion`과 설치 상태로 어떤 리뷰어가 돌지 나온다. `skipped`가 있으면 사용자에게 알린다(차단은 아님).

이 명령은 **PATH 존재가 아니라 실제 응답**으로 판정한다(프로브). 두 CLI 가 각각 다르게 거짓말하기 때문이다.

- `codex` — **신뢰되지 않은 디렉터리에서 부르면 거부한다.** 저장소 루트에서 `--skip-git-repo-check` 와 함께
  부르면 정상 응답한다(측정 13초). 프로브를 엉뚱한 cwd 에서 돌린 탓에 세 사이클 동안 "codex 불가"로 잘못
  기록돼 있었다 — 도구는 멀쩡하다.
- `agy` — 기본 `text` 출력에서는 API 오류 재시도가 전부 삼켜져 **빈 출력 + exit 0** 으로만 보인다.
  `--output-format json` 으로 받아야 `RESOURCE_EXHAUSTED (429) / 할당량 소진` 같은 사유가 드러난다.

`reasons` 에 사유가 붙어 나온다. 예: `할당량 소진 — 할당량이 94h11m42s 뒤에 리셋된다`.
**할당량 소진은 결함이 아니라 상태다** — 그 리뷰어만 빠지고 리뷰는 계속 돈다.

| 설정값 | 도는 리뷰어 |
|---|---|
| `"both"` (기본) | OCR + Codex + Gemini |
| `"codex"` | OCR + Codex |
| `"gemini"` | OCR + Gemini |
| `"none"` | OCR만 (2차 의견 없음) |
| `["ocr", "gemini"]` | 배열로 직접 지정. 빈 배열이면 리뷰 자체를 건너뛴다 |

## 2. 병렬 실행

리뷰 대상은 `git diff <base>...HEAD` (base 기본 `main`, 미커밋 작업이면 워크스페이스).

> **OCR 에 범위를 반드시 넘긴다.** `ocr delegate` 를 인자 없이 부르면 워크스페이스(미커밋) 모드로
> 떨어져 **커밋된 변경이 리뷰 대상에서 통째로 빠진다**. `ocrDelegateArgs(base)` 가 인자를 만든다.
> `.md` 는 `unsupported_ext` 로 제외되므로, 문서만 바뀐 범위에서 `0 reviewable` 이 나오는 것은 정상이다.

- **OCR delegation**: `ocr delegate preview --from <base> --to HEAD` 로 리뷰할 파일과 룰을 받고, 파일별 `ocr delegate rule <files>`로 룰을 받아 **이 세션의 모델이 직접** 리뷰한다. OCR이 API 키로 직접 리뷰하게 설정돼 있으면 `ocr review --format json --output .nereus/review-ocr.json`을 쓴다.
- **Codex**: `codex review` (또는 codex 플러그인의 `/codex:adversarial-review`). 결과를 파일·줄·심각도·메시지로 정리한다.
- **Gemini (Antigravity CLI)**: `agy -p "다음 diff를 리뷰하고 file:line, severity(CRITICAL/HIGH/MEDIUM/LOW), message 형식의 JSON 배열로만 답하라: $(git diff ...)"`.

직접 리뷰할 때는 아래 조용한 실패 5항을 반드시 훑는다 (출처: ecc `silent-failure-hunter`. 기계 게이트가 `silent_failure`으로 잡는 것은 빙산의 일각이다):

1. **빈 catch** — `catch {}`·`except: pass`. 에러를 Nothing으로 바꾼 곳.
2. **부실 로깅** — 맥락 없는 로그·잘못된 심각도·log-and-forget.
3. **위험한 fallback** — 실패를 감추는 기본값 (`.catch(() => [])`류). 그럴듯해 보여서 하류 진단을 어렵게 한다.
4. **전파 손실** — 날아간 스택트레이스·뭉뚱그린 rethrow·빠진 async 처리.
5. **누락된 처리** — 네트워크·파일·DB 경로의 타임아웃/에러 처리 없음, 트랜잭션 작업의 롤백 없음.

계획에 포함된 리뷰어만 실행하고, 결과를 `{source, file, line, severity, message}` 배열로 정규화한다.

## 3. 병합과 게이트

정규화된 findings를 심각도순으로 병합해 사용자에게 보인다(`mergeFindings` 형식). 같은 위치를 두 리뷰어가 지적하면 신뢰도가 높다고 표시한다.

- **CRITICAL/HIGH 0개** → 통과. `nereus:finish`로.
- **MEDIUM 이하만** → 루프에 넣지 않는다. 이 세션의 handoff 에 한 줄씩 기록하고 `nereus:finish`로 (최종 리뷰가 merge 전 triage한다).

심각도별 액션 (`review.mjs`의 `severityAction`):

| 심각도 | 액션 | 의미 |
|---|---|---|
| CRITICAL | `fix-now` | 즉시수정. 수정 루프에 진입한다 |
| HIGH | `must-resolve` | 해결 전 진행금지. 수정 루프에 진입한다 |
| MEDIUM 이하 | `defer-ledger` | 연기 + ledger에 기록하고 `nereus:finish`로 |
| unknown | `defer-ledger` | 알 수 없는 심각도는 연기 기본값 |

### 3.1 수정 루프 상한 — 5라운드 (출처: superpowers SDD fix loop)

CRITICAL/HIGH가 남으면 fix 1회 + 스코프 재리뷰(고친 diff만, untouched 코드는 Out-of-Scope로 ledger행) 1회를 1라운드로 센다. 라운드 판정은 `review.mjs`의 `fixLoopStep(끝난라운드, 잔여blocking)`을 따른다:

- **R1–3: resume** — 같은 맥락에서 이어서 고친다 (TDD: 회귀 테스트 먼저). 컨텍스트가 끊겼으면 brief·report·findings를 통째로 넘긴 fresh dispatch로 대체한다.
- **R4–5: escalate** — fresh + 한 티어 위 모델로 바꾼다. 3번 이어 고쳤는데 안 되면 고친 주체가 자기 문제를 못 보는 것이다. 티어는 build §5 비용 티어표를 따른다.
- **R5 후에도 잔존: breaker** — 그만 고치고 각 항목을 판정해 사용자에게 확인받는다. 리뷰어가 틀렸거나 contestable하면 park + Ruling 기록. 진짜인데 하류가 안 얹히면 park + deferred. 진짜이고 load-bearing이면 (다음 작업이 얹히거나 계획 결함을 드러내면) 최소 변경을 rule로 정해 다음 build에 넘긴다. 조용히 버리지 않는다.

"고치면 될 것 같으니 한 번만 더"는 5라운드 이후의 변명이다. 라운드가 수렴하지 않으면 구조 문제다.

## 4. 기록

`.nereus/review.md`에 findings와 처리 결과를 남긴다. handoff.md 현재 단계를 갱신한다. 판정·연기는 common의 Ruling 형식으로 기록한다.
