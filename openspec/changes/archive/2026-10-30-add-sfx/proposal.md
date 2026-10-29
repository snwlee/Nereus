# add-sfx

## Why

Claude 가 만든 영상(montage·HyperFrames 렌더)에는 효과음이 비어 있거나 어긋난다. Nereus 에서 효과음을 다루는 곳은
`nereus:video` 의 `audio` 하나뿐이고, 그건 **유료 키로 클립 하나를 생성**하는 곳이다. 무료로 찾고, 코드로 합성하고,
영상의 시점에 맞춰 붙이고, 라이선스를 기록하는 절차가 없다. 2026-10-30 릴스(@lazy_owen: Openverse·Real SFX·Earshot)와
조사(`docs/research/2026-10-30-sfx-skill-tools.md`)로 무료 경로가 실재함을 확인했다.

실측(2026-10-30):
- earshot-sfx-lite `c91a7c9` — numpy·scipy 만으로 252 효과음, `render ui_pop/soft` 1.0 초. `--dur --apex --pitch` 로 화면에 맞춘다.
- Openverse 오디오 — 키 없음, `license=cc0` 로 whoosh 240 건. **`category=sound_effect` 를 붙이면 0 건** (Freesound 항목의 category 가 null). duration 은 ms.

## What Changes

- 새 스킬 `nereus:sfx` — 큐 목록 → 소스 결정(합성 → Openverse → 유료 폴백) → 렌더/다운로드 → ffmpeg 믹스 → `SOUNDS.md` 크레딧 → 사람이 듣는 게이트.
- `scripts/license.mjs` (순수): 라이선스 → `allow` · `credit` · `block`.
- `scripts/openverse.mjs` (순수 + fetch 어댑터): 검색 URL, 응답 정규화.
- `scripts/sfxlite.mjs` (순수 + 실행 어댑터): `list` 파싱, `render` 인자, 결과 줄 파싱.
- `scripts/cues.mjs` (순수): 큐 검증, apex 정렬 지연.
- `scripts/mix.mjs` (순수): ffmpeg 믹스 인자.
- `scripts/scenes.mjs` (순수): ffmpeg scene 검출 출력 → 후보 시각.
- `scripts/credits.mjs` (순수): `SOUNDS.md` 렌더.
- `scripts/sfx-cli.mjs`: `doctor · scenes · list · search · build · mix`.
- 라우터: `nereus:sfx` 라우트, `nereus:video` 의 "효과음 만들" 을 sfx 로 이관(무료 우선).
- `nereus:montage` 2절에 "렌더 전 효과음 → nereus:sfx" 한 줄.

## Impact

- 새 파일: `plugins/nereus/skills/sfx/{SKILL.md,scripts/*.mjs}`, `tests/skills/sfx-*.test.ts`
- 수정: `plugins/nereus/hooks/scripts/lib/router.mjs`, `tests/lib/router.test.ts`, `plugins/nereus/skills/montage/SKILL.md`, `plugins/nereus/skills/video/SKILL.md`, 버전·스킬 수 표기
- 사용자 데이터: `~/.local/share/nereus/sfx/earshot-sfx-lite` (커밋 고정 clone + `.venv`) — 저장소 밖
- 외부: Openverse 익명 API(20/분·200/일), 선택적으로 Freesound 키(이번 변경 범위 밖), ffmpeg, python3
