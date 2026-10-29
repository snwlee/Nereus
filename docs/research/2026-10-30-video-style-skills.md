# 영상 스타일 스킬 4종 조사 — nereus:montage "스타일 고르기" 동반 스킬 선정

- 작성: 2026-10-30 (researcher)
- 질문: 인스타 릴스(Web Lab AI, 2026-10-11 기준 수치)가 소개한 Claude Code 영상 스타일 스킬 5종 가운데 HyperFrames 를 뺀 4종(onetake, Collage B-roll, Claude Animation Base, Lemo-Opuscar)의 실체를 확인한다. 그 결과로 nereus:montage 에 "스타일 고르기" 단계를 넣을 때 어떤 동반 스킬을 권장할지, 어떤 것은 조건부로 쓸지, 어떤 것은 금지할지 정한다.
- 수치(스타·마지막 push)는 2026-10-30 `gh api repos/<repo>` 결과다. 마지막 커밋은 같은 날 `git clone --depth 1` 해서 `git log -1` 로 확인했다. 라이선스는 클론한 저장소의 LICENSE 파일을 직접 읽어 확인했다.
- 릴스 원문은 **미검사**다. `agent-reach doctor`(2026-10-30) 결과 Instagram 채널이 설치되어 있지 않다. 그래서 릴스 속 수치는 요청문에 적힌 값을 그대로 옮겼다.

## 1. 요약

- **4종 모두 실제로 있다. 다만 릴스 정보 가운데 둘은 틀렸다.** Collage B-roll 의 소유자는 `yyang5168` 이 아니라 **`pyang5166`** 이다. Claude Animation Base 는 **`JohnHeibel/ClaudeAnimationBase`** 다. 스타 수는 릴스 이후 크게 늘었다. 예를 들어 Lemo-Opuscar 는 1.9k → 9,404, 스타일 수는 43 → 66 이다.
- **광고(상업 영상)에 바로 쓸 수 있는 것은 Lemo-Opuscar 하나다.** onetake 는 무료판이 PolyForm Noncommercial 이다. 광고에 쓰려면 Pro 라이선스(79달러, 회사는 별도 구매)가 필요하다. Claude Animation Base 는 코드가 MIT 이지만 주인공 Clawd 가 Anthropic 의 브랜드 요소다. Collage B-roll 은 MIT 지만 유료 Gemini API 가 있어야 하고(무료 티어 없음, 약 0.10달러/초), 정지 이미지 생성은 Codex 의 `image_gen` 에 기대고 있다.
- **추천: Lemo-Opuscar 를 "스타일 카탈로그"로 붙인다. 단, 플러그인으로 설치하지 않고 라이브러리만 클론한다.** 66개 `STYLE.md`(스타일 프롬프트 + 데모 영상)가 그대로 "스타일 고르기" 메뉴가 된다. 플러그인으로 설치하면 이 스킬의 설명문("video, film, short, promo… 스타일을 아직 안 골랐을 때")이 hyperframes 의 "Mandatory entry point" 와 nereus:montage 의 트리거를 가로챈다.

## 2. 하위 질문과 답

### Q1. 정확한 저장소, 라이선스, 활동

| 항목 | onetake | Collage B-roll | Claude Animation Base | Lemo-Opuscar |
|---|---|---|---|---|
| 정확한 URL | https://github.com/feitangyuan/onetake | https://github.com/pyang5166/gbro-collage-broll (릴스 표기 `yyang5168` 은 404) | https://github.com/JohnHeibel/ClaudeAnimationBase | https://github.com/lemomo-ai/lemo-opuscar (갤러리 https://lemomo-ai.github.io/lemo-opuscar/) |
| 스타 (2026-10-30) | 3,485 | 1,571 | 2,290 | 9,404 |
| 마지막 커밋 | 2026-10-21 `013a61a` | 2026-07-15 `a1a4ee2` (3.5개월 정체) | 2026-09-24 `0ac8bf2` | 2026-10-29 `f171360` |
| LICENSE 파일 | 있음. 첫 줄은 "Required Notice: … free for noncommercial use only." + PolyForm Noncommercial 1.0.0. GitHub API 표기는 `NOASSERTION` | 있음. MIT | 있음. MIT (package.json 도 MIT) | 있음. MIT. 데모 영상과 스틸은 README 기준 CC BY 4.0 |
| 형태 | 단일 스킬(`SKILL.md`), git clone 설치 | 단일 스킬(`SKILL.md` + `agents/openai.yaml`), git clone 설치 | **스킬이 아님**. 스타터 킷 저장소(`ANIMATION_GUIDE.md` 를 읽히는 방식) | Claude Code **플러그인 마켓플레이스**(`.claude-plugin/marketplace.json`, 플러그인 `lemo-opuscar`) |

