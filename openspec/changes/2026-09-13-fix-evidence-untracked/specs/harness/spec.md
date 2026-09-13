## ADDED Requirements

### Requirement: 작업트리 해시는 추적되지 않은 파일의 내용 변경을 반영해야 한다
<!-- id: evidence.untrackedContent -->
<!-- entities: Checker -->
<!-- enforced: tests/lib/evidence.test.ts -->

`workTreeHash` 는 추적되지 않은(그러나 gitignore 되지 않은) 파일의 **내용**이 바뀌면
다른 값을 내야 한다. 이름만 보아서는 안 된다.

실측: FAIL 을 기록한 뒤 새 파일을 고쳐 PASS 가 되는 동안 해시가 `8e3293f791397a69` 로
동일했다. 신규 기능 개발은 대부분 새 파일에서 일어나므로, 이 구멍은 예외가 아니라 상시다.

gitignore 된 파일은 반영해서는 안 된다. 빌드 산출물로 매번 STALE 이 되면 게이트가 꺼진다.

#### Scenario: 미추적 파일 내용 변경
- **WHEN** 추적되지 않은 파일의 내용을 바꾼다
- **THEN** 해시가 달라진다

#### Scenario: 추적 파일 변경
- **WHEN** 추적 파일의 내용을 바꾼다
- **THEN** 해시가 달라진다

#### Scenario: 변경 없음
- **WHEN** 아무것도 바꾸지 않는다
- **THEN** 같은 해시다

#### Scenario: gitignore 된 파일
- **WHEN** gitignore 된 파일의 내용을 바꾼다
- **THEN** 해시가 같다

#### Scenario: 목록을 못 읽음
- **WHEN** 미추적 파일 목록을 가져오지 못한다
- **THEN** 미추적 파일이 없는 경우와 같은 지문을 내서는 안 된다
