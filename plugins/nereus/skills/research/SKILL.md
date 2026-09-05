---
name: research
description: 시장·기술 조사 절차: gh search → 웹 → last30days → Agent-Reach. docs/research/ 보고서+PDF. "조사", "리서치", "비교" 요청 시.
---

# research

nereus:common 규칙. 담당: researcher.

## 1. 질문 분해
요청을 3~6개 하위 질문으로 나누고 사용자에게 한 번 보여준다(수정 기회). 각 질문에 "어떤 근거가 답이 되는가"를 적는다.

## 2. 수집 순서 (앞 단계로 충분하면 뒤는 생략)
1. `gh search repos "<키워드>" --sort stars --limit 20 --json fullName,stargazersCount,pushedAt,description,license` / `gh search code`. 구현·라이브러리 질문은 여기서 대부분 끝난다.
2. WebSearch → 상위 결과 WebFetch. 공식 문서·1차 자료 우선. 날짜를 기록.
3. `last30days` 스킬(설치 시): Reddit/X/YouTube/HN 최근 30일 반응. 사용자 불만·실사용 후기용.
4. `Agent-Reach`(설치 시): 특정 트윗·영상·스레드 원문이 필요할 때만.

## 3. 검증
- 주장마다 출처 URL + 확인 날짜. 두 출처가 상충하면 둘 다 적고 판단 근거를 쓴다.
- 오픈소스 비교표 필수 열: 마지막 커밋일, 라이선스, 스타, 우리 스택(Flutter/Spring/TS) 적합성, Windows 지원.
- 숫자는 원문 그대로. 추정치는 "추정"이라고 표시.

## 4. 출력
`docs/research/<YYYY-MM-DD>-<slug>.md`:
1. 요약(3줄) 2. 질문과 답 3. 비교표 4. 추천 하나 + 이유 + 리스크 5. 출처 목록.
그 다음 `nereus:pdf --template research`로 같은 이름의 PDF.
