# SkillSpector CI 판정 기준

CI `skill-quality` 잡은 `plugins/nereus/skills/` 의 스킬을 하나씩 `skillspector scan --no-llm` 으로 스캔한다.
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

`baselines/<스킬>.yaml` 은 2026-11-28 에 지적을 하나씩 읽고 판정한 결과다. 항목마다 `reason` 이 있다.
지문은 지적된 줄만이 아니라 같은 파일의 다른 내용에도 묶여 있다. 그 파일의 아무 줄이나 바뀌어도
(예: `setup/scripts/detect.mjs` 의 Node 라벨 한 줄, `design/SKILL.md` 끝에 한 줄 추가) 기존 지적이 새 지적으로 다시 뜬다 —
지적 내용이 같은지 확인하고 baseline 을 다시 만든다.

2026-11-28 판정 요약:

- **진짜 지적 → 고쳤다**: `image/scripts/__pycache__/*.pyc` 가 커밋되어 있었다(SC8·SC9, 분석을 피하는 바이트코드). 지우고 `.gitignore` 에 넣었다.
- **의도된 동작**: `image` 의 Gemini 웹세션 쿠키 읽기(PE3·AST5·TT4), `setup` 의 설치 안내(SC2)와 `~/.claude` 설정 점검(AS1), 문서화된 외부 API 호출(E1).
- **데이터 파일·문서 오탐**: 보안 참고 문서 본문(`review` MP3, `skill-audit` PE3), 리뷰 기준 문서(`goldfish` EA3), 테스트 러너 npx 호출을 MCP 서버로 본 것(RP1).
- **커버리지 신호**: AE1 은 참조 스크립트를 정적 파서가 부분 분석했다는 뜻이지 위협 근거가 아니다.

## 새 지적이 나오면

1. CI 로그의 지적을 읽는다. 진짜면 코드를 고친다.
2. 오탐이거나 의도된 동작이면 그 스킬의 baseline 을 다시 만들고 새 항목의 `reason` 을 구체적으로 적는다:

```sh
uv tool install git+https://github.com/NVIDIA/skillspector.git@v2.13.7
skillspector baseline plugins/nereus/skills/<스킬> --no-llm \
  -o .github/skillspector/baselines/<스킬>.yaml --reason "<판정 근거>"
```

`--reason` 은 모든 항목에 같은 값을 쓰므로, 기존 항목의 사유는 이전 파일에서 옮겨 적는다.
