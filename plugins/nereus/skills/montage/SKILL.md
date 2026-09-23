---
name: montage
description: 여러 씬짜리 영상 제작은 OpenMontage 파이프라인으로 한다 — 무료·유료 공통. 장면별 비용 승인 → 생성 → 렌더 후 자기검토. 유료 생성 게이트(video-gate)의 해제 절차. 트리거 "생일 영상", "광고 영상", "영상 제작", "스토리보드", "OpenMontage".
---

# montage

nereus:common 규칙을 따른다. 이 스킬은 **제작 절차**다. 생성 도구는 공급자(아래 표)가 맡는다.

## 0. 언제 여기로 오나

| 요청 | 어디서 |
|---|---|
| 여러 씬을 이어 붙이는 영상 (기념·광고·설명·뮤직비디오·몽타주), 1분 이상, 스토리보드가 필요한 것 | **이 스킬 → OpenMontage** |
| 클립 **한 개** 생성 (t2v·i2v·립싱크·효과음) | `nereus:video` (단발) |
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
2. **파이프라인을 고른다** (`pipeline_defs/`). 레퍼런스 영상이 있으면 그걸 붙여 분석부터 한다.
3. **제안 단계에서 총비용을 사용자에게 보인다.** 공급자 `estimate_cost` 합계 + 재시도 여유.
4. **스토리보드 승인 게이트(Backlot)** — 장면별 테이크·프롬프트·장당 비용. 사용자가 승인하기 전엔 생성하지 않는다.
   사용자가 PC 를 못 보면 스토리보드를 사용자가 볼 수 있는 곳(공유 페이지 등)에 띄운다.
5. 생성 → 조립 → **렌더 후 자기검토**(ffprobe 길이, 프레임 샘플, 오디오 레벨). 통과 전에는 "완성"이라 하지 않는다.

## 3. 유료 생성 게이트 (video-gate)

`pre-tool-guard` 가 OpenMontage 밖의 유료 생성 호출을 본다.

- 유료 API 를 부르는 **배치 스크립트**(파일 안에 `higgsfield_client`·`hf.subscribe`·`api.muapi.ai`·`fal` 등) → **차단**
- **단발 호출**(인라인 명령, `muapi-cli generate`, 유료 생성 MCP 도구) → 하루 `singleCallsPerDay`(기본 2)회까지 허용
- OpenMontage 체크아웃(`AGENT_GUIDE.md`+`pipeline_defs/`) 안에서는 통과

**해제는 사용자 승인으로만 한다.** 사용자가 "이번 한 번 그냥 돌려"라고 명시하면 그 사유를
`.nereus/video-gate-override` 에 한 줄로 적고 다시 실행한다. 한 번 통과하면 파일은 사라진다.
에이전트가 스스로 사유를 지어 오버라이드를 만들지 않는다.

설정 (`.nereus/config.json` 또는 `~/.config/nereus/config.json`):

```json
{ "videoGate": { "enforce": "block", "singleCallsPerDay": 2 } }
```

`enforce`: `block`(기본) · `warn`(통과시키되 경고) · `off`.

## 4. 이 게이트가 생긴 사고 (2026-09 엄마 생신 영상)

- 4K 이미지 배치로 선불 보너스를 소진 — 단가를 잔액으로 재기 전에 배치를 돌렸다
- 비어 있는 기준 폴더를 가리킨 채 인물 i2v 를 유료로 생성 — 결과에 주인공이 없었다
- 파라미터를 확인하려던 "탐색 요청"이 네 번 실제 과금 작업으로 접수됐다 — **유료 엔드포인트로 탐색하지 않는다**
- 렌더가 155초에서 잘렸고, 앞 27초가 무음이었고, 음악이 효과음보다 9dB 작았다 — 자기검토가 없었다

전부 "장면별 비용 승인"과 "렌더 후 자기검토"가 있었으면 생성 전에·전달 전에 걸렸을 일이다.
