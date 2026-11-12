# review-channels

디자인 비평과 리뷰 2차 의견의 채널을 정한다.

## ADDED Requirements

### Requirement: 리뷰 2차 의견 기본은 EGM 이다
<!-- id: review.egmDefault -->
<!-- entities: Reviewer -->
<!-- enforced: tests/skills/review-merge.test.ts -->

`secondOpinion` 기본값은 `"egm"` 이고 OCR 과 EGM 을 계획한다. `"codex"` 는 OCR·EGM·Codex, `"none"` 은 OCR 만이다.
이전 값 `"gemini"`·모르는 값은 기본(`egm`)으로, 이전 값 `"both"` 는 `"codex"` 와 같게(EGM 뒤에 Codex) 읽는다. 배열 속 `gemini`·`agy` 는 `egm` 으로 읽고, 모르는 이름뿐인 배열은 기본으로 읽는다(빈 배열만 리뷰 끄기).
EGM 은 바이너리 검사·프로브 대상이 아니다.

#### Scenario: 기본 설정
- **WHEN** `secondOpinion` 을 지정하지 않는다
- **THEN** 계획은 `{ocr, egm}` 이고 codex 는 없다

#### Scenario: 이전 설정 호환
- **WHEN** `secondOpinion` 이 `"gemini"` 거나 `["ocr","gemini"]` 다
- **THEN** 계획은 기본(OCR+EGM)과 같고 Gemini 리뷰어는 없다

### Requirement: 디자인 비평 라운드는 impeccable 출처로 기록한다
<!-- id: design.impeccableSource -->
<!-- entities: DesignGate -->
<!-- enforced: tests/skills/design-feedback.test.ts -->

`design-feedback.mjs record` 가 남기는 라운드의 `source` 는 `"impeccable"` 이다. Gemini·agy 를 호출하는 경로(`direction`·`visual` 직접 실행)는 없다 —
그 명령은 impeccable 로 비평받고 `record` 하라는 안내와 함께 종료코드 2 로 끝난다. 판정 파서·차단 축·파일 해시 커버는 바뀌지 않는다.
`record` 는 `--report <impeccable 원본 보고서>` 를 요구하고 그 해시를 라운드에 남긴다. 원본에 `DEGRADED` 가 있으면 거절한다.

#### Scenario: 기록
- **WHEN** impeccable 비평을 `record visual --files a.css` 로 남긴다
- **THEN** 라운드 source 는 `impeccable` 이고 a.css 가 커버된다

### Requirement: Gemini 는 이미지 생성에만 쓴다
<!-- id: gemini.imageOnly -->
<!-- entities: Plugin -->
<!-- enforced: tests/skills/review-merge.test.ts, tests/skills/design-feedback.test.ts -->

`review.mjs`·`design-feedback.mjs` 는 `gemini_cli.py` 를 참조하지 않는다. Gemini 웹세션은 `nereus:image` 가 소유한다.
