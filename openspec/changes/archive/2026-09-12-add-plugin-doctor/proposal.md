# add-plugin-doctor

## Why

사용자가 Nereus 를 설치하기 전부터 쓰던 다른 하네스 플러그인과 겹치면, 그 충돌을 사람이
직접 발견해야 한다. 실제로 두 번 그랬다(전역 CLAUDE.md 기록):

- superpowers 제거 — "replaced by nereus workflow — **double gates otherwise**"
- everything-claude-code 비활성 — "its **chrome-devtools MCP shadowed nereus's**"

현재 `/nereus:setup` 의 `detect.mjs` 는 CLI 바이너리 존재와 MCP 상주 비용만 본다. 다른
플러그인이 무엇을 설치했는지는 감지 대상이 아니다. 유일한 충돌 인지는 `ui-ux-pro-max`
주석 한 줄이고, 기계 게이트가 없다.

섀도잉은 특히 위험하다. 증상이 보이지 않는다 — 하나가 조용히 이기고 다른 하나는
존재하지 않게 된다.

## What Changes

- **ADDED** `plugin-doctor` capability: 설치된 플러그인의 표면(스킬·훅·MCP·에이전트·bin·
  settings.agent)을 인벤토리하고, 충돌을 HIGH/MEDIUM/LOW 로 판정하고, 처방을 돕는다.
- **MODIFIED** `session-start`: 플러그인 스냅샷을 비교해 **새 지문**이 생겼을 때만 한 줄 알린다.
- **MODIFIED** `harness-setup`: `/nereus:setup` 이 doctor 를 절차에 포함한다.
- 부수: `spec/references/reverse-spec.md` 가 OpenSpec CLI 를 통과하지 못하는 포맷을 지시하는
  결함을 고친다(이 사이클에서 실제로 걸렸다).

## Non-goals

- 처방 자동 적용의 **실환경** 검증. `settings.json` 쓰기는 임시 디렉터리 픽스처로만 테스트하고
  실제 전역 설정에는 이번 사이클에서 쓰지 않는다.
- 큐레이션 표 확장(superpowers·ecc 외).
- 설명문 의미 유사도 기반 스킬 트리거 경쟁 탐지 — 오탐이 많고 비결정론적이다.
- 다른 하네스 설정을 Nereus 로 마이그레이션하는 기능.

## Constraints

- 플러그인 런타임은 **Node 표준 라이브러리만**. 테스트는 vitest.
- doctor 는 `/plugin uninstall` 을 **실행하지 않는다**. 명령 문자열만 출력한다.
- 전역 설정 쓰기는 원장 + `--undo` 로 되돌릴 수 있어야 한다. 원자적 쓰기(임시파일+rename),
  원장은 append-only.

## 조사로 확정된 제약 (문서 확인 2026-09-10)

"유닛 비활성"이 전 범위에 가능하지 않다. 이것이 처방 설계를 규정한다.

| 유닛 | 파일로 끌 수 있나 |
|---|---|
| MCP 서버·툴 | ✅ `permissions.deny: ["mcp__<server>"]` |
| 서브에이전트 | ✅ `permissions.deny: ["Agent(<name>)"]` |
| 플러그인 스킬 | ❌ `skillOverrides` 는 플러그인 스킬에 적용 안 됨 |
| 플러그인 커맨드 | ❌ |
| 훅 | ❌ `disableAllHooks` 는 전부 끄고 statusline 까지 죽인다 |
| 플러그인 전체 | ✅ `enabledPlugins: {"<p>": false}` |

따라서 superpowers 이중 게이트(스킬)는 파일 수정으로 고칠 수 없다. doctor 는 수동 절차만
안내하고 고칠 수 있는 척하지 않는다.

플러그인 스킬은 `/plugin:skill` 로 네임스페이스되므로 슬래시 이름 충돌은 발생하지 않는다 —
구조적 검사에서 제외한다.
