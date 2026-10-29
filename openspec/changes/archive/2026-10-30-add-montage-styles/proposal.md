# add-montage-styles

## Why

Claude 로 만든 영상은 서로 비슷해 보인다 — 같은 HyperFrames 기본 문법, 같은 키네틱 타이포. 2026-10-30 릴스(Web Lab AI)는
"스킬 다섯 개, 스타일 다섯 개"로 이걸 푼다고 소개했다. 조사(`docs/research/2026-10-30-video-style-skills.md`) 결과
그중 광고에 쓸 수 있는 라이선스·키 불필요·활발함을 다 갖춘 것은 **Lemo-Opuscar**(MIT, 68 스타일) 하나다.
onetake 는 PolyForm 비상업, Claude Animation Base 는 Clawd(Anthropic 마스코트) 상표 위험, Collage B-roll 은 유료 Gemini 키가 필요하다.
montage 에는 스타일을 고르는 단계가 없어서 매번 기본 문법으로 간다.

## What Changes

- `plugins/nereus/skills/montage/scripts/style-catalog.mjs` (순수): style.json 정규화, 브리프 겹침 점수로 후보 고르기, 차단 스타일.
- `plugins/nereus/skills/montage/scripts/style-companions.mjs` (순수): 동반 도구 정책 allow/conditional/block.
- `plugins/nereus/skills/montage/scripts/styles.mjs` (CLI): doctor·list·pick·show·companion. Lemo 는 라이브러리 clone(플러그인 아님).
- montage SKILL.md "스타일을 고른다" 절, router 에 영상 스타일 트리거.

## Impact

- 새 파일: 위 세 스크립트, `tests/skills/montage-styles-*.test.ts`
- 수정: `plugins/nereus/skills/montage/SKILL.md`, `plugins/nereus/hooks/scripts/lib/router.mjs`, `tests/lib/router.test.ts`, 버전 표기
- 사용자 데이터: `~/.local/share/nereus/montage/lemo-opuscar` (clone) — 저장소 밖