출처: 각 저장소 `gh api` 및 클론(2026-10-30), `pyang5166` 은 `gh search repos "collage broll"`(2026-10-30) 로 확인.

### Q2. 설치·출력·렌더러·의존성·유료 키

| 항목 | onetake | Collage B-roll | Claude Animation Base | Lemo-Opuscar |
|---|---|---|---|---|
| 설치 | `git clone … ~/.claude/skills/onetake` | `git clone … ~/.agents/skills/gbro-collage-broll` | `git clone` 후 `npm install`, 저장소 안에서 Claude Code 실행 | `claude plugin marketplace add lemomo-ai/lemo-opuscar` → `claude plugin install lemo-opuscar@lemolab` |
| 출력 | HTML 한 파일(`window.__seek(t)`) → 프레임 단위 렌더 → mp4. 초안 1080p30, 최종 4K60 | 9:16, 5초, 720×1280, 24fps, 무음 mp4 | `out/video.mp4` (p5.js 캔버스 → 프레임 → ffmpeg) | 페이지의 `render(t)` → 헤드리스 Chrome 프레임 렌더 → `video.mp4` → 믹스 후 −14 LUFS 마스터 |
| 렌더러 | **자체 렌더러**(Python Playwright + 셔터 모션블러). SKILL.md 가 "without HyperFrames or Remotion" 이라고 명시 | **생성형 비디오 모델**(Gemini Omni Flash 첫/끝 프레임 보간). 코드 렌더 없음 | **자체 렌더러**(`render.mjs`, puppeteer-core + Chrome) | **자체 렌더러**(`core/render/video.mjs`, playwright-core, three.js) |
| 런타임 의존성 | python3, playwright(chromium), numpy, scipy, Pillow, matplotlib, (opencv), ffmpeg, node. 나레이션에는 faster-whisper, Kokoro | Python ≥3.10, google-genai ≥2.10.0, ffmpeg/ffprobe, **Codex 내장 `image_gen`**(Gate 2) | Node, Google Chrome, ffmpeg. GPU 없으면 수채 필 렌더가 "프레임당 수 초" | Node 20+, ffmpeg 7+, Python 3.11+. 코어 ~350MB, 음성 ~0.55GB, 샘플 전체 ~1.4GB |
| 유료 키 | 없음 | **`GEMINI_API_KEY` 필수**. 유료 티어만 가능. 720p 기준 약 0.10달러/초라서 5초 클립 1개에 약 0.50달러(재시도 별도) | 없음 | 없음. 중국어 TTS(edge-tts)만 온라인 |
| Windows | README 에 언급 없음(미확인) | `check_setup.sh` 가 bash 라서 WSL 이 필요할 것으로 추정 | README 는 macOS/Linux 플래그만 설명(미확인) | `setup.sh` 가 sh 라서 WSL 이 필요할 것으로 추정. Ubuntu 24.04 의 ffmpeg 6.1 은 너무 낮다고 명시 |

출처: onetake README·SKILL.md, gbro README·SKILL.md(`compatibility` 필드), ClaudeAnimationBase README·package.json, lemo-opuscar README·TECHNIQUE.md·requirements 계열 txt (모두 2026-10-30 클론). Gemini 가격: https://ai.google.dev/gemini-api/docs/pricing (2026-10-30, "approximately 0.10달러 per second", Free tier "not available").

**확인한 사실 하나와 추정 하나.** 공식 가격표의 모델 ID 는 `gemini-omni-1.1-flash` 이다. 반면 Collage B-roll 은 `gemini-omni-flash-preview` 를 기본값으로 하드코딩했다. preview ID 가 폐기되었거나 곧 폐기되면 스크립트가 깨질 수 있다. 이 부분은 **추정**이며 실행해서 확인하지는 않았다.

### Q3. 상업 영상(광고)에 써도 되는가

