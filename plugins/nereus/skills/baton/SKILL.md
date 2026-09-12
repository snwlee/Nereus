---
name: baton
description: Context handoff rules and the handoff.md format. Referenced on a Baton warning and when resuming; call handoff/resume/loop for the actual action. 트리거: Baton 경고 시, 재개 시 참조. 직접 호출용 아님.
---

# Baton

진실은 디스크에만 있다: `.nereus/handoff/` 아래 이 세션의 handoff 파일, tasks 파일, git 커밋. 대화 기억은 믿지 않는다.

**쓰기는 자기 세션 파일, 읽기는 최신 파일.** 파일명은 `시각-세션id8.md` 이고, 그 경로는 세션 시작
안내가 알려준다. 다른 세션의 파일은 열지도 쓰지도 않는다 — 같은 프로젝트에서 세션이 여럿
돌아도 서로의 상태를 덮지 않게 하기 위해서다. 옛 단일 파일 `.nereus/handoff.md` 는 읽기만 된다(레거시).

## handoff.md 형식 (매번 전체 재작성, 덧붙이지 않음)

```markdown
# Handoff — <프로젝트> (<YYYY-MM-DD HH:mm>)

## 목표
한 문단. 이 작업 단위가 끝나면 무엇이 참이 되는가.

## 현재 단계
intake | spec | build | e2e | review | finish 중 하나 + 진행 중인 태스크 이름.

## 완료
- 체크된 태스크와 커밋 해시.

## 진행 중
- 지금 손대던 파일과 어디까지 했는지. 테스트가 RED인지 GREEN인지.

## 다음
- 바로 이어서 할 1~3개.

## MUST NOT — 실패한 접근과 금지 사항
- `[latest]` 시도 → 왜 안 됐는지. 다음 세션이 반복하지 않도록. 없으면 "없음".
- 사용자가 금지한 것, 건드리면 안 되는 파일도 여기에.
- 더 이상 유효하지 않은 항목은 지우지 말고 `[superseded: 이유]`로 표시한다.

## 판단 기록 (Rulings)
- `Ruling: <판단> — <이유> (<태스크>)` 한 줄씩. 예: `Ruling: 토큰 만료 검사는 미들웨어에 둔다 — 컨트롤러 3곳 중복 제거 (T3)`.
- 컴팩션·루프 재시작 뒤 같은 판단을 다시 고민하지 않게 하는 것이 목적. 판단이 바뀌면 새 줄을 추가하고 옛 줄에 `[superseded]`.

## 결정
- 이 단위에서 내린 설계 결정과 근거. ADR이 있으면 링크.

## 열린 질문
- 사용자에게 물어야 할 것.

## 테스트 상태
- 러너, 마지막 실행 결과(통과/실패 수), 격리된 E2E.
```

## 임계값 동작

- **50%**(설정 `baton.warn`): 새 태스크 시작 금지. 현재 태스크만 마무리 → handoff 재작성 → 커밋 → 멈춤. 사용자에게 "/clear 만 치면 자동으로 이어집니다" 안내.
- **70%**(`baton.hard`): 즉시 handoff 재작성과 커밋만. 다른 도구 호출 금지.
- **80%**: Claude Code 자동 압축(`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`). Baton을 놓쳤을 때의 안전망일 뿐, 여기까지 오면 이미 늦은 것이다.
- 자동 압축이 먼저 오면 PreCompact 훅이 handoff 작성을 요구한다. 압축 뒤에도 handoff가 진실이다.

## 재개

SessionStart 훅이 **가장 최근 handoff**(mtime 기준)를 주입하고, 이 세션이 쓸 파일 경로를 함께 알린다.
최근 30분 안에 다른 세션이 handoff 를 갱신했으면 경고가 따라온다 — 같은 파일을 건드리는 중인지 확인한다.
재개 시 "진행 중"의 테스트 상태를 먼저 실제로 실행해 확인한 뒤 이어간다. 완료 항목은 반복하지 않는다.
