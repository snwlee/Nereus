---
name: hud
description: statusline 한 줄 상태(태스크 진행률·검증 상태·컨텍스트 %)를 출력하거나 설치를 안내한다. "상태 표시", "statusline", "HUD" 요청 시.
---

# hud — 한 줄 상태

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/hud/scripts/hud.mjs" [--cwd <path>] [--session <id>]
```
출력 예: `⚓ 3/7 · 미검증 · 54%`

| 표시 | 뜻 |
|---|---|
| `3/7` | tasks 파일 체크박스 진행률 |
| `계획` | 태스크는 있으나 아직 완료된 것이 없음 |
| `작업중` | 일부 완료 |
| `미검증` | **태스크는 전부 체크됐는데 테스트 evidence가 FRESH·통과가 아님.** 완료라고 보고만 된 상태 |
| `검증됨` | 태스크 완료 + evidence FRESH + 통과 |
| `54%` | 컨텍스트 사용률(statusline 연동 시) |

`미검증`이 핵심이다. 체크박스만 채우고 테스트를 돌리지 않은 상태를 눈에 보이게 한다.

## statusline에 붙이기
사용자의 statusline 스크립트에 아래를 추가한다(`$input`은 statusline이 stdin으로 받은 JSON).
```bash
sid=$(printf '%s' "$input" | jq -r '.session_id // empty')
node "<플러그인 경로>/skills/hud/scripts/hud.mjs" --session "$sid"
```
statusline이 없으면 `/nereus:setup`이 만드는 것을 돕는다. HUD 없이도 훅은 정상 동작한다.
