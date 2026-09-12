# session-start (델타)

## MODIFIED Requirements

### Requirement: handoff 를 재개 지시와 함께 주입한다
<!-- id: session-start.handle -->
<!-- entities: HandoffDocument, SessionSource -->
<!-- enforced: session-start.mjs handle() -->

세션 디렉터리(또는 레거시 단일 파일)에서 고른 **가장 최근 handoff** 가 있고 내용이 비어 있지 않으면
시스템은 그 본문을 "## Baton 재개" 블록으로 주입해야 한다. 선행 문구는 `source` 에 따라 달라진다.

#### Scenario: clear 이후
- **WHEN** `source` 가 `compact` 가 아니다
- **THEN** `RESUME_CHECKLIST`(러너 실제 실행·git 확인·열린 질문·MUST NOT)를 앞에 붙인다

#### Scenario: compact 이후
- **WHEN** `source` 가 `compact` 다
- **THEN** 검증 체크리스트 없이 짧은 안내만 붙인다

#### Scenario: 읽을 handoff 가 없음
- **WHEN** 후보 파일이 하나도 없다
- **THEN** 본문 없이 이 세션의 handoff 경로만 알린다

## ADDED Requirements

### Requirement: 이 세션이 쓸 handoff 경로를 알린다
<!-- id: session-start.handle -->
<!-- enforced: session-start.mjs handle() -->

모델은 자기 `session_id` 를 모른다. 그래서 시스템은 매 세션 시작에 이 세션이 쓸 handoff 경로를
주입해, 이후 handoff·finish 가 **그 경로에만** 쓰게 해야 한다. 파일을 미리 만들지는 않는다.

#### Scenario: 경로 안내
- **WHEN** 어떤 `source` 로든 세션이 시작된다
- **THEN** 주입 내용에 `.nereus/handoff/<이름>.md` 경로와 "여기에만 쓴다"는 지시가 들어 있다

#### Scenario: 파일을 만들지 않는다
- **WHEN** 훅이 경로를 계산한다
- **THEN** 디스크에 파일을 만들지 않는다. 훅은 스스로 무엇도 바꾸지 않는다

### Requirement: 다른 세션의 최근 활동을 경고한다
<!-- id: session-start.handle -->
<!-- enforced: session-start.mjs handle() -->

최근 30분 안에 **다른 세션**이 갱신한 handoff 가 있으면 시스템은 재개 블록 끝에 경고를 붙여야 한다.
경고에는 파일명과 그 문서의 목표 한 줄을 넣는다. 작업을 막지는 않는다.

#### Scenario: 다른 세션 2개가 활동 중
- **WHEN** 30분 내 갱신된 다른 세션 파일이 2개 있다
- **THEN** 둘의 파일명과 요약을 담은 경고 한 블록이 붙는다

#### Scenario: 조용한 프로젝트
- **WHEN** 다른 세션 파일이 없거나 전부 30분보다 오래됐다
- **THEN** 경고를 붙이지 않는다

#### Scenario: 루프 서브세션
- **WHEN** 환경변수 `NEREUS_LOOP` 이 설정돼 있다
- **THEN** 경고를 생략한다. 반복마다 새 세션이라 매번 뜨는 소음이다
