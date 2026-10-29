# nereus:sfx 도입 조사 — Openverse · Real SFX · earshot

- 작성: 2026-10-30 (researcher)
- 질문: 인스타 릴스(@lazy_owen)가 소개한 "Openverse API · Real SFX · Earshot" 3종의 실체를 확인하고, Nereus에 `nereus:sfx` 스킬을 추가할 때 쓸 무료 우선 스택과 라이선스 규칙을 정한다.
- 수치(스타·커밋)는 2026-10-30 `gh api`로 가져온 값이다.

## 1. 요약

- **세 도구 모두 실제로 있고 공개되어 있다.** 이 3종 묶음은 2026-10-27자 블로그 글 하나가 그대로 소개한 구성이다. 릴스도 이 글을 바탕으로 한 것으로 보인다(추측). 출처: https://vivian.hobbyland-group.com/en/article/free-sound-effects-claude-video-openverse-real-sfx-earshot (2026-10-27)
- **Openverse는 MCP 서버가 아니다.** 키 없이 쓰는 REST API다. 익명 한도는 분당 20회, 하루 200회이며 2026-10-30 응답 헤더에서 직접 확인했다. Openverse 전용 MCP 서버는 찾지 못했고, 스킬 안에서 API를 직접 호출하는 구현만 있었다(HyperFrames `media-use` 등).
- **Real SFX는 Clipwing/skills 안의 Claude Code 스킬이다.** MCP가 아니다. 릴스에 나온 `find_moments`는 이 스킬의 `find_moments.py` 스크립트다. 효과음 라이브러리는 사용자가 직접 마련해야 하고, 기본 동봉은 CC0 UI 효과음 78개뿐이다.
- **earshot은 Leonxlnx/earshot이다.** MIT, 스타 3,232, MCP 서버를 포함한다. `earshot forge ... --target "..."` 같은 CLI도 실제로 있다. 다만 torch와 약 1.1GB 모델이 필요하다. 효과음 합성만 떼어 낸 `earshot-sfx-lite`(numpy·scipy만 사용)가 있지만 생긴 지 이틀이고 스타가 0이다.
- **추천.** `nereus:sfx`는 만든다. 다만 **얇은 오케스트레이터**로 만든다. 순서는 배치(타임라인/큐) → 합성(earshot 뱅크, 라이선스 위험 최소) → 검색(Openverse CC0 → Freesound CC0) → 유료 폴백(기존 `nereus:video`의 Muapi 오디오 또는 ElevenLabs)이다. earshot 풀 설치(torch)는 기본값으로 두지 않고 "귀(QA)" 옵션으로만 둔다.

## 2. 하위 질문과 답

### 2.1 Real SFX의 실체

| 항목 | 내용 | 출처 |
|---|---|---|
| 저장소 | https://github.com/Clipwing/skills/tree/main/skills/real-sfx | gh api (2026-10-30) |
| 형태 | Claude Code **스킬**(폴더 복사 설치). MCP 아님 | README https://github.com/Clipwing/skills/blob/main/skills/real-sfx/README.md |
| 라이선스 | 저장소 루트에 LICENSE 파일 없음(`gh api .../contents/LICENSE` → 404). README 본문은 "Scripts: MIT, uisfx 사운드 CC0"라고 적음 | 같은 README, gh api (2026-10-30) |
| 스타·최근 커밋 | 20 · 2026-10-21 "feat: add real-sfx skill" | gh api (2026-10-30) |
| 의존성 | Python 3.9+, FFmpeg(macOS는 `drawtext`·`rubberband` 필터 때문에 `ffmpeg-full`), UI 팩만 Node. 유료 키 없음 | README |
| 동작 | `look.py` → `from_cues.py` / `from_hyperframes.py` / `ui_events.py` / `find_moments.py`(프레임 분석) → `suggest_cues.py` → `mix.py` → `verify/review/critique.py`. 결과는 새 MP4와 SFX 트랙 WAV | README |
| 한계 | "합성하지 않는다". 라이브러리가 없으면 UI 효과음 78개만 쓸 수 있음. 직접 가진 녹음 라이브러리가 필요 | README, https://clipwing.pro/skills/real-sfx |

