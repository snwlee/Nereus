# add-final-wiring

## Why

세 사이클이 만든 것 중 **배선이 빠진 채 남은 것들**이 있다. 라이브러리가 있어도 아무도 부르지 않으면
없는 것과 같다 — 이 프로젝트에서 반복해 물린 부류다.

1. **`lib/luau-exec.mjs` 를 아무도 부르지 않는다.** 3차에서 만들었고 테스트도 있지만
   finish 게이트가 호출하지 않는다. 로블록스의 DataModel 의존 코드는 여전히 검증되지 않는다.
2. **OCR 리뷰어는 처음부터 쓸 수 있었다.** `ocr delegate preview` 에 `--from`/`--to` 가 있다.
   실측 `--from HEAD~12 --to HEAD` → `9 reviewable / 32 total`, `mode: range`.
   세 사이클 동안 handoff 에 "커밋된 diff 를 못 본다"고 기록했고 **그것이 틀렸다.**
   원인은 도구 한계가 아니라 인자 없이 호출한 것이다. 2차 의견 부재의 실제 원인이 여기였다.
3. **에셋 파이프라인이 전제 도구를 확인하지 않는다.** 모델 실행은 못 해도
   무엇이 없어서 어느 단계가 막히는지는 지금 판정할 수 있다.
4. 장르 프로파일이 2종뿐이다. `battle-pvp` 의 실패 양상은 **지배 전략**으로 병목·절벽과 축이 다르다.

## What Changes

- `plugins/nereus/skills/review/scripts/review.mjs` — `ocrDelegateArgs(base)` 추가.
  review 스킬이 base 를 넘겨 `--from`/`--to` 로 호출하게 한다.
- `plugins/nereus-game/lib/roblox-gate.mjs` — 로블록스 프로젝트에서 2단 테스트를 시도하는 얇은 배선.
  자격증명이 없으면 **미설정으로 알리고 통과시킨다**. 막으면 키 없는 세션에서 finish 가 불가능해진다.
- `plugins/nereus-game/lib/asset-doctor.mjs` — 파이프라인 단계별 전제 도구 가용 판정.
  없다고 실패시키지 않고 어느 단계가 왜 막히는지 알린다.
- `profiles/battle-pvp.json` · `profiles/narrative.json` — 실패 양상 `dominant-strategy` 축 추가.
  `balance-sim` 이 지배 전략을 판정한다.

## Impact

- 영향 스펙: `plugin-packaging`(OCR 호출 계약), `game-harness`(2단 게이트 배선·에셋 doctor·프로파일)
- 영향 코드: `plugins/nereus/skills/review/scripts/review.mjs`(수정),
  `plugins/nereus-game/lib/{roblox-gate,asset-doctor,balance-sim}.mjs`, `profiles/*.json`
- 범위 밖: 실기기 검증, 생성 모델 실제 실행, AltTester
