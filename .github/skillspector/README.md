# SkillSpector CI 판정 기준

CI `skill-quality` 잡은 `plugins/*/skills/*/` 의 모든 플러그인 스킬을 하나씩 `skillspector scan --no-llm` 으로 스캔한다.
새 플러그인도 글롭으로 자동 포함된다. 루프는 `scan-all.sh` 에 있고 CI 와 로컬이 같은 스크립트를 쓴다:

```sh
.github/skillspector/scan-all.sh   # 종료 코드 0 = 통과
```

스크립트는 작업 트리를 그대로 보지 않고 git 이 커밋할 파일(추적 + 무시되지 않은 새 파일)만 임시 트리로 옮겨 스캔한다.
`npm test` 가 남기는 `image/scripts/__pycache__/*.pyc` 같은 gitignore 산출물 때문에 로컬에서만 SC8·SC9 가 뜨는 일을 막는다.

버전은 워크플로의 `SKILLSPECTOR_VERSION` 으로 고정한다(현재 v2.13.7). 올릴 때는 baseline 도 같이 다시 만든다 —
지문(fingerprint) 형식과 규칙이 버전마다 바뀐다.

## 무엇이 실패인가

| 상황 | 결과 |
|---|---|
| 새 CRITICAL/HIGH 지적 (`scan-gate.mjs` 판정) | 실패 |
| 스캔이 끝까지 돌지 않음, 보고서 없음·깨짐 | 실패 |
| skillspector 종료 코드 ≠ 0 (위험도 HIGH 이상) | 실패 |
| 새 MEDIUM/LOW 지적 | 경고(annotation) |
| 분석 완결성 partial (정적 파서 한계) | 통과 — 깨끗한 문서도 partial 이 나온다 |

## baseline 은 "끄기"가 아니라 검토 기록이다

`baselines/<플러그인>/<스킬>.yaml` 은 플러그인별로 나눈다(플러그인 사이에 같은 스킬 이름이 생겨도 섞이지 않게).
`baselines/nereus/*.yaml` 은 2026-11-28 에 지적을 하나씩 읽고 판정한 결과다. 항목마다 `reason` 이 있다.
지문은 지적된 줄만이 아니라 같은 파일의 다른 내용에도 묶여 있다. 그 파일의 아무 줄이나 바뀌어도
(예: `setup/scripts/detect.mjs` 의 Node 라벨 한 줄, `design/SKILL.md` 끝에 한 줄 추가) 기존 지적이 새 지적으로 다시 뜬다 —
지적 내용이 같은지 확인하고 baseline 을 다시 만든다.

2026-11-28 판정 요약:

- **진짜 지적 → 고쳤다**: `image/scripts/__pycache__/*.pyc` 가 커밋되어 있었다(SC8·SC9, 분석을 피하는 바이트코드). 지우고 `.gitignore` 에 넣었다.
- **의도된 동작**: `image` 의 Gemini 웹세션 쿠키 읽기(PE3·AST5·TT4), `setup` 의 설치 안내(SC2)와 `~/.claude` 설정 점검(AS1), 문서화된 외부 API 호출(E1).
- **데이터 파일·문서 오탐**: 보안 참고 문서 본문(`review` MP3, `skill-audit` PE3), 리뷰 기준 문서(`goldfish` EA3), 테스트 러너 npx 호출을 MCP 서버로 본 것(RP1).
- **커버리지 신호**: AE1 은 참조 스크립트를 정적 파서가 부분 분석했다는 뜻이지 위협 근거가 아니다.

2026-11-28 범위 확장(nereus-3d·nereus-ads·nereus-game·nereus-l10n, 28개 스킬 추가) 판정:

- **진짜 지적 → 수정 보류(오너 판단 대기)**: `nereus-game/asset` SC2 — SKILL.md 가 `pch` 를 `curl -fsSL https://patch.gg/install.sh | sh` 로 설치하라고 안내한다.
  setup 의 설치 안내와 달리 사용자 승인 절차가 없다. baseline 사유에 보류임을 적었고, 고치면 그 항목을 지운다.
- **오탐**: `nereus-game/roblox` EA4 — `templates/economy_math.luau` 의 `maxAffordable` 루프는 `maxLevel` 상한·유한값 검사·가격≥1 검사로 끝이 보장된다.
- 나머지 26개 스킬은 지적 0건.

## 새 지적이 나오면

1. CI 로그의 지적을 읽는다. 진짜면 코드를 고친다.
2. 오탐이거나 의도된 동작이면 그 스킬의 baseline 을 다시 만들고 새 항목의 `reason` 을 구체적으로 적는다:

```sh
uv tool install git+https://github.com/NVIDIA/skillspector.git@v2.13.7
skillspector baseline plugins/<플러그인>/skills/<스킬> --no-llm \
  -o .github/skillspector/baselines/<플러그인>/<스킬>.yaml --reason "<판정 근거>"
```

`--reason` 은 모든 항목에 같은 값을 쓰므로, 기존 항목의 사유는 이전 파일에서 옮겨 적는다.
생성된 파일은 사유를 `\uXXXX` 로 이스케이프하니, 평문 UTF-8 로 바꿔 둔다(사람이 읽는 검토 기록이다).
