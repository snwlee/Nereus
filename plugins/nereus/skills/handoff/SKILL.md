---
name: handoff
description: 지금 상태를 .nereus/handoff.md에 전체 재작성하고 커밋해 세션을 넘길 준비를 한다. "/nereus:handoff", "핸드오프", "여기까지 저장하고 끊자", "다음 세션에 넘겨" 요청 시, 또는 Baton 경고를 받았을 때 사용.
---

# handoff

1. nereus:baton 형식으로 `.nereus/handoff.md`를 **전체 재작성**한다. 이전 내용에 덧붙이지 않는다.
2. "진행 중" 섹션에는 실제 테스트 실행 결과(RED/GREEN)를 넣는다. 실행하지 않았으면 실행한다.
3. "실패한 접근과 이유"를 빠뜨리지 않는다. 없으면 "없음".
4. `git add -A && git commit -m "chore(baton): handoff <단계>/<태스크>"`. 커밋할 것이 없으면 생략.
5. 사용자에게 세 줄로 보고: 어디까지 했는지, 다음이 무엇인지, 새 세션에서 `/nereus:resume`.

그 다음 새 작업을 시작하지 않는다.
