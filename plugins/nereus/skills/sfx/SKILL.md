---
name: sfx
description: 영상 효과음 — 코드 합성(earshot-sfx-lite, 무료) → 공개 라이선스 검색(Openverse) → 유료 폴백(nereus:video) 순으로 소리를 확보해 큐 시각에 정점을 맞춰 믹스하고 SOUNDS.md 크레딧을 남긴다. 트리거 "효과음 넣어", "효과음 찾아", "사운드 이펙트", "sfx".
---

# sfx

nereus:common 규칙을 따른다. 이 스킬은 **효과음 단계**다 — 소리를 만들거나 찾고, 영상의 정확한 시점에 붙이고, 라이선스를 남긴다.

## 0. 언제 여기로 오나

| 하고 싶은 것 | 어디서 |
|---|---|
| 렌더된 영상에 효과음(whoosh·pop·click·ding·riser·logo sting) 붙이기 | **이 스킬** |
| 효과음 파일 하나 만들기 | **이 스킬** (`build` 에 큐 하나) |
| 여러 씬짜리 영상 제작 | `nereus:montage` — 렌더 전 효과음 단계에서 여기로 온다 |
| 합성·검색으로 안 되는 소리를 AI 로 생성 (유료) | `nereus:video` `--capability audio` |
| BGM 선곡·보이스오버 | hyperframes `media-use` |
| 이미 놓인 오디오의 EQ·덕킹·페이드 | `hyperframes-audio` |

**Claude 는 들을 수 없다.** 시각을 맞추고 레벨·길이를 재는 것까지가 여기 일이고, 소리가 맞는지는 **사람이 듣고** 판정한다.

## 1. 설치 (한 번)

```bash
C="${CLAUDE_PLUGIN_ROOT}/skills/sfx/scripts/sfx-cli.mjs"
node "$C" doctor        # ffmpeg·ffprobe·earshot-sfx-lite 확인. 없으면 설치 명령을 JSON 으로 출력하고 종료코드 2
```

합성기는 `~/.local/share/nereus/sfx/earshot-sfx-lite` (다른 곳이면 `NEREUS_SFXLITE`):
```bash
H=~/.local/share/nereus/sfx/earshot-sfx-lite
git clone https://github.com/Dodai0419/earshot-sfx-lite "$H"
git -C "$H" checkout c91a7c9d2690ae658f790859d4ad4004857903dd    # 커밋 고정 — 2026-10-28 생긴 저장소다
python3 -m venv "$H/.venv" && "$H/.venv/bin/pip" install numpy==2.4.6 scipy==1.17.1
```
**PyPI 의 `earshot` 은 다른 패키지다(음성 감지 라이브러리). `pip install earshot` 하지 않는다.**
원본 earshot(torch + 1.1GB 모델, 듣기·forge)은 쓰지 않는다 — 효과음 뱅크는 lite 가 바이트 단위로 같다.

## 2. 절차

1. **큐를 정한다.** 영상의 무엇에 소리가 필요한지 — 컷, 등장, 클릭, 로고. 후보 시각이 필요하면:
   ```bash
   node "$C" scenes render.mp4 --threshold 0.3     # → { times: [0.8, 2.4, …] }  후보일 뿐이다
   ```
   HyperFrames 프로젝트면 타임라인의 `data-start` 가 더 정확한 큐다.
2. **소리를 고른다** — 아래 3절 순서로.
   ```bash
   node "$C" list --kind whoosh                    # 합성 뱅크 (252종, 44 카테고리)
   node "$C" search "glass chime"                  # Openverse CC0·PDM 만
   ```
3. **큐 파일을 쓴다** (`cues.json`). 소스는 정확히 하나: `id`(합성) · `file`(로컬) · `url`(검색 결과).
   ```json
   [
     { "t": 0.8, "id": "whoosh_fast/crisp", "dur": 0.6, "apex": 0.25 },
     { "t": 2.4, "id": "ui_pop/soft", "gainDb": -4 },
     { "t": 5.0, "url": "https://cdn.freesound.org/previews/….mp3", "license": "cc0",
       "attribution": "\"…\" by … is marked with CC0 1.0.", "source": "freesound", "apex": 0.05 }
   ]
   ```
   `apex` 는 소리의 정점(초). 합성음은 렌더 결과에서 실측한 정점을 쓰고, `url`·`file` 은 적어 준 값(기본 0)을 쓴다.
   정점이 `t` 에 오도록 앞당겨 놓는다 — 소리의 시작이 아니라 **때리는 순간**이 컷에 맞는다.
