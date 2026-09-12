# plugin-packaging (델타)

## ADDED Requirements

### Requirement: OCR 리뷰어를 커밋된 브랜치 범위로 호출해야 한다
<!-- id: review.ocrRange -->
<!-- entities: Reviewer -->
<!-- enforced: plugins/nereus/skills/review/scripts/review.mjs -->

시스템은 `ocr delegate` 를 호출할 때 리뷰 대상 범위를 `--from`/`--to` 인자로 넘겨야 한다.
인자 없이 부르면 워크스페이스(미커밋) 모드로 떨어져 커밋된 변경이 리뷰 대상에서 빠진다.
세 사이클 동안 이 호출 오류를 도구 한계로 오인해 2차 의견 없이 리뷰를 종결했다.

#### Scenario: base 가 주어진 경우
- **WHEN** base 를 `main` 으로 주고 인자를 만든다
- **THEN** `--from main` 과 `--to HEAD` 가 포함된다

#### Scenario: base 가 없는 경우
- **WHEN** base 를 주지 않는다
- **THEN** 범위 인자 없이 워크스페이스 모드로 둔다
