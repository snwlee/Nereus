---
name: montage
description: 여러 씬짜리 영상 제작은 OpenMontage 파이프라인으로 한다 — 무료·유료 공통. 장면별 비용 승인 → 생성 → 렌더 후 자기검토. 유료 생성 게이트(video-gate)와 사이트 잔액 기준 예산(budget). 트리거 "생일 영상", "광고 영상", "영상 제작", "스토리보드", "OpenMontage".
---

# montage

nereus:common 규칙을 따른다. 이 스킬은 **제작 절차**다. 생성 도구는 공급자(아래 표)가 맡는다.

## 0. 언제 여기로 오나

| 요청 | 어디서 |
|---|---|
| 여러 씬을 이어 붙이는 영상 (기념·광고·설명·뮤직비디오·몽타주), 1분 이상, 스토리보드가 필요한 것 | **이 스킬 → OpenMontage** |
| 클립 **한 개** 생성 (t2v·i2v·립싱크) | `nereus:video` (단발) |
| 효과음 (합성·무료 검색·배치·크레딧) | `nereus:sfx` |
| 이미지 한 장 | `nereus:image` (무료) |
| 이미 있는 HyperFrames 프로젝트의 한 장면 수정 | `hyperframes` 계열 직접 |

**무료냐 유료냐로 나누지 않는다. 규모로 나눈다.** OpenMontage 는 무료 경로(스톡 푸티지·오픈 아카이브,
piper TTS, HyperFrames/Remotion 모션그래픽)와 유료 경로(Higgsfield·fal·Kling·Seedance·Veo)를 같은
파이프라인에 태운다. 공급자는 도구이고, 승인·비용·검토는 파이프라인이 한다.

## 1. 설치 (한 번)

```bash
git clone https://github.com/calesthio/OpenMontage.git ~/OpenMontage   # 내장 디스크. 외장 SSD 는 npm postinstall 이 반쪽으로 끝난 전례가 있다
cd ~/OpenMontage && make setup
```

라이선스는 **AGPLv3**. 결과 영상은 상관없지만, OpenMontage 코드를 고쳐 서비스로 배포하면 소스 공개 의무가 생긴다.

키는 `~/OpenMontage/.env` 에 **사람이 직접** 넣는다(nereus 는 시크릿 파일을 편집하지 않는다):

| 공급자 | 변수 | 비고 |
|---|---|---|
| Higgsfield | `HIGGSFIELD_KEY=<id>:<secret>` (또는 `HIGGSFIELD_API_KEY`+`HIGGSFIELD_API_SECRET`) | OpenMontage 기본 지원 (`tools/video/higgsfield_video.py`), `estimate_cost` 있음 |
| fal / Atlas Cloud / Kling / Ark(Seedance) | README 의 `.env` 절 | 선택 |
| **Muapi** | — | **OpenMontage 가 지원하지 않는다.** 필요하면 `tools/` 에 어댑터를 붙이거나, 단발 클립만 `nereus:video` 로 만들어 에셋으로 넣는다 |
| Gemini 웹세션 이미지 | — | OpenMontage 밖. `nereus:image` 로 만든 파일을 에셋으로 넣는다 (무료) |

## 2. 절차

1. **AGENT_GUIDE.md → PROJECT_CONTEXT.md 를 먼저 읽는다.** 파이프라인을 즉흥으로 만들지 않는다.
2. **스타일을 고른다.** 고르지 않으면 매번 같은 기본 문법(키네틱 타이포·중앙 정렬 카드)이 나온다.
   ```bash
   S="node ${CLAUDE_PLUGIN_ROOT}/skills/montage/scripts/styles.mjs"
   $S pick "luxury hotel gala invitation" --commercial     # 영문 키워드 — 카탈로그의 uses 가 영문이다
   $S show art-deco                                         # 고른 스타일의 STYLE.md 경로와 본문
   ```
   후보 3~5 개를 사용자에게 보이고 하나를 고른다. 고른 STYLE.md 의 **규칙**(팔레트 논리·타이포·모션 품질·카메라 문법·함정)을
   스토리보드의 장면 지시로 옮긴다. DEMO.md 의 줄거리·소품은 옮기지 않는다. 광고·상업이면 `--commercial` 을 꼭 붙인다.