| 스킬 | 판정 | 근거 |
|---|---|---|
| onetake (무료판) | **불가** | LICENSE 는 PolyForm Noncommercial 1.0.0 이다. README 에 "Commercial use is not permitted." 라고 적혀 있다. 공식 사이트도 무료판 결과물의 상업 사용을 막는다. |
| onetake Pro | 가능(유료) | 79달러 일회성이고 1.x 평생 이용이다. "Films you make with Pro are yours — ads, launches, paid client work, no attribution." 단, 회사에서 쓰려면 회사가 따로 라이선스를 사야 한다. 출처: https://onetakemotion.com (2026-10-30) |
| Collage B-roll | 가능(조건부) | 코드는 MIT 다. 결과물 권리는 Gemini API 약관과 이미지 생성 도구의 약관을 따른다. 이 두 약관은 이번 조사 범위 밖이라 미검사다. |
| Claude Animation Base | 엔진은 가능, **Clawd 는 불가** | 코드는 MIT 다. Clawd 는 아래 Q5 참고. |
| Lemo-Opuscar | **가능** | README Licence 절에 "Films you make with the library: yours, no credit needed." 라고 되어 있다. 다만 데모 영상을 재사용하면 CC BY 4.0 표기가 필요하다. 데모 음성 3개(macOS `say`, Edge TTS, Doubao TTS)는 이 라이선스에서 제외된다. 샘플·폰트는 CC0/CC BY/OFL 만 쓰고 `CREDITS` 에 적어야 한다(TECHNIQUE.md §11). 따라서 CC BY 샘플을 쓰면 광고에도 표기 의무가 생긴다. |

### Q4. nereus 스킬·hyperframes 와 이름·트리거가 충돌하는가

현재 설치 상태(2026-10-30 확인): nereus 에 `montage`(트리거 "광고 영상", "영상 제작"…)와 `video`("영상 만들어", "t2v"…), `design`, `image` 가 있다. 전역에는 `hyperframes` 가 있고, 그 설명문이 "Mandatory entry point … any request to make … a video, animation, or motion graphic, including a promo, explainer…" 이다. 그 밖에 `product-launch-video`, `ad-video`, `general-video`, `motion-graphics` 등도 전역에 있다(`~/.claude/skills`, `~/.agents/skills`).

| 스킬 | 이름 충돌 | 트리거 충돌 | 위험 |
|---|---|---|---|
| onetake | 없음 | "launch video / promo / teaser / 产品宣传片 / 功能演示" 가 hyperframes·product-launch-video·montage("광고 영상")와 정면으로 겹친다. SKILL.md 가 "사용자가 HyperFrames 나 Remotion 을 지명하지 않으면 이 파이프라인을 쓴다"고 명시한다. 즉 기본 라우팅을 빼앗는다. | **높음** |
| Collage B-roll | 없음 | 트리거가 "collage b-roll / 纸拼贴 / 半调拼贴" 로 좁아서 충돌이 낮다. 다만 작업 폴더와 venv 를 `~/hyperframes-projects/` 아래(`.omni-venv`)에 만들어 hyperframes 의 경로를 같이 쓴다. | 낮음~중간 |
| Claude Animation Base | 없음 | 스킬이 아니므로 트리거가 없다. 저장소 안에서 `ANIMATION_GUIDE.md` 를 읽힐 때만 동작한다. | 없음 |
| Lemo-Opuscar | 없음(`/lemo-opuscar:lemo-opuscar` 로 네임스페이스 분리) | 설명문이 "video, film, short, promo, explainer or animation … when they … haven't chosen a style (help them choose)" 로 넓다. hyperframes 진입점, montage, motion-graphics 와 겹친다. | **중간~높음**(플러그인으로 설치할 때). 클론만 하면 없음 |

### Q5. Clawd 마스코트의 상표 위험

