# add-workflow-autonomy

## Why

하네스가 결정을 사용자에게 되돌려준다. 사용자는 매번 같은 답("그냥 하나씩 다 해")을 하느라 흐름이 끊긴다.

- `intake/SKILL.md:26` HARD-GATE 가 "intake.md 사용자 승인"을 요구한다 → 사이클마다 "시작할까요?".
- `intake/SKILL.md:14` small 판정이 인터뷰 생략을 "제안하고 동의하면" → 또 한 번.
- `intake/SKILL.md:43` 게이트가 "가정 표를 사용자가 승인" → 또 한 번.

같은 뿌리의 두 번째 구멍: 결정 지점이 흩어져 있다. `classify.mjs` 는 **신규/수정 축만** 보고,
규모 축과 "ooo 인터뷰를 돌릴지"는 어떤 코드도 결정하지 않아 intake 가 크기와 무관하게 항상 인터뷰를 돈다.
brownfield 에서는 요구가 코드에 있는데 인터뷰가 그것을 되묻는다(팬아웃 턴당 ~18k 토큰).

## What Changes

- `planWork({ cwd, size })` 신설 — `classify()` 를 감싸 **규모 × 신규/수정** 매트릭스로
  인터뷰 강도·스펙 도구·역스펙 필요 여부·PRD 여부를 한 번에 결정한다. 기존 `classify()` 는 그대로 둔다.
- **brownfield medium 에서 인터뷰를 끈다.** 요구는 코드에 있고 역스펙이 그것을 답한다.
- 순서·우선순위·착수 승인을 묻지 않는다는 규칙을 `common/SKILL.md` 에 명문화하고,
  intake 의 세 지점(HARD-GATE·small 제안·가정 표 승인)을 "판정하고 알린 뒤 진행"으로 바꾼다.
  HARD-GATE 의 "승인 전 코드 금지"는 유지하고 **승인의 정의**만 "사용자가 그 작업을 요청한 시점"으로 바꾼다.
- 문서만으로는 샌다. SessionStart 가 **한 줄 정책**을 매 세션 주입해 구조로 만든다.
- 남기는 질문은 둘뿐: 하네스가 알 수 없는 정보(build 의 테스트 환경), 외부로 나가는 행동(finish 의 푸시).

## Impact

- Specs: `spec-tool-selection`(ADDED), `session-start`(ADDED)
- Code: `skills/spec/scripts/plan.mjs`(신규), `hooks/scripts/session-start.mjs`
- Docs: `skills/{common,intake,spec}/SKILL.md`
- 하위 호환: `classify()` 시그니처·출력 불변.