4. **만든다.**
   ```bash
   node "$C" build cues.json --dir sfx/            # → sfx/*.wav, sfx/sfx-plan.json, sfx/SOUNDS.md
   ```
   차단 라이선스가 하나라도 있으면 아무것도 렌더·다운로드하기 전에 종료코드 1 로 멈춘다.
5. **섞는다.**
   ```bash
   node "$C" mix render.mp4 --plan sfx/sfx-plan.json --out render.sfx.mp4
   ```
   원본 오디오는 지키고(`normalize=0`), 영상은 재인코딩하지 않는다(`-c:v copy`). 길이가 0.1초 넘게 바뀌면 종료코드 1.
6. **사람이 듣는다.** 결과 파일과 `SOUNDS.md` 를 넘기고 "t=0.8 whoosh, t=2.4 pop…" 목록으로 무엇을 들어야 하는지 적는다.
   "완성"은 사람이 들은 뒤다.

## 3. 소스 순서 — 무료가 먼저

1. **합성 (earshot-sfx-lite)** — 라이선스 판단이 필요 없고, `--dur --apex --pitch` 로 화면에 맞춰 렌더한다.
   UI·모션그래픽 효과음은 대부분 여기서 끝난다.
2. **Openverse** — 키 없음. 실제 녹음이 필요할 때(유리, 문, 군중, 자연음).
3. **유료 폴백** — 위 둘로 안 되면 `nereus:video` 로 넘긴다. 새 경로를 만들지 않는다:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/image/scripts/muapi-cli.mjs" generate --capability audio --prompt "…" --out sfx/ --name riser
   ```
   budget 게이트(`.nereus/budget.json`, 잔액 20분 신선도)를 그대로 탄다. 받은 파일은 `file` 큐로 넣고
   `license` 는 공급자 약관을 확인해 적는다 — 모르면 `block` 이다.

## 4. 라이선스 규칙 (`license.mjs`)

| 판정 | 라이선스 | 처리 |
|---|---|---|
| allow | `cc0` · `pdm` · `synth`(합성음) | 그대로 쓴다. 합성음은 SOUNDS.md 에 MIT 고지 한 줄이 자동으로 붙는다 |
| credit | `by` (CC-BY) | `attribution` 이 비면 `build` 가 거부한다. 영상 설명란에도 옮긴다 |
| block | `by-nc` · `by-nd` · `by-sa` · `sampling+` · 빈 값 · 미상 | 쓰지 않는다 |

광고·상업 영상도 같은 규칙이다. Openverse 검색은 애초에 `cc0,pdm` 만 요청한다.
**`url` 큐의 `license`·`attribution`·`source` 는 `search` 출력에서 그대로 옮긴다.** `build` 는 큐에 적힌 값을 믿는다 — 손으로 고쳐 쓰면 게이트가 무의미해진다.
받는 경로는 https 공개 호스트만 허용하고(리다이렉트도 단계마다 검사), ffmpeg 입력은 `file` 프로토콜만 연다.
Freesound API 직접 호출은 넣지 않았다 — 상업 이용 약관이 "사안별"이라 자동 파이프라인에 붙이지 않는다.

## 5. 실측 메모 (2026-10-30)

- Openverse: **`category=sound_effect` 를 붙이면 0 건**(Freesound 항목의 category 가 null). `license=cc0` 만으로 whoosh 240 건.
  익명 20회/분·200회/일, `page_size` 20 초과는 401. `duration` 은 ms. 받는 파일은 원본이 아니라 **프리뷰 MP3** 다.
- sfxlite: `render ui_pop/soft` 1.0 초, 24-bit/48 kHz WAV. 결과 줄에 정점·LUFS·`checks: clean` 이 찍힌다.
- Real SFX(Clipwing) 는 README 에 MIT 라 적혀 있지만 LICENSE 파일이 없다 — 코드는 가져오지 않았고 큐 목록·청취 목록 설계만 참고했다.
- 근거: `docs/research/2026-10-30-sfx-skill-tools.md`
