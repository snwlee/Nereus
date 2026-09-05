---
name: continue
description: 같은 세션에서 남은 태스크를 자동으로 이어가게 켜고 끈다(Stop 재진입). "자동으로 계속", "멈추지 말고", "continue on/off" 요청 시. 기본은 꺼져 있다.
---

# continue — 세션 내 자동 계속

Stop 훅이 종료를 가로채 다음 미완료 태스크를 이어가게 한다. `/nereus:loop`(반복마다 **새 세션**)와 달리 **같은 세션**에서 계속하므로 컨텍스트가 계속 쌓인다. 그래서 횟수 제한과 컨텍스트 경고선에서 자동 해제가 걸려 있다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/continue/scripts/arm.mjs" on --max 5
node "${CLAUDE_PLUGIN_ROOT}/skills/continue/scripts/arm.mjs" off
node "${CLAUDE_PLUGIN_ROOT}/skills/continue/scripts/arm.mjs" status
```

## 규칙
- 기본 꺼짐. 사용자가 명시적으로 요청할 때만 켠다.
- `--max` 기본 5, 상한 20. 한 번 이어갈 때마다 1씩 줄고 0이 되면 해제된다.
- 태스크 파일이 없거나 전부 체크됐으면 켜지지 않는다.
- **컨텍스트가 `baton.warn`(기본 50%)을 넘으면 스스로 해제**되고 핸드오프를 요구한다. 컨텍스트가 찬 상태로 계속 밀어붙이는 것이 가장 나쁜 결과이기 때문이다.
- Claude Code가 이미 Stop 훅 때문에 멈춘 경우(`stop_hook_active`)에는 절대 재진입하지 않는다. 무한 루프 방지.
- 사용자가 중간에 끼어들면 그 지시가 우선이다. 자동 계속을 이유로 사용자 요청을 미루지 않는다.

## 언제 쓰나
태스크가 잘게 쪼개져 있고 각각 독립적이며, 컨텍스트 여유가 충분할 때. 태스크 하나가 크거나 설계 판단이 필요하면 켜지 말고 사람이 확인하며 진행한다. 긴 작업은 `/nereus:loop`가 낫다.