판단: **배치 로직(HyperFrames `data-start` 타임라인과 cues.json 읽기, 프레임 정렬, 원래 효과음 레벨 맞추기, 모노 체크)이 핵심 가치다.** 라이선스가 README에만 있어서 코드를 그대로 가져오는 것은 위험하다. 구조와 아이디어만 참고하는 쪽을 권한다.

### 2.2 earshot의 실체

| 항목 | 내용 | 출처 |
|---|---|---|
| 저장소 | https://github.com/Leonxlnx/earshot | gh api (2026-10-30) |
| 라이선스 | 코드 MIT. 모델은 CLAP(Apache-2.0)과 AST(BSD-3-Clause)를 별도로 다운로드 | README "Licence" |
| 스타·포크·최근 커밋 | 3,232 · 202 · 2026-10-22 "release: 0.4.0"(생성 2026-10-15) | gh api (2026-10-30) |
| MCP | 있음. `claude mcp add earshot -- .venv/bin/python -m earshot mcp`. 도구에는 `sfx_list`, `sfx_render`, `kit_render`, listen 계열이 있음 | README "MCP server for Claude Code" |
| 기능 | describe/match/find/timeline/critique(듣기), `forge`(코드로 소리 합성 + 비평가 루프), `fit`(녹음 → 레시피 코드), `sfx render ID`(효과음 뱅크 252개를 `--dur/--apex/--pitch`로 맞춤 렌더) | README |
| 의존성 | Python 3.10+, ffmpeg, torch(CPU), 첫 실행 시 모델 약 1.1GB 다운로드. CPU 전용. `llm_critique`만 `GEMINI_API_KEY`가 필요하고 선택 사항 | README "Install" |
| 주의 | PyPI의 `earshot`은 **다른 패키지**다(pykeio/earshot, VAD, v1.2.2). `pip install earshot`으로 설치하면 안 되고 git clone으로 설치해야 함 | https://pypi.org/pypi/earshot/json (2026-10-30) |
| 정직한 한계 | 작성자 본인이 forge가 자기 모델을 과최적화할 수 있다고 밝힘(Goodhart). 블라인드 테스트는 1명, 15회뿐 | README "Honest limits" |

파생 프로젝트: https://github.com/Dodai0419/earshot-sfx-lite. MIT, 스타 0, 생성 2026-10-28. earshot 0.4.0 효과음 뱅크 252개를 numpy·scipy만으로 "byte-identical"하게 렌더한다고 주장하며 SHA-256 테스트를 포함한다. Claude Code 플러그인 마켓플레이스로도 설치된다.

판단: **효과음 뱅크(`sfx render`)는 모델 없이 결정적으로 렌더되므로 Nereus에 넣기 좋다.** 듣기와 forge 기능은 무겁다(torch + 1.1GB). 기본값에서는 빼야 한다.

### 2.3 Openverse 오디오 API