3. **파이프라인을 고른다** (`pipeline_defs/`). 레퍼런스 영상이 있으면 그걸 붙여 분석부터 한다.
4. **제안 단계에서 총비용을 사용자에게 보인다.** 공급자 `estimate_cost` 합계 + 재시도 여유.
5. **스토리보드 승인 게이트(Backlot)** — 장면별 테이크·프롬프트·장당 비용. 사용자가 승인하기 전엔 생성하지 않는다.
   사용자가 PC 를 못 보면 스토리보드를 사용자가 볼 수 있는 곳(공유 페이지 등)에 띄운다.
6. 생성 → 조립 → **효과음은 `nereus:sfx`**(합성 → Openverse → 유료 폴백, 정점을 컷에 맞춰 믹스, `SOUNDS.md`) → **렌더 후 자기검토**(ffprobe 길이, 프레임 샘플, 오디오 레벨). 통과 전에는 "완성"이라 하지 않는다.

### 스타일 출처와 동반 도구

스타일 카탈로그는 **Lemo-Opuscar**(MIT, 스타일 67종, 2026-10-30 기준)다. **플러그인으로 설치하지 않는다** — 설치하면
그 스킬이 영상 요청을 가로챈다. 고르기에는 `styles/` 만 필요하니 얇게 받는다:
```bash
H=~/.local/share/nereus/montage/lemo-opuscar            # 다른 곳이면 NEREUS_LEMO
git clone --depth 1 --filter=blob:none --sparse https://github.com/lemomo-ai/lemo-opuscar "$H"
git -C "$H" sparse-checkout set styles                  # 134MB. 렌더러까지 받으면 수백 MB + 샘플 1.4GB
$S doctor                                               # 현재 커밋과 스타일 수
```
커밋은 고정하지 않는다 — 주마다 스타일이 늘어난다. 경로를 외우지 않고 `styles/*/style.json` 을 읽는다.
스타일은 Opus 5.5 에 맞춰 쓰였고 Lemo 자체 렌더러(canvas/WebGL)를 전제로 한다. HyperFrames 로 옮기면 3D·셰이더 계열은 품질이 떨어질 수 있다.
데모 영상 샘플(CC BY 4.0)을 쓰면 크레딧을 납품물에 넣는다.

릴스(Web Lab AI, 2026-10)가 함께 소개한 도구는 정책으로 판정한다 — `$S companion <이름> [--commercial] [--named] [--paid-key]`:

| 도구 | 판정 | 이유 |
|---|---|---|
| Lemo-Opuscar | allow | MIT, 키 불필요. 라이브러리로만 |
| Collage B-roll | 키 없으면 block · 있으면 conditional | Gemini 유료 영상 생성 — video-gate·budget 승인, 정지 이미지는 `nereus:image` |
| Claude Animation Base | 광고 block · 비상업 conditional | Clawd(Anthropic 마스코트) 상표. 자체 캐릭터로 바꿔 엔진·가이드만 참고 |
| onetake | 광고 block · 비상업이고 사용자가 지명했을 때만 conditional | PolyForm Noncommercial. 전역 설치하면 promo 요청을 HyperFrames 에서 가로챈다 |

광고 모드(`--commercial`)의 `pick` 은 Clawd 가 나오는 `living-screencast` 를 후보에서 뺀다.
근거: `docs/research/2026-10-30-video-style-skills.md`

## 3. 유료 생성 게이트 (video-gate + budget)

`pre-tool-guard` 가 모든 유료 생성 호출을 본다. 돈은 **추정이 아니라 공급자 사이트의 잔액 차이**로 잰다.

