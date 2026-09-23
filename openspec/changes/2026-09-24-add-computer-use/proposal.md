# add-computer-use

## Why

에이전트가 **브라우저 페이지가 아닌 네이티브 창**(Roblox Studio 저장 대화상자, 앱 설정 창)을
조작해야 할 때 Nereus 에는 절차가 없었다. 2026-09-24 RobloxGame 세션에서 osascript `keystroke` 로
Studio 저장을 시도하다 다섯 가지가 한꺼번에 틀렸다.

1. 대화상자가 **보조 모니터**(x=1955)에 떠서 주 화면 캡처에 안 잡혔다.
2. 버전 제목이 50자 제한을 넘어(59/50) Save 가 **비활성**이었다. 화면을 보기 전까지 저장된 줄 알았다.
3. 좌표 클릭이 먹지 않아 텍스트가 **다른 칸**에 들어갔다.
4. 이후 키 입력은 반영조차 안 됐다 — **키가 어디로 가는지 모르는 상태**에서 계속 보낼 뻔했다.
5. Qt 대화상자 내부는 접근성 트리에 **안 보였다**(버튼이 close/zoom/minimize 뿐).

전역 포커스에 키를 쏘는 방식은 대상이 아닌 앱에 입력을 넣을 수 있다. 되돌릴 수 없는 사고다.

## What Changes

- 새 스킬 `nereus:computer-use` — 통로 판정 → 대상 확인 → pid 지정 입력 → 행동마다 검증 → 되돌리기 어려운 행동은 승인.
- `scripts/judge.mjs` (순수): 설치·권한·요청 위험도로 통로(`cua` · `orca` · `vision` · `lume` · `none`)와
  판정(`go` · `ask` · `block`)을 낸다.
- `scripts/probe.mjs` (얇은 CLI): `cua-driver`·`orca`·`lume`·HID 유휴 시간을 실측해 judge 에 넘긴다.
- 라우터에 `nereus:computer-use` 라우트 추가.

## Impact

- 새 파일: `plugins/nereus/skills/computer-use/{SKILL.md,scripts/judge.mjs,scripts/probe.mjs}`
- 수정: `plugins/nereus/hooks/scripts/lib/router.mjs` (ROUTES 끝에 1줄), 버전·스킬 수 표기
- 테스트: `tests/skills/computer-use.test.ts`, `tests/lib/router.test.ts`
