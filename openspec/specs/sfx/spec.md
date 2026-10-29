# sfx Specification

## Purpose
영상에 효과음을 무료 우선으로 붙인다. 코드로 합성한 소리를 먼저 쓰고, 없으면 공개 라이선스 소리를 찾고, 그래도 없을 때만 유료 생성으로 넘긴다.
모든 소리는 라이선스를 판정받고 크레딧이 남는다. Claude 는 들을 수 없으므로 최종 판정은 사람이 듣는다.

## Requirements

### Requirement: 라이선스는 허용·표기·차단 셋 중 하나로 판정해야 한다
<!-- id: sfx.license -->
<!-- entities: License -->
<!-- enforced: tests/skills/sfx-license.test.ts -->

The system MUST satisfy the following. `classifyLicense(license)` 는 대소문자를 무시하고
`cc0` · `pdm` · `synth`(코드 합성음) 이면 `allow`, `by` 이면 `credit`, 그 밖(`by-nc` · `by-nd` · `by-sa` · `by-nc-sa` · `by-nc-nd` · `sampling+` · 빈 값 · 미상)이면 `block` 이어야 한다.
결과는 `{ verdict, license }` 이고 `license` 는 소문자로 정규화된 값이다.

#### Scenario: CC0 허용
- **WHEN** `classifyLicense("CC0")`
- **THEN** `{ verdict: "allow", license: "cc0" }`

#### Scenario: CC-BY 는 표기 조건
- **WHEN** `classifyLicense("by")`
- **THEN** `verdict` 가 `"credit"`

#### Scenario: 비상업·미상은 차단
- **WHEN** `classifyLicense("by-nc")` 또는 `classifyLicense("")` 또는 `classifyLicense(undefined)`
- **THEN** `verdict` 가 `"block"`

### Requirement: Openverse 검색은 키 없이 상업 허용 라이선스만 요청해야 한다
<!-- id: sfx.openverse -->
<!-- entities: Openverse -->
<!-- enforced: tests/skills/sfx-openverse.test.ts -->

The system MUST satisfy the following. `buildSearchUrl({ q, pageSize })` 는 `https://api.openverse.org/v1/audio/` 에
`q`, `license=cc0,pdm`, `page_size`(1~20 로 자른다, 기본 10) 를 싣고 `category` 파라미터를 **싣지 않아야** 한다(실측: 붙이면 0 건).
`parseResults(json)` 는 각 결과를 `{ id, title, url, license, attribution, durationSec, source, filetype }` 로 정규화하고
(`durationSec` = ms/1000, 없으면 `null`), `classifyLicense` 가 `block` 인 항목과 `url` 이 없는 항목은 버려야 한다.

#### Scenario: category 를 싣지 않는다
- **WHEN** `buildSearchUrl({ q: "whoosh" })`
- **THEN** URL 에 `q=whoosh`, `license=cc0%2Cpdm` 이 있고 `category` 가 없으며 `page_size=10`

#### Scenario: page_size 상한
- **WHEN** `buildSearchUrl({ q: "pop", pageSize: 50 })`
- **THEN** `page_size=20`

#### Scenario: 정규화와 차단 항목 제거
- **WHEN** 결과 두 개 중 하나가 `license: "by-nc"`, 다른 하나가 `license: "cc0", duration: 3155`
- **THEN** 하나만 남고 그 `durationSec` 이 `3.155`

### Requirement: 합성기 출력은 파싱해 정렬 기준점을 얻어야 한다
<!-- id: sfx.synth -->
<!-- entities: Sfxlite -->
<!-- enforced: tests/skills/sfx-sfxlite.test.ts -->

