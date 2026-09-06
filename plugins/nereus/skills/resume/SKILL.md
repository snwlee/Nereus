---
name: resume
description: 이전 세션 handoff.md를 검증하고 이어서 작업. 수동 재개용 — /clear 후에는 SessionStart 훅이 자동으로 같은 일을 한다.
---

# resume

> **보통은 칠 필요가 없다.** `/clear` 하면 SessionStart 훅이 handoff.md 를 다시 주입하면서
> 아래 절차를 그대로 지시한다. 이 스킬은 수동 재개용이다 — 다른 tasks 파일을 지정하거나,
> 주입이 없는 상태에서 명시적으로 이어받을 때.

1. `.nereus/handoff.md`를 읽는다. 없으면 "핸드오프 없음. /nereus:intake 로 시작하거나 tasks 파일을 알려달라"고 하고 멈춘다.
2. **검증**: "테스트 상태"에 적힌 러너를 실제로 실행해 handoff의 주장과 맞는지 확인한다. 다르면 handoff가 아니라 현재 코드가 진실이다. 차이를 사용자에게 알린다.
3. `git log --oneline -5`와 `git status`로 미커밋 변경을 확인한다.
4. "현재 단계"에 해당하는 스킬(nereus:build 등)로 "다음"의 첫 항목부터 이어간다. "실패한 접근"에 있는 방법은 다시 시도하지 않는다.
5. "열린 질문"이 있으면 작업 전에 사용자에게 먼저 묻는다.
