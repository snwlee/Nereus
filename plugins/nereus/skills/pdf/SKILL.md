---
name: pdf
description: 마크다운/Typst/LaTeX → PDF. Typst 기본, 템플릿 report/adr/research/spec. "PDF로", "보고서 출력" 요청 시.
---

# pdf

## 사용
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/pdf/scripts/pdf.mjs" <input.md|.typ|.tex> --out <file.pdf> [--template report|adr|research|spec] [--engine typst|latex] [--title "제목"] [--font "Noto Sans KR"] [--font-dir <dir>]
```
- `.md` 입력이면 Typst 템플릿에 본문을 끼워 컴파일한다(헤딩·굵게·코드·목록 변환). 표나 복잡한 레이아웃이 필요하면 `.typ`를 직접 쓴다.
- `.typ`/`.tex` 입력은 그대로 컴파일.
- 엔진이 없으면 종료 코드 2와 setup 안내. LaTeX 요청인데 xelatex이 없으면 Typst로 대체하고 알린다.

## Typst 직접 작성 시
```typst
#import "<CLAUDE_PLUGIN_ROOT>/skills/pdf/templates/typst/report.typ": doc
#show: doc.with(title: "제목", subtitle: "부제", author: "작성자", font: "Noto Sans KR")
= 1. 개요
...
```
템플릿 파라미터: `title, subtitle, author, date, font`. 한글 폰트가 시스템에 없으면 `--font-dir`로 폰트 파일 디렉터리를 준다(Noto Sans KR 권장).

## 에러 처리
컴파일 실패 시 `파일:줄:열`과 첫 8줄을 보여준다. 그 위치를 고치고 재시도한다. LaTeX 에러는 `l.<줄>` 형식.

## 어디서 쓰나
researcher(리서치 리포트), writer(ADR·스펙·보고서), finish(요청 시). 공식 `pdf` 스킬은 읽기·폼 채우기용이고 생성은 이 스킬이 한다.
