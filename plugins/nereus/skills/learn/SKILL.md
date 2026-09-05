---
name: learn
description: 사용자 교정·실패한 접근·선호를 규칙으로 남겨 다음 세션에 자동 주입한다. "이거 기억해", "다음부터 이렇게", 교정받은 직후에 사용.
---

# learn — 세션에서 배운 것 남기기

같은 지적을 두 번 받지 않기 위한 저장소다. 규칙은 `.nereus/learnings.jsonl`(프로젝트) 또는 설정 디렉터리(전역)에 쌓이고, 다음 세션 시작 때 신뢰도 높은 것만 예산 안에서 주입된다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/learn/scripts/learn.mjs" add --trigger "<언제>" --rule "<무엇을>" [--source correction|failure|preference] [--global]
node "${CLAUDE_PLUGIN_ROOT}/skills/learn/scripts/learn.mjs" list
```

## 무엇을 남기나
- **교정**: 사용자가 "그게 아니라"라고 한 것 중 **다음에도 적용될** 것.
- **실패한 접근**: 시도했다가 안 된 방법과 이유. handoff.md의 MUST NOT과 같은 내용이면 여기에도 남긴다.
- **선호**: 반복 확인된 취향(도구 선택, 형식, 언어).

## 무엇을 남기지 않나
- 이번 한 번만 해당하는 지시("이 파일은 지금 지워줘").
- 코드나 문서를 보면 알 수 있는 사실(구조, 함수 이름). 그건 CLAUDE.md나 코드가 할 일이다.
- 비밀값, 개인정보.

## 형식
`trigger`는 규칙이 적용되는 상황, `rule`은 그때 무엇을 할지. 둘 다 한 줄로 구체적으로 쓴다.
- 좋음: trigger `PDF 만들 때` / rule `템플릿은 report, 폰트는 시스템 기본 폴백을 쓴다`
- 나쁨: trigger `항상` / rule `잘 하자`

## 신뢰도
새 규칙은 0.5로 시작하고 같은 규칙이 다시 확인될 때마다 0.2씩 올라 최대 1.0이 된다. 기본 주입 기준은 0.7 이상이므로 **한 번 더 확인된 규칙부터 자동 주입**된다. 예산은 설정 `learnings`(minConfidence, limit, maxChars)로 조절한다.

틀린 규칙을 발견하면 jsonl에서 그 줄을 지우거나 사용자에게 알린다. 조용히 무시하지 않는다.
