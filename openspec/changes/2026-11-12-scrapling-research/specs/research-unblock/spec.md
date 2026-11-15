# research-unblock

조사에서 차단된 1차 자료를 얻는 경로를 정한다.

## ADDED Requirements

### Requirement: 차단 우회는 가벼운 단계부터 올리고 내용으로 판정한다
<!-- id: research.scrapeEscalate -->
<!-- entities: ResearchSource -->
<!-- enforced: tests/skills/research-scrape.test.ts -->

`scrape.mjs` 는 `get` 다음 `fetch` 순서로 시도하고, 앞 단계가 본문을 얻으면 멈춘다. 각 단계의 결과는 종료 코드가 아니라 받은 내용으로 판정한다 —
차단 화면이나 800자 미만의 응답은 실패다. 두 단계 모두 실패하면 `ok: false` 와 단계별 이유를 내고 파일을 자료로 넘기지 않는다.

#### Scenario: 차단 화면을 받음
- **WHEN** scrapling 이 종료 코드 0 으로 "Please enable JS" 화면을 저장한다
- **THEN** 그 단계는 실패로 기록되고 다음 단계로 올라간다

#### Scenario: 둘 다 막힘
- **WHEN** get 과 fetch 가 모두 차단 화면이거나 실행 실패다
- **THEN** `ok: false`, `file: null`, 종료 코드 1 이다

### Requirement: CloakBrowser 경로는 없다
<!-- id: research.noCloak -->
<!-- entities: SetupTool -->
<!-- enforced: tests/skills/research-scrape.test.ts, tests/skills/setup-detect.test.ts -->

setup 은 cloakbrowser 를 감지하지 않고 scrapling 을 선택 도구로 감지한다. 플러그인 문서·스크립트에 CloakBrowser 를 쓰라는 지시가 없다.

#### Scenario: setup 점검
- **WHEN** `/nereus:setup --check` 가 선택 도구를 나열한다
- **THEN** scrapling 행이 있고 cloakbrowser 행은 없다
