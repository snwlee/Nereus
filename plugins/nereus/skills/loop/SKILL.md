---
name: loop
description: 장기 자율 reset 루프. 반복마다 새 세션이 태스크 하나를 끝내고 커밋. "루프 돌려", "끝날 때까지 자동" 요청 시.
---

# loop

## 전제
- tasks 파일이 있고 각 태스크에 완료 조건이 있다(nereus:spec 규칙). 없으면 먼저 spec.
- 작업 브랜치에 있다(main 직접 금지). 없으면 `git switch -c baton/<slug>` 제안.
- 테스트 러너가 있다. 없으면 루프의 완료 판정이 약해진다고 경고.

## 실행

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/baton/scripts/loop-runner.mjs" --goal "<목표 한 줄>" --tasks <tasks 경로> [--spec <스펙 경로>] [--max 30]
```

러너는 반복마다 `claude -p`를 새로 띄운다(컨텍스트 리셋). 각 반복은 handoff.md → 첫 미완료 태스크 → TDD → 체크 → handoff 재작성 → 커밋. 반복 끝에 미커밋 변경이 있으면 러너가 체크포인트 커밋을 만든다.

## 종료 코드
- `converged`: 전부 체크 + `ooo qa` 통과. nereus:review 로 넘어간다.
- `max_reached`: 진행은 있으나 끝나지 않음. handoff를 보고 max를 늘리거나 태스크를 쪼갠다.
- `stuck`: 같은 태스크 3회 실패. `ooo unstuck`을 그 태스크에 대해 실행하고 결과를 사용자에게 보인다. 자동으로 재시작하지 않는다.

## 주의
- 루프는 사용자가 명시적으로 요청할 때만. 비용이 크다(반복당 세션 1개).
- 사용자가 자리를 비우는 실행이면 `--max`를 10 이하로 시작하라고 권한다.
