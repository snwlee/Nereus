---
name: handoff
description: 현재 상태를 .nereus/handoff.md에 전체 재작성하고 커밋. "핸드오프", "여기까지 저장", Baton 경고 시.
---

# handoff

1. nereus:baton 형식으로 `.nereus/handoff.md`를 **전체 재작성**한다. 이전 내용에 덧붙이지 않는다.
2. "진행 중" 섹션에는 실제 테스트 실행 결과(RED/GREEN)를 넣는다. 실행하지 않았으면 실행한다.
3. "실패한 접근과 이유"를 빠뜨리지 않는다. 없으면 "없음".
4. `git add -A && git commit -m "chore(baton): handoff <단계>/<태스크>"`. 커밋할 것이 없으면 생략.
5. 사용자에게 세 줄로 보고: 어디까지 했는지, 다음이 무엇인지, `/clear` 만 치면 재개는 자동이라는 것.
6. 커밋까지 끝났으면 `/clear` 와 재개 입력을 자동화한다 — **백그라운드로** 띄운다(현재 턴이 끝나야 TUI 가 입력을 받는다).

   ```bash
   nohup node "${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/auto-clear.mjs" >/dev/null 2>&1 &
   disown 2>/dev/null || true
   ```

   `nohup` + `disown` 으로 **완전히 분리**한다. 이 스크립트는 턴이 끝나기를 기다렸다가 입력을 넣으므로, 턴 종료와 함께 죽으면 영영 동작하지 않는다. 그냥 `&` 만 쓰면 안 된다.

   Orca 터미널 밖이거나(`ORCA_TERMINAL_HANDLE` 없음) `autoClear.enabled: false` 이면 스스로 아무것도 하지 않는다. 턴이 실제로 끝났는지 확인하지 못해도 `/clear` 를 보내지 않는다 — 턴 도중에 보내면 입력이 삼켜진다. 그때는 사용자가 직접 `/clear` 를 친다.

   미커밋 변경은 막지 않는다. `/clear` 는 파일도 git 상태도 건드리지 않고 대화 컨텍스트만 비우며, 그 맥락은 방금 쓴 handoff.md 가 담고 있다.

   **안 됐을 때는 `.nereus/auto-clear.log` 를 본다.** 매 실행이 이유와 함께 남는다(`조건 불충족 …`, `유휴 확인 실패(…)`, `유휴 확인(quiet)`, `전송 /clear → ok`).

그 다음 새 작업을 시작하지 않는다.