| 항목 | 내용 | 출처 |
|---|---|---|
| 엔드포인트 | `GET https://api.openverse.org/v1/audio/?q=...` | 실호출 (2026-10-30) |
| 인증 | 익명으로 쓸 수 있음. 등록은 `POST /v1/auth_tokens/register/` → `/v1/auth_tokens/token/`(client_credentials) → Bearer. 등록하면 "slightly higher limits" | `/v1/schema/` auth 태그 (2026-10-30) |
| 레이트리밋 | 익명은 `x-ratelimit-limit-anon_burst: 20/min`, `anon_sustained: 200/day`. 초과하면 429 | 응답 헤더 실측 (2026-10-30) |
| 페이지 제한 | 익명 `page_size=50`은 401. 익명은 질의당 최대 240건(20×12페이지)만 보임. ToS가 스크래핑을 금지 | 실측, `/v1/schema/` |
| 라이선스 필터 | `license=cc0,by,by-nc,by-nc-nd,by-nc-sa,by-nd,by-sa,nc-sampling+,pdm,sampling+`, `license_type=all,all-cc,commercial,modification` | `/v1/schema/` |
| 기타 필터 | `category=sound_effect`, `length=shortest,short,...`, `extension`, `source` | `/v1/schema/` |
| 커버리지 | wikimedia_audio 3,986,828, jamendo 644,709, freesound 591,898 | `/v1/audio/stats/` (2026-10-30) |
| 품질 관찰 | 반환되는 `url`이 Freesound **프리뷰 HQ MP3**(`cdn.freesound.org/previews/..-hq.mp3`)이고 원본 WAV가 아님. 표본 결과의 `indexed_on`은 2024-05-21이어서 인덱스가 최신이 아닐 수 있음(표본 관찰). "bell" 20건은 freesound BY 13, jamendo BY-NC-ND 4, BY-NC-SA 2, CC0 1건으로 CC0 비율이 낮았음. 각 결과에 `attribution` 문자열이 들어 있어 크레딧을 자동 생성할 수 있음 | 실측 (2026-10-30) |
| MCP | 전용 MCP 서버는 **찾지 못함**(gh search repos·npm). 스킬에서 직접 호출하는 구현: heygen-com/hyperframes `packages/cli/src/media-use/lib/openverse.mjs`(cc0·by만 허용, 15초 이하, 실패하면 동봉 라이브러리로 폴백), scosman/videowright, Varnan-Tech/opendirectory `openverse-sfx` | gh search code (2026-10-30) |

참고: 효과음 소스로서 Openverse는 사실상 **Freesound의 CC 미러**다. 효과음 품질은 Freesound가 좌우한다. Jamendo는 대부분 음악이고 NC/ND가 많아 광고에 쓸 수 없다.

### 2.4 Freesound API

