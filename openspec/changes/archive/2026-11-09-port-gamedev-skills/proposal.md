# port-gamedev-skills

## Why

`gamedev-skills/awesome-gamedev-agent-skills`(Apache-2.0, 77개)를 nereus-game 과 대조했더니,
저쪽은 엔진 API 참고서이고 이쪽은 판정 게이트라 대부분 겹치지 않았다. 다만 네 곳에서 이쪽이 비어 있다:

1. `sim-tycoon` 은 병목·절벽만 재고 **증분·방치형 페이싱**(환생 대기 비율·가격 성장·오프라인 수익·정밀도)을 재지 않는다.
2. `level` 은 "생성 결과를 검증 규칙과 짝지운다"고 적어두고 **퍼즐 판 검증기**가 없다.
3. **세이브**와 **프레임 예산** 축이 아예 없다. 세이브 소실은 되돌릴 수 없고, 프레임 예산 없는 성능 작업은 "빨라졌을 것"으로 끝난다.
4. `roblox` 리뷰 체크리스트가 Remote 검증·DataStore 세션 잠금을 말하면서 **근거 자료**가 없다.

## What Changes

- `lib/economy-curve.mjs` + `profiles/sim-tycoon.json` 의 `pacing` — 페이싱 판정(`checkPacing`).
- `lib/puzzle-board.mjs` — 초기 매치·데드락·슬라이딩 패리티 판정(`checkBoard`). `level` 이 부른다.
- `skills/save` + `lib/save-check.mjs`, `skills/perf` + `lib/frame-budget.mjs` — 새 도메인 축 2개와 라우트.
- `skills/roblox/references/` 3장 + `skills/roblox/templates/` Luau 경제 수식·테스트(lune).
- `NOTICE` 에 Apache-2.0 귀속, `LICENSES/Apache-2.0.txt` 동봉.

**unity-\* 는 이식하지 않는다.** `unity/SKILL.md §4` 가 엔진 API 를 공식 플러그인에 위임했다 —
"남이 정하고 남이 바꾸는 값은 우리가 복사해두지 않는다". 로블록스도 같은 이유로 API 튜토리얼이 아니라 판단 지식만 가져온다.

## Impact

- 새 라우트 2개(`save`, `perf`). `perf` 는 `nereus-3d:renderbudget` 의 "프레임 드랍·드로우 콜" 을 피한다.
- `balance-sim.mjs`·`casual-puzzle.json` 은 건드리지 않는다(진행 중인 `add-balance-lives-axis`).
