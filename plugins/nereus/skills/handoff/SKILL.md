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
   node "${CLAUDE_PLUGIN_ROOT}/skills/handoff/scripts/auto-clear.mjs" &
   ```

   Orca 터미널 밖이거나(`ORCA_TERMINAL_HANDLE` 없음), `autoClear.enabled: false` 이거나, 미커밋 변경이 남아 있으면 스스로 아무것도 하지 않는다. 그때는 사용자가 직접 `/clear` 를 친다.

그 다음 새 작업을 시작하지 않는다.