The system MUST satisfy the following. `parseList(stdout)` 는 `sfxlite list` 의 행을 `{ id, durSec, peakSec, kinds }` 배열로 만들고 머리글 두 줄은 버린다.
`buildRenderArgs({ id, out, dur, apex, pitch, seed })` 는 `["-m","sfxlite","render",id,"-o",out]` 뒤에 주어진 노브만 `--dur`·`--apex`·`--pitch`·`--seed` 로 붙인다.
`parseRenderLine(stdout)` 는 `wrote ...` 줄에서 `{ durSec, peakSec, checks }` 를 꺼내고, 그 줄이 없으면 `null` 이다.
id 는 `^[a-z0-9_]+(/[a-z0-9_]+)+$` 형식이 아니면 `buildRenderArgs` 가 throw 한다(셸·경로 주입 방지).

#### Scenario: list 파싱
- **WHEN** `click/soft                      0.094  0.004  click | dur param, pitch F#7 -33c`
- **THEN** `{ id: "click/soft", durSec: 0.094, peakSec: 0.004, kinds: ["click"] }`

#### Scenario: render 결과 파싱
- **WHEN** `wrote p.wav: ui_pop/soft seed 1: 0.180 s, onset 0.003 s, peak at 0.042 s, end 0.157 s, -1.0 dBFS, -15.4 LUFS momentary max; checks: clean`
- **THEN** `{ durSec: 0.18, peakSec: 0.042, checks: "clean" }`

#### Scenario: 잘못된 id 거부
- **WHEN** `buildRenderArgs({ id: "../x; rm", out: "a.wav" })`
- **THEN** throw

### Requirement: 큐는 검증되고 소리의 정점이 큐 시각에 맞춰져야 한다
<!-- id: sfx.cues -->
<!-- entities: Cue -->
<!-- enforced: tests/skills/sfx-cues.test.ts -->

The system MUST satisfy the following. `parseCues(json)` 는 배열의 각 큐가 `t`(0 이상 숫자, 초)와 `id`(합성기 id) · `file`(로컬 경로) · `url`(`https://` 로 시작) 중 정확히 하나를 가져야 하며,
`file`·`url` 큐가 싣는 `license`·`attribution`·`source`·`apex`(정점 초, 기본 0) 는 그대로 보존한다.
`gainDb` 는 선택(기본 0, -40~+6 로 자름)이다. 어긋난 큐는 인덱스와 사유를 담은 `errors` 로 돌려주고 `cues` 에서 뺀다. 결과 `cues` 는 `t` 오름차순이다.
`delayMs(t, peakSec)` 는 `max(0, round((t - peakSec) * 1000))` 이다 — 소리의 정점이 큐 시각에 온다.

#### Scenario: 정렬과 오류
- **WHEN** `[{t:2,id:"click/soft"},{t:-1,id:"pop/a"},{t:0.5,file:"a.wav"},{t:1},{t:3,url:"http://x"}]`
- **THEN** `cues` 의 `t` 가 `[0.5, 2]`, `errors` 의 index 가 `[1, 3, 4]`

#### Scenario: 정점 정렬
- **WHEN** `delayMs(1.0, 0.042)`
- **THEN** `958`

#### Scenario: 음수 지연은 0
- **WHEN** `delayMs(0.01, 0.13)`
- **THEN** `0`

### Requirement: 믹스는 원본 오디오를 보존하고 영상 스트림을 재인코딩하지 않아야 한다
<!-- id: sfx.mix -->
<!-- entities: Mix -->
<!-- enforced: tests/skills/sfx-mix.test.ts, tests/skills/sfx-cli.test.ts -->

The system MUST satisfy the following. `buildMixArgs({ video, out, tracks, hasAudio })` 는 ffmpeg 인자 배열을 내고,
각 트랙 `{ file, delayMs, gainDb }` 에 `adelay=<ms>:all=1` 과 `volume=<gainDb>dB` 를 건다.
`hasAudio` 가 true 면 원본 `[0:a]` 를 amix 입력에 포함하고, false 면 효과음만 섞는다. amix 는 `normalize=0`, `duration=first`(원본 있음) 또는 `longest`.
영상은 `-c:v copy` 로, 출력은 `-shortest` 없이 영상 길이를 유지한다. `tracks` 가 비면 throw 한다.

