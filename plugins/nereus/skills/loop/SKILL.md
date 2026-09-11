---
name: loop
description: Long-running autonomous reset loop — each iteration is a fresh session that finishes one task and commits. 트리거: "루프 돌려", "끝날 때까지 자동".
---

# loop

## 전제
- tasks 파일이 있고 각 태스크에 완료 조건이 있다(nereus:spec 규칙). 없으면 먼저 spec.
- 작업 브랜치에 있다(main 직접 금지). 없으면 `git switch -c baton/<slug>` 제안.
- 테스트 러너가 있다. 없으면 루프의 완료 판정이 약해진다고 경고.

## 실행

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/baton/scripts/loop-runner.mjs" --goal "<목표 한 줄>" --tasks <tasks 경로> [--spec <스펙 경로>] [--max 30] [--gate "<검증 명령>"] [--timeout <초>]
```

러너는 반복마다 `claude -p`를 새로 띄운다(컨텍스트 리셋). 각 반복은 handoff.md → 첫 미완료 태스크 → TDD → 체크 → handoff 재작성 → 커밋. 반복 끝에 미커밋 변경이 있으면 러너가 체크포인트 커밋을 만든다.

## wave 병렬 (`[wave:N]` 태그)

태스크에 `[wave:N]` 을 붙이면 **인접한 같은 번호**가 한 wave 로 묶여 병렬 실행된다. 태그가 없으면
기존처럼 하나씩 순차로 돈다 — **태그 자체가 옵트인**이라 별도 플래그가 없다.

```markdown
- [ ] [wave:1] 로그인 API — 완료 조건: npm test -- auth 통과
- [ ] [wave:1] 결제 API — 완료 조건: npm test -- pay 통과
- [ ] [wave:2] 두 API 를 묶는 화면 — 완료 조건: npm test -- checkout 통과
```

wave 1 의 두 태스크가 동시에 돌고 **둘 다 끝난 뒤** wave 2 가 시작된다.

### 병렬은 반드시 격리된다
태스크가 2개 이상인 wave 는 각자 `git worktree`(`.nereus/worktrees/wave-<i>-<slug>`)에서 돌고,
각 워크트리에서 커밋한 뒤 **순차로** 병합된다. 같은 워크트리에서 `claude -p` 를 동시에 띄우면
두 프로세스가 같은 파일을 편집하고 서로의 변경을 커밋한다 — 실제로 겪은 사고다.
태스크가 1개인 wave 는 메인 워크트리에서 그대로 돈다(격리 비용 0).

### 충돌하면 멈춘다
병합 충돌이 나면 `git merge --abort` 로 **저장소를 되돌리고** 루프를 `conflict` 로 끝낸다.
태스크 브랜치(`baton/wave-*`)는 **지우지 않는다** — 그 작업을 살릴 수 있어야 한다.
열린 재시도로 덮지 않는다. 사람이 브랜치를 보고 푼다.

### wave 를 나누는 규칙
- **떨어져 있는 같은 번호는 합치지 않는다.** 선언 순서에 의존성이 암묵적으로 들어 있어서,
  `[wave:1] a` / `[wave:2] b` / `[wave:1] c` 에서 a·c 를 합치면 b 를 앞지른다.
- 같은 wave 에 **같은 파일을 만지는 태스크를 넣지 않는다.** 충돌로 끝난다. 그래서 wave 는
  spec 단계에서 파일이 겹치지 않게 쪼갠 태스크에만 붙인다.
- `[wave:0]` 이나 `[wave:abc]` 같은 오타는 무시하고 순차로 취급한다(추측하지 않는다).

## 종료 코드
- `converged`: 전부 체크 + `ooo qa` 통과. nereus:review 로 넘어간다.
- `max_reached`: 진행은 있으나 끝나지 않음. handoff를 보고 max를 늘리거나 태스크를 쪼갠다.
- `conflict`: wave 병합 충돌. 저장소는 되돌아갔고 `baton/wave-*` 브랜치가 남아 있다. 그 브랜치를 보고 수동 병합하거나 태스크를 다시 쪼갠다.
- `stuck`: 같은 태스크(또는 같은 wave 조합) 3회 실패. `ooo unstuck`을 그 태스크에 대해 실행하고 결과를 사용자에게 보인다. 자동으로 재시작하지 않는다.
- `gate_blocked`: 게이트 3회 **연속** 실패. 체크박스는 넘어가는데 검증이 계속 깨지는 경우다 — 저장소가 깨진 채로 max 까지 걸어가지 않는다. 커밋은 남아 있으니 `git log` 에서 `(게이트 실패: ...)` 표시된 체크포인트부터 본다.
- `budget_exhausted`: `--timeout` 소진. 미커밋 변경을 그대로 두고 멈춘다.

## 주의
- 루프는 사용자가 명시적으로 요청할 때만. 비용이 크다(반복당 세션 1개).
- 사용자가 자리를 비우는 실행이면 `--max`를 10 이하로 시작하라고 권한다.

## 자율 게이트 (출처: Prime Agent autonomous gate)

매 반복 끝, **커밋 직전**에 게이트를 돌린다. 판정은 `hooks/scripts/lib/autonomous-gate.mjs` 의
`autonomousGate()` 가 유일한 진실원천이고, `loop-runner.mjs` 의 `runLoop` 이 이를 호출한다.

- **게이트 명령**: `--gate "<cmd>"` (종료코드 0만 통과). 없으면 수렴 판정과 같은 `ooo qa` 를 쓴다.
  `ooo` 도 없으면 통과 처리한다 — 검증 도구가 없으면 게이트도 없다.
- **무변경이면 skip**. 게이트를 아예 돌리지 않는다.
- **게이트 실패는 커밋을 막지 않는다.** 작업 유실이 더 나쁘다. 대신 커밋 메시지에
  `(게이트 실패: <이유>)` 를 남기고, **그 반복을 "진행"으로 세지 않는다** — 서브세션이 채운
  체크박스를 그대로 믿지 않는 지점이다.
- **연속 3회 실패면 `gate_blocked` 로 멈춘다.** 기존 `stuck`(같은 태스크 3회)은 태스크 키로 세기
  때문에, 체크박스가 넘어가면 키가 바뀌어 리셋된다. 게이트 실패는 태스크가 아니라 저장소 상태의
  문제라 따로 센다. 판정 순서는 `stuck` 이 먼저다.
- **`--timeout <초>` 소진 시 `budget_exhausted`.** 토큰 바운드는 루프에서 측정할 수 없어 쓰지 않고,
  턴 바운드는 `--max`(`max_reached`)가 이미 담당한다.

### 서브세션 권한

반복은 `claude -p --permission-mode acceptEdits` 로 뜬다. acceptEdits 는 **파일 편집만** 자동
승인하므로, 그대로 두면 서브세션이 테스트를 못 돌린다 — 비대화형 세션에서 Bash 승인 요청은
곧 거부다. 실제로 wave 서브세션 둘이 테스트를 한 번도 못 돌리고 `tdd-override` 로 RED 없이
구현한 사고가 있었다. 그래서 러너·git 커밋까지를 `--allowedTools` 로 연다(`LOOP_ALLOWED_TOOLS`).

**`bypassPermissions` 로 올리지 않는다.** 루프는 사람이 안 보는 동안 도는데 거기서 전권을
주면 되돌릴 수 없는 일이 조용히 일어난다. `git push` 도 넣지 않는다 — 원격에 나가는 것은
사람이 보고 결정할 일이다.

### 한계 (알고 쓸 것)
wave 병렬(태스크 2개 이상)에서는 각 워크트리가 **먼저 커밋·병합된 뒤** 게이트가 돈다. 즉 병렬
경로에서 게이트는 사후 검증이고, 깨진 커밋이 들어오는 것 자체를 막지 못한다. 막으려면 게이트를
`runWave` 안 워크트리별 커밋 앞으로 내려야 한다 — 아직 하지 않았다.
