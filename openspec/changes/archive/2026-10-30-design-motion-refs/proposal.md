# design-motion-refs

## Why

2026-10-30 릴스(@lazy_owen)는 Claude 가 만든 웹이 "보라색 그라데이션·중앙 히어로·카드 세 장"이 되는 이유를
디자인 기준·참고 화면·보는 눈 세 가지의 부재로 설명했다. nereus:design 은 기준(ui-ux-pro-max·impeccable)과
눈(스크린샷 Gemini 비평 게이트)은 이미 있다. 빈 것은 둘이다.

1. **모션.** 비평 축 여덟 개에 모션이 없고, Gemini 는 정지 스크린샷만 본다 — `transition: all`, `scale(0)` 등장,
   `ease-in` 진입, 레이아웃 속성 애니메이션, reduced-motion 누락은 화면으로는 안 보인다. Emil Kowalski 가 "에이전트가
   계속 하는 실수"로 꼽은 것들이다.
2. **참고 화면.** direction 브리프에 레퍼런스를 텍스트로만 적을 수 있다. 비평가가 레퍼런스를 볼 수 없다.

## What Changes

- `skills/design/scripts/motion-check.mjs` (순수 + CLI): diff 추가 줄에서 모션 실수 6 규칙을 결정적으로 잡는다. 권고 — 게이트를 막지 않는다.
- `design-feedback.mjs`: direction 에 `--ref-image` 첨부(웹세션 `--file`), 프롬프트에 레퍼런스 대조 항목. `collectDiff` 를 export.
- design SKILL.md: 모션 검사·레퍼런스 이미지·Figma 경로. frontend 에이전트: 모션을 만지면 motion-check. setup: Emil 스킬 동반 안내.

## Impact

- 새 파일: `plugins/nereus/skills/design/scripts/motion-check.mjs`, `tests/skills/design-motion.test.ts`
- 수정: `design-feedback.mjs`, `tests/skills/design-feedback.test.ts`, design·setup SKILL.md, `agents/frontend.md`, 버전