#### Scenario: 원본 오디오 포함
- **WHEN** `hasAudio: true`, 트랙 2개
- **THEN** filter_complex 에 `[0:a]` 와 `amix=inputs=3` 와 `normalize=0` 이 있고 인자에 `-c:v` `copy` 가 있다

#### Scenario: 무음 영상
- **WHEN** `hasAudio: false`, 트랙 1개
- **THEN** filter_complex 에 `[0:a]` 가 없고 `amix=inputs=1`

#### Scenario: 실제 믹스 [flow]
- **WHEN** 2초 무음 영상에 sfxlite 로 렌더한 `ui_pop/soft` 를 t=1.0 에 `sfx-cli build` + `mix`
- **THEN** 출력 영상 길이가 원본과 ±0.1 초, 오디오 스트림이 있고, `SOUNDS.md` 에 `ui_pop/soft` 와 `synth` 가 있다

### Requirement: scene 검출은 후보 시각만 낸다
<!-- id: sfx.scenes -->
<!-- entities: Scenes -->
<!-- enforced: tests/skills/sfx-scenes.test.ts -->

The system MUST satisfy the following. `parseSceneTimes(stderr, { minGapSec })` 는 ffmpeg `showinfo` 출력의 `pts_time:<n>` 을 오름차순으로 모으고,
직전 채택 시각과 `minGapSec`(기본 0.25) 미만으로 붙은 것은 버린다. 결과는 소수 셋째 자리로 반올림한 초 배열이다.

#### Scenario: 근접 중복 제거
- **WHEN** pts_time 1.0, 1.1, 2.5
- **THEN** `[1, 2.5]`

### Requirement: 크레딧 파일은 쓴 소리마다 출처와 라이선스를 남겨야 한다
<!-- id: sfx.credits -->
<!-- entities: Credits -->
<!-- enforced: tests/skills/sfx-credits.test.ts -->

The system MUST satisfy the following. `renderSoundsMd(entries)` 는 `# Sounds` 제목과 표(`| t | sound | source | license | credit |`)를 내고,
`synth` 항목이 하나라도 있으면 earshot MIT 고지 한 줄(`Synthesized with earshot-sfx-lite (MIT, © 2026 Leon Lin)`)을 붙인다.
`credit` 판정(CC-BY) 항목에 `attribution` 이 비어 있으면 throw 한다 — 표기 없이 CC-BY 를 쓰지 않는다. 표 칸의 `|` 는 `\|` 로 이스케이프한다.

#### Scenario: CC-BY 표기 누락 거부
- **WHEN** `[{ t: 1, sound: "x", source: "openverse", license: "by", attribution: "" }]`
- **THEN** throw

#### Scenario: 합성음 고지
- **WHEN** `[{ t: 1, sound: "ui_pop/soft", source: "sfxlite", license: "synth" }]`
- **THEN** 출력에 `Synthesized with earshot-sfx-lite` 가 있다

### Requirement: 효과음 요청은 sfx 로 라우팅되어야 한다
<!-- id: sfx.route -->
<!-- entities: Router -->
<!-- enforced: tests/lib/router.test.ts -->

The system MUST satisfy the following. "효과음 넣어/붙여/깔아/찾아/만들어", "사운드 이펙트", "sfx" 를 담은 요청은 `nereus:sfx` 로 라우팅되어야 하고,
"효과음 만들어" 는 더 이상 `nereus:video` 로 가지 않아야 한다. "립싱크" 는 계속 `nereus:video` 다.

#### Scenario: 효과음 넣기
- **WHEN** "이 영상에 효과음 넣어줘"
- **THEN** 라우트에 `nereus:sfx` 가 있다

#### Scenario: 유료 생성과 분리
- **WHEN** "효과음 만들어줘"
- **THEN** `nereus:sfx` 는 있고 `nereus:video` 는 없다