**구조 규칙 (video-gate)**
- 유료 API 를 부르는 **배치 스크립트**(파일 안에 `higgsfield_client`·`hf.subscribe`·`api.muapi.ai`·`fal` 등)를 OpenMontage 밖에서 실행 → **차단**
- OpenMontage 체크아웃(`AGENT_GUIDE.md`+`pipeline_defs/`) 안의 유료 호출은 파이프라인 = 배치로 본다

**돈 규칙 (budget)** — 단발 호출(인라인, `muapi-cli generate`, 유료 생성 MCP)과 배치 모두
1. 프로젝트에 예산이 있어야 한다: `.nereus/budget.json`
2. 사이트 잔액을 **20분 안에** 확인했어야 한다 (`freshMinutes`)
3. 사용액(시작 잔액 − 최신 잔액)이 예산 미만이어야 한다
4. 배치는 **비용 계획**(`plan`)이 있어야 하고, 계획이 남은 예산 안이어야 한다

```bash
B="node plugins/nereus/skills/montage/scripts/budget.mjs"   # 프로젝트 루트에서 실행
$B init --limit 10          # 사용자에게 예산을 묻고 정한다. 시작 잔액은 사이트에서 자동으로 읽는다
$B prices                   # 사이트 가격표(정가, "from" 최저가) — 해상도·길이에 따라 더 비쌀 수 있다
$B plan --usd 3.4 --note "Kling 3.0 pro 1080p 5s × 8컷"   # 합계를 사용자에게 보인 뒤 기록
$B balance                  # 생성 전후로 잔액을 다시 읽는다 → 실제 단가가 드러난다
$B status
```

**잔액은 자동 → 실패 시 수동.** 자동은 Aside 브라우저(`aside repl`)로 청구 페이지를 읽는다.
Aside 브라우저가 공급자에 로그인돼 있지 않으면 로그인 화면이 나와 실패한다 — 그때는 종료코드 3 과 함께
수동 안내가 나온다. **사용자에게 대시보드 잔액을 물어** `balance --set <USD>` 로 기록한다.
에이전트가 사용자의 자격증명으로 대신 로그인하지 않는다. 가격표는 공개 페이지라 로그인 없이 읽힌다.

**단가를 믿는 순서:** 잔액 차이(실측) > 사이트 가격표 > OpenMontage `estimate_cost`(코드에 박힌 값, 갱신 안 됨).

**해제는 사용자 승인으로만 한다.** 사용자가 "이번 한 번 그냥 돌려"라고 명시하면 그 사유를
`.nereus/video-gate-override` 에 한 줄로 적고 다시 실행한다. 한 번 통과하면 파일은 사라진다(예산 검사도 이번만 건너뛴다).
에이전트가 스스로 사유를 지어 오버라이드를 만들지 않는다.

설정 (`.nereus/config.json` 또는 `~/.config/nereus/config.json`):

```json
{ "videoGate": { "enforce": "block", "freshMinutes": 20 } }
```

`enforce`: `block`(기본) · `warn`(통과시키되 경고) · `off`.

## 4. 이 게이트가 생긴 사고 (2026-09 엄마 생신 영상)

- 4K 이미지 배치로 선불 보너스를 소진 — 단가를 잔액으로 재기 전에 배치를 돌렸다 (→ 잔액 실측·비용 계획 규칙)
- 비어 있는 기준 폴더를 가리킨 채 인물 i2v 를 유료로 생성 — 결과에 주인공이 없었다
- 파라미터를 확인하려던 "탐색 요청"이 네 번 실제 과금 작업으로 접수됐다 — **유료 엔드포인트로 탐색하지 않는다**
- 렌더가 155초에서 잘렸고, 앞 27초가 무음이었고, 음악이 효과음보다 9dB 작았다 — 자기검토가 없었다

전부 "장면별 비용 승인"과 "렌더 후 자기검토"가 있었으면 생성 전에·전달 전에 걸렸을 일이다.