| 항목 | 내용 | 출처 |
|---|---|---|
| 인증 | 검색과 프리뷰는 `token` 파라미터(무료 API 키, https://freesound.org/apiv2/apply). **원본 파일 다운로드는 OAuth2 필수** | https://freesound.org/docs/api/overview.html (2026-10-30 조회) |
| 한도 | 일반 60/분·2000/일, 다운로드 등은 30/분·500/일 | 같은 문서 |
| CC0 필터 | `GET /apiv2/search/?query=whoosh&filter=license:"Creative Commons 0"`. 값은 "Attribution", "Attribution NonCommercial", "Creative Commons 0" | https://freesound.org/docs/api/resources_apiv2.html |
| 프리뷰 | `preview-hq-mp3`(~128kbps), `preview-hq-ogg`(~192kbps) | 같은 문서 |
| 장점 | `/sounds/<id>/similar/`, `laion_clap` 512차원 유사도 공간 | 같은 문서 |
| API 약관 | "Terms for commercial use of the API will be negotiated on a case by case basis". 콘텐츠 라이선스를 지켜야 하고 DB 전체 복제는 금지 | https://freesound.org/help/tos_api/ |
| 기존 MCP | johnkimdw/freesound-mcp-server(MIT, ★10, 마지막 커밋 2025-06-24), sandraschi/sfx-mcp(MIT, ★3, 2026-10-24, wip 커밋) | gh api (2026-10-30) |

Openverse와 비교하면 Freesound는 키가 필요하지만 한도가 10배이고, CLAP 유사도 검색과 원본 품질(OAuth2)을 쓸 수 있다. 반면 **API 상업 이용은 협의 대상**이다. 광고 제작 파이프라인이 "API 상업 이용"에 해당하는지는 불명확하다(추측. 확인 필요).

### 2.5 그 밖의 대안

| 도구 | 내용 | 출처 |
|---|---|---|
| sfxmint-mcp | 원격 MCP(`https://sfxmint.com/mcp`), 오디오 전부 CC0(AI/절차 생성), 키 없이 하루 20개 | https://github.com/flreey/sfxmint-mcp (★5, CC0-1.0, 2026-10-29) |
| ZzFX | 초소형 JS 절차 합성(게임 UI용) | https://github.com/KilledByAPixel/ZzFX (★809, MIT, 2026-10-01) |
| jsfxr | sfxr JS 포트 | https://github.com/chr15m/jsfxr (★460, Unlicense, 2026-05-05) |
| bfxr2 | sfxr 계열 데스크톱 앱 | https://github.com/increpare/bfxr2 (★340, MIT, 2026-10-22) |
| ElevenLabs SFX | 지정 길이 1초당 40크레딧. 상업 라이선스는 Starter($6/월)부터 | https://elevenlabs.io/docs/overview/capabilities/sound-effects , https://www.cartesia.ai/learn/elevenlabs-pricing (2026 조회) |
| Nereus 내부 | `nereus:video`가 이미 Muapi 유료 키로 "음악·효과음"(`audio`)을 생성함 | `plugins/nereus/skills/video/SKILL.md` |

"영상 모션 분석 → SFX 자동 배치"를 하는 독립 오픈소스는 gh search에서 Real SFX 말고는 찾지 못했다(검색어 "video sfx placement", "auto foley video", "video-to-audio sfx" 모두 0건, 2026-10-30).

## 3. 비교표

| 도구 | 역할 | 최근 활동 | 라이선스 | 스타 | 키/비용 | 우리 스택 적합성 |
|---|---|---|---|---|---|---|
| Openverse API | 검색 | 2026-10-29 (WordPress/openverse) | 코드 MIT, 콘텐츠는 항목마다 다름 | 444 | 키 없음, 익명 20/분·200/일 | **높음.** HyperFrames media-use가 이미 같은 방식으로 씀. Node fetch로 짧게 구현 가능 |
| Freesound API | 검색(2순위) | 해당 없음(서비스) | 콘텐츠는 항목마다 다름, API 상업 이용은 협의 | 해당 없음 | 무료 키, 원본은 OAuth2 | 중간. 키 관리와 상업 약관 확인이 필요 |
| Real SFX (Clipwing) | 배치 | 2026-10-21 | README상 MIT(LICENSE 파일 없음) | 20 | 없음, 라이브러리는 직접 마련 | 중간. HyperFrames 연동이 맞음. 코드 이식보다 설계 참고 |
| earshot (Leonxlnx) | 합성 + 듣기(QA) | 2026-10-22 (v0.4.0) | MIT (+모델 Apache/BSD) | 3,232 | 없음, torch + 1.1GB | 합성 뱅크는 높음, 듣기는 무거움. 옵션으로 |
| earshot-sfx-lite | 합성(경량) | 2026-10-28 | MIT | 0 | 없음, numpy·scipy | 높음(의존성 2개). 다만 신생이라 커밋 고정 필요 |
| sfxmint-mcp | 검색(CC0 전용) | 2026-10-29 | CC0 | 5 | 키 없음 하루 20개, 생성은 유료 | 보조. 외부 서비스 의존 |
| ElevenLabs / Muapi | 유료 생성 | 해당 없음 | 유료 플랜 상업 허용 | 해당 없음 | 유료 | 폴백. `nereus:video` 재사용 |

## 4. 추천

**추천: `nereus:sfx`를 만든다. 모양은 "배치 + 무료 소스 3단 + 유료 폴백"을 묶는 얇은 스킬이고, 외부 MCP는 하나도 기본 설치하지 않는다.**

구성안:

1. **배치(필수).** 입력 우선순위는 프로젝트 큐 목록(`cues.json`) → HyperFrames `data-start` 타임라인 → 렌더 영상 프레임 분석이다. Real SFX의 파이프라인(from_cues / from_hyperframes / find_moments → mix → verify)을 **설계 참고용**으로만 쓴다. 믹스는 ffmpeg `adelay`+`amix`로 하고, 산출물은 `*_sfx.mp4` + `*_sfx_track.wav` + `SOUNDS.md`(크레딧)이다.
2. **합성(무료 1순위, 라이선스 위험이 가장 작음).** earshot 효과음 뱅크(`sfx render ID --dur --apex --pitch`)를 쓴다. 기본 설치는 earshot-sfx-lite를 **커밋 고정**해서 하고, 실패하면 upstream earshot 0.4.0(`git clone`, PyPI `earshot`은 다른 패키지라 금지)으로 넘어간다. UI·모션그래픽 큐(whoosh, pop, click, ding, riser, logo sting)는 대부분 여기서 끝난다.
3. **검색(무료 2순위, 실녹음이 필요할 때).** Openverse를 `category=sound_effect&license=cc0` 조건으로 익명 조회하고, 429가 나면 해당 실행에서는 더 묻지 않는다. 결과가 부족하면 Freesound(`filter=license:"Creative Commons 0"`, 사용자 키)로 간다. 결과 `attribution`은 `SOUNDS.md`에 그대로 기록한다.
4. **유료 폴백.** `nereus:video`의 Muapi `audio`(이미 있는 비용 승인 게이트를 재사용)를 쓰고, 필요하면 ElevenLabs SFX를 쓴다. 상업 용도는 유료 플랜일 때만 허용한다.
5. **QA(선택).** earshot 풀 설치 + MCP가 있을 때만 `timeline --video`/`critique`로 동기와 레벨을 검증한다. 없으면 ffmpeg `ebur128`로 LUFS를 재고 onset을 측정한다.

라이선스 규칙(스킬에 하드코딩):

| 용도 | 자동 허용 | 조건부 | 금지 |
|---|---|---|---|
| 광고·상업 영상 | `cc0`, `pdm`, earshot 합성음, 유료 플랜 생성음 | `by`. `SOUNDS.md`와 영상 설명란에 attribution 문자열을 넣을 수 있을 때만 | `by-nc*`, `by-nd`, `by-sa`, `sampling+`, `nc-sampling+`, 무료 플랜 ElevenLabs |
| 비상업·내부 시안 | 위 전부 + `by-sa` | `by-nc`(표기 필수) | `by-nd`/`by-nc-nd`(편집하면 2차 저작물이므로) |

- 다운로드할 때마다 `{source, id, license, license_version, attribution, foreign_landing_url, sha256}`를 기록한다.
- Openverse `url`은 프리뷰 MP3라서 최종 마스터 품질이 필요하면 `foreign_landing_url`의 원본을 확인한다.
- `by-sa`를 광고에서 빼는 것은 보수적인 판단이다. 영상 전체가 SA 의무를 지는지 해석이 갈리기 때문이다(추측).

이유:
- 합성을 먼저 두면 라이선스 판단 자체가 필요 없어진다. UI/모션 큐의 대부분을 덮는다(earshot 뱅크 44개 카테고리, 252개).
- Openverse는 키가 없어서 설치 마찰이 0이다. 같은 생태계의 HyperFrames가 이미 이 패턴(cc0·by만 허용, 동봉 라이브러리로 폴백)을 쓰고 있다.
- MCP를 늘리지 않으면 컨텍스트와 설치 부담이 없다. Nereus는 스크립트 기반 스킬 관례를 따른다.

## 5. 리스크

1. **earshot 계열이 아주 새롭다.** earshot은 2026-10-15에 생겼다. sfx-lite는 2026-10-28에 생겼고 스타가 0이다. API가 바뀌거나 저장소가 방치될 수 있다. 대응: 커밋 SHA를 고정하고, 사용하는 ID 목록에 대해 SHA-256 회귀 테스트를 둔다.
2. **earshot 합성음 자체의 라이선스가 모호하다.** 뱅크는 MIT 저작물(Leon Lin 저작권)이다. 렌더한 WAV를 영상에 넣을 때 MIT 고지가 필요한지는 명시되어 있지 않다(추측). 대응: `SOUNDS.md`에 "earshot (MIT)" 크레딧을 기본으로 남긴다. `fit/*` 15개는 CC0 녹음에서 파생된 것이라 문제가 없다.
3. **Openverse 익명 한도와 신선도.** 하루 200회, 질의당 240건이 한계다. 표본 인덱스 날짜가 2024-05라서 최신 Freesound 업로드가 빠질 수 있다.
4. **Freesound API 상업 약관이 "협의"로 되어 있다.** 광고 파이프라인에서 자동 호출해도 되는지는 UPF에 문의해야 확인할 수 있다(미확인).
5. **Real SFX 라이선스 표기가 불완전하다.** LICENSE 파일이 없으므로 코드를 복사하지 말고 설계만 참고한다.
6. **자동 배치 품질.** Real SFX와 earshot 작성자 모두 "Claude는 들을 수 없다"고 인정한다. 최종 결과는 사람이 청취해서 확인하는 게이트가 필요하다(Real SFX의 listen-list 방식).
7. **이름 충돌.** PyPI `earshot`은 다른 패키지(VAD)다. 설치 스크립트에서 반드시 git URL을 쓴다.

## 6. 미검사 채널

- `agent-reach doctor`(2026-10-30) 결과 Instagram·X·Reddit 채널이 미설치였다. 그래서 원본 릴스(@lazy_owen)와 X 원문(Elliot Padfield, https://x.com/ElliotPadfield/status/2110764303087288788)은 **미검사**다. 검색 결과 요약에서만 확인했다.
- last30days 스킬은 이 환경에서 찾지 못했다. 커뮤니티 반응은 **미검사**다.

## 7. 출처

- https://github.com/Leonxlnx/earshot (README, v0.4.0 2026-10-22, gh api 2026-10-30)
- https://github.com/Dodai0419/earshot-sfx-lite (README, 2026-10-28)
- https://github.com/Clipwing/skills/blob/main/skills/real-sfx/README.md (2026-10-21)
- https://clipwing.pro/skills/real-sfx (2026-10-30 조회)
- https://vivian.hobbyland-group.com/en/article/free-sound-effects-claude-video-openverse-real-sfx-earshot (2026-10-27)
- https://api.openverse.org/v1/audio/ , https://api.openverse.org/v1/audio/stats/ , https://api.openverse.org/v1/schema/ (실호출 2026-10-30)
- https://docs.openverse.org/api/reference/authentication_and_throttling.html (2026-10-30 조회)
- https://github.com/WordPress/openverse (2026-10-29 커밋)
- https://github.com/heygen-com/hyperframes/blob/main/packages/cli/src/media-use/lib/openverse.mjs (2026-10-18 커밋)
- https://freesound.org/docs/api/overview.html , https://freesound.org/docs/api/resources_apiv2.html , https://freesound.org/help/tos_api/ (2026-10-30 조회)
- https://github.com/johnkimdw/freesound-mcp-server , https://github.com/sandraschi/sfx-mcp , https://github.com/flreey/sfxmint-mcp (gh api 2026-10-30)
- https://github.com/KilledByAPixel/ZzFX , https://github.com/chr15m/jsfxr , https://github.com/increpare/bfxr2 (gh api 2026-10-30)
- https://elevenlabs.io/docs/overview/capabilities/sound-effects , https://www.cartesia.ai/learn/elevenlabs-pricing (2026 조회)
- https://pypi.org/pypi/earshot/json (다른 패키지 pykeio/earshot 1.2.2, 2026-10-30)
- https://x.com/ElliotPadfield/status/2110764303087288788 (검색 요약으로만 확인, 원문 미검사)