**한 줄 판정: 광고에 Clawd 를 쓰는 것은 금지 수준(높음)이다.** Anthropic 상표 가이드라인은 보호 대상을 "names, logos, brand elements, and anything we use to identify our goods and services" 로 정의한다. 또 사전 승인한 자료에서만 쓸 수 있다고 하고, 후원이나 제휴를 암시하는 사용을 금지한다(https://www.anthropic.com/legal/trademark-guidelines, 2026-10-30). Clawd 이름이 이 문서에 명시되어 있지는 않다. 그러나 Claude Code 의 공식 마스코트로 널리 인식되고 있다(https://www.starkinsider.com/2025/10/clawd-ai-retro-mascot-command-line.html). 따라서 브랜드 요소에 해당할 개연성이 크다. 이 부분은 법률 판단이 아니라 **추정**이다.

Clawd 가 나오는 곳은 다음과 같다. Claude Animation Base 는 Clawd 가 주인공이다. onetake 의 `cases/clawd-desktop-19s` 사례 영상에도 나오고, Lemo-Opuscar 의 `styles/living-screencast` 스타일과 OPUSCAR 98 영상에도 나온다.

## 3. 비교표 (우리 스택 적합성 포함)

"우리 스택"은 Nereus 하네스를 뜻한다. Claude Code 플러그인이고 Node `.mjs` 스크립트로 되어 있으며 macOS 가 주 환경이다. nereus:montage 는 OpenMontage(HyperFrames/Remotion 렌더)를 쓰고, nereus:video 는 Muapi 를 쓴다.

| | onetake | Collage B-roll | Claude Animation Base | Lemo-Opuscar |
|---|---|---|---|---|
| 마지막 커밋 | 2026-10-21 | 2026-07-15 | 2026-09-24 | 2026-10-29 |
| 라이선스 | PolyForm NC 1.0.0 (+Pro 상업) | MIT | MIT (Clawd 는 별개) | MIT + 데모 CC BY 4.0 |
| 스타 | 3,485 | 1,571 | 2,290 | 9,404 |
| 렌더 | 자체 HTML→mp4 | Gemini 생성 비디오 | 자체 p5.js→mp4 | 자체 HTML/WebGL→mp4 |
| 유료 키 | 없음(상업은 Pro 79달러) | Gemini 유료(~0.10달러/초) | 없음 | 없음 |
| 광고 사용 | 무료판 불가 | 가능(API 약관은 미검사) | Clawd 빼면 가능 | 가능 |
| 트리거 충돌 | 높음 | 낮음 | 없음 | 중간~높음(플러그인일 때) |
| 스택 적합성 | 낮음. HyperFrames 를 의도적으로 우회하고, 라이선스 때문에 광고 경로에 못 쓴다 | 중간. video-gate·budget 아래 B-roll 에셋 생성기로는 맞는다. 단 Codex `image_gen` 을 `nereus:image` 로 바꿔야 한다 | 중간. 손그림 캐릭터 엔진으로는 독보적이다. 다만 Clawd 를 빼면 캐릭터를 새로 설계해야 한다 | 높음. 스타일 프롬프트가 렌더러와 분리된 문서(`STYLE.md`)라서 HyperFrames 쪽으로 옮겨 쓸 수 있다 |
| Windows | 미확인 | WSL 필요 추정 | 미확인 | WSL 필요 추정 |

## 4. 추천: montage "스타일 고르기" 동반 스킬 정책

| 대상 | 판정 | 조건과 이유 |
|---|---|---|
| **Lemo-Opuscar** | **권장** | **설치 방식이 조건이다.** `git clone https://github.com/lemomo-ai/lemo-opuscar ~/lemo-opuscar` 로 라이브러리만 받는다. 플러그인 설치는 하지 않는다(트리거 충돌 방지). montage 의 스타일 단계에서 `styles/*/STYLE.md` 와 갤러리를 후보로 보여 준다. 고른 스타일 프롬프트는 OpenMontage/HyperFrames 장면 지시로 옮긴다. Lemo 렌더러는 단독 단편을 만들 때만 쓴다. `living-screencast` 처럼 Clawd 가 나오는 스타일과 제외된 데모 음성 3개는 쓰지 않는다. CC BY 샘플을 쓰면 크레딧을 납품물에 넣는다. |
| **Collage B-roll** | **조건부** | 다음 조건을 모두 만족할 때만 쓴다. ① 사용자가 Gemini 유료 키를 직접 넣는다. ② montage 의 video-gate·budget 승인을 거친다. ③ Gate 2 의 정지 이미지는 Codex `image_gen` 대신 `nereus:image` 로 만든다. ④ 모델 ID(`gemini-omni-flash-preview` → `gemini-omni-1.1-flash`)를 실행해서 확인한다. 저장소가 3.5개월째 정체 상태라는 점도 감안한다. 키 없이 쓰고 싶다면 같은 작가의 HyperFrames 기반 `pyang5166/gbro-collage-info`(MIT, 55★, 이미지 모델 불필요)가 대안 후보다. 이 저장소는 미검증이다. |
| **Claude Animation Base** | **조건부(비상업·자체 캐릭터)** / 광고에는 **금지** | p5.brush 손그림 엔진과 `ANIMATION_GUIDE.md` 의 연출 규칙은 참고 가치가 높다. 다만 Clawd 를 그대로 쓰면 상표 위험이 있으므로 광고에는 금지한다. 자체 캐릭터로 바꾸는 경우나 개인·비상업 영상에서만 쓴다. 이 저장소는 스킬이 아니므로 montage 가 "참고 레퍼런스"로 링크만 건다. |
| **onetake** | 기본 **금지**, 비상업만 조건부 | 무료판은 광고에 쓸 수 없다. 전역 스킬로 설치하면 "promo/launch" 요청을 HyperFrames 에서 빼앗아 간다. 비상업 영상(예: 생일 영상)에서만 쓰고, 사용자가 이름을 지명했을 때만 쓴다. 광고에 쓰려면 회사 명의의 Pro 라이선스를 산 뒤 다시 판단한다. "carry(이어 붙이기) 오라클" 아이디어는 코드를 가져오지 말고 개념만 참고한다(PolyForm 파생물도 비상업 조건을 따른다). |

**추천 하나: Lemo-Opuscar 를 라이브러리 클론 방식의 스타일 카탈로그로 채택한다.**

- 이유
  - 광고에 쓸 수 있는 라이선스를 가진 것이 이것 하나다(MIT, 결과물은 사용자 소유).
  - 유료 키가 필요 없다.
  - 활동이 가장 활발하다(2026-10-29 커밋, 9.4k★).
  - 스타일이 렌더러와 분리된 문서로 되어 있어 OpenMontage/HyperFrames 파이프라인을 바꾸지 않고 "고르기" 단계만 붙일 수 있다.
- 리스크
  1. 저작자가 "Built for Claude… tuned for Opus 5.5; other models may not reproduce them well" 이라고 밝혔다. 다른 모델에서는 재현성이 떨어진다.
  2. STYLE.md 의 연출은 Lemo 자체 렌더러(canvas/WebGL `render(t)`)를 전제로 쓰였다. HyperFrames(GSAP 중심)로 옮기면 일부 스타일(3D, 셰이더 후처리)은 품질이 떨어질 수 있다(추정).
  3. 의존성 크기가 크다(코어 ~350MB, 샘플 ~1.4GB). ffmpeg 7+ 가 필요하다.
  4. 업스트림이 빠르게 바뀐다. 1주에 7개 스타일이 추가되었으므로 경로·파일명을 하드코딩하지 말고 `styles/README.md` 를 읽게 해야 한다.
  5. 한국어 TTS 경로가 문서에 없다(TECHNIQUE.md 는 영어 Kokoro, 중국어 edge-tts 만 다룬다). 한국어 나레이션은 OpenMontage 의 piper TTS 쪽을 유지한다.

## 5. 출처 목록 (모두 2026-10-30 확인)

- https://github.com/feitangyuan/onetake — LICENSE, README.md, SKILL.md, 커밋 013a61a (2026-10-21)
- https://onetakemotion.com — onetake Pro 가격·상업 범위
- https://github.com/pyang5166/gbro-collage-broll — LICENSE, README.md, SKILL.md, 커밋 a1a4ee2 (2026-07-15)
- https://github.com/pyang5166/gbro-collage-info — HyperFrames 기반 대안(메타데이터만 확인)
- https://ai.google.dev/gemini-api/docs/pricing — Gemini Omni Flash 가격, 무료 티어 없음
- https://www.therundown.ai/tools/gemini-omni-flash — preview 가격 보조 출처
- https://github.com/JohnHeibel/ClaudeAnimationBase — LICENSE, README.md, package.json, ANIMATION_GUIDE.md, 커밋 0ac8bf2 (2026-09-24)
- https://github.com/lemomo-ai/lemo-opuscar — LICENSE, README.md(Licence 절), TECHNIQUE.md, marketplace.json, plugin.json, 커밋 f171360 (2026-10-29)
- https://lemomo-ai.github.io/lemo-opuscar/ — 갤러리
- https://www.anthropic.com/legal/trademark-guidelines — Anthropic 상표 가이드라인
- https://www.starkinsider.com/2025/10/clawd-ai-retro-mascot-command-line.html — Clawd 가 Claude Code 마스코트라는 보조 출처
- 로컬: `plugins/nereus/skills/{montage,video,design,image}/SKILL.md`, `~/.claude/skills/hyperframes*/SKILL.md`, `~/.agents/skills/*` (설치 상태·트리거)
- 미검사: 인스타 릴스 원문(Agent Reach Instagram 채널 미설치), last30days 커뮤니티 반응(스킬 미설치)
