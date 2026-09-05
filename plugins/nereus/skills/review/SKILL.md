---
name: review
description: 변경 사항을 Open Code Review(delegation)와 2차 의견(Codex, Antigravity CLI(agy, Gemini))으로 병렬 리뷰하고 심각도별로 병합한다. CRITICAL/HIGH가 0이어야 통과. "/nereus:review", "리뷰해", "코드 검토", "2차 의견" 요청 시, 그리고 build 게이트 통과 직후 자동으로 사용.
---

# review

nereus:common 규칙을 따른다. 담당 에이전트: reviewer. 인증·입력 처리·외부 호출·파일시스템·DB 쿼리를 만진 변경이면 security 에이전트도 함께 투입한다.

## 0. 사전 게이트
`node "${CLAUDE_PLUGIN_ROOT}/skills/finish/scripts/gate.mjs"`를 먼저 돌린다. evidence가 FRESH·통과가 아니거나 완료 무결성 항목이 있으면 리뷰어를 부르지 않고 build로 돌려보낸다. 리뷰어 비용을 아끼고, 리뷰어가 스텁·TODO를 지적하느라 진짜 결함을 놓치는 일을 막는다.

## 1. 계획

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/review.mjs"
```
설정 `secondOpinion`(both/codex/gemini)과 설치 상태로 어떤 리뷰어가 돌지 나온다. `skipped`가 있으면 사용자에게 알린다(차단은 아님).

## 2. 병렬 실행

리뷰 대상은 `git diff <base>...HEAD` (base 기본 `main`, 미커밋 작업이면 워크스페이스).

- **OCR delegation**: `ocr delegate preview`로 리뷰할 파일과 룰을 받고, 파일별 `ocr delegate rule <files>`로 룰을 받아 **이 세션의 모델이 직접** 리뷰한다. OCR이 API 키로 직접 리뷰하게 설정돼 있으면 `ocr review --format json --output .nereus/review-ocr.json`을 쓴다.
- **Codex**: `codex review` (또는 codex 플러그인의 `/codex:adversarial-review`). 결과를 파일·줄·심각도·메시지로 정리한다.
- **Gemini (Antigravity CLI)**: `agy -p "다음 diff를 리뷰하고 file:line, severity(CRITICAL/HIGH/MEDIUM/LOW), message 형식의 JSON 배열로만 답하라: $(git diff ...)"`.

세 결과를 `{source, file, line, severity, message}` 배열로 정규화한다.

## 3. 병합과 게이트

정규화된 findings를 심각도순으로 병합해 사용자에게 보인다(`mergeFindings` 형식). 같은 위치를 두 리뷰어가 지적하면 신뢰도가 높다고 표시한다.

- **CRITICAL/HIGH 0개** → 통과. `nereus:finish`로.
- 아니면 각 항목을 고치고(TDD: 회귀 테스트 먼저) 다시 review. 리뷰어 지적이 틀렸다고 판단하면 이유를 적고 사용자에게 확인받는다. 조용히 무시하지 않는다.

## 4. 기록

`.nereus/review.md`에 findings와 처리 결과를 남긴다. handoff.md 현재 단계를 갱신한다.
