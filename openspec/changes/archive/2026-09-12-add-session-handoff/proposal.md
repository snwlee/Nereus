# add-session-handoff

## Why

`.nereus/handoff.md` 는 cwd 당 한 파일이고(`paths.mjs:23`) handoff 규칙은 "전체 재작성"이다.
같은 프로젝트에서 세션을 두 개 띄우면 두 번째 세션이 첫 세션의 상태를 통째로 덮는다.
`.gitignore` 가 `.nereus/*` 를 무시하므로 git 도 이 유실을 잡아주지 못하고, 경고도 감지도 없다.

같은 뿌리에서 두 번째 구멍이 난다. `loop-runner.runWave` 는 병렬 태스크를 워크트리로 잘 격리하지만,
`.nereus/` 가 추적 밖이라 (a) 서브세션은 handoff 없이 시작하고 (b) 서브세션이 쓴 handoff 는
워크트리 제거와 함께 사라지며 (c) 러너는 메인 handoff 를 갱신하지 않는다. wave 반복이 끝나면
메인 handoff 는 wave 이전 상태를 말한다. 태스크 1개 그룹은 루트에서 돌아 정상 갱신되므로 지금까지 드러나지 않았다.

## What Changes

- handoff 를 세션별 파일로 분리한다: `.nereus/handoff/<YYYYMMDD-HHmm>-<sid8>.md`.
  **쓰기는 자기 세션 파일, 읽기는 가장 최근 파일.** `/clear` 재개는 그대로 동작한다.
- 모델은 자기 session_id 를 모르므로 **SessionStart 훅이 이 세션의 handoff 경로를 주입**한다.
  handoff·finish 스킬은 그 경로에만 쓴다.
- 최근 30분 안에 다른 세션이 갱신한 handoff 가 있으면 재개 블록 끝에 경고 한 줄을 붙인다.
- 보존: 최근 10개 유지, 30일 초과 삭제. 훅이 조용히 정리한다.
- `runWave` 가 **병합 전에** 각 워크트리의 최신 handoff 를 `.nereus/waves/<이름>.md` 로 회수하고,
  프롬프트가 다음 반복에게 그것을 흡수하고 지우라고 지시한다.
- 루프 서브세션(`NEREUS_LOOP=1`)에는 다른 세션 경고를 내지 않는다. 반복마다 새 세션이라 매번 뜬다.

## Impact

- Specs: `baton-handoff`(MODIFIED+ADDED), `session-start`(MODIFIED+ADDED), `baton-loop`(MODIFIED+ADDED)
- Code: `hooks/scripts/lib/paths.mjs`, `hooks/scripts/session-start.mjs`, `skills/baton/scripts/loop-runner.mjs`
- Docs: `skills/{handoff,baton,resume,finish,loop}/SKILL.md`
- 하위 호환: 기존 `.nereus/handoff.md` 는 읽기 후보로 남는다(최신 판정 참여). 마이그레이션 스크립트는 없다.
