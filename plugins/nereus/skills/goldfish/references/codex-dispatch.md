# Codex에서 Claude로 독립 리뷰 요청

계획이 `reviewerRunner: "claude-cli"`를 반환하면 작업 저장소 루트에서 페르소나마다 [Goldfish의 Claude 실행 명령](../SKILL.md#독립-리뷰어-호출)을 실행한다. 스크립트 경로는 현재 스킬의 플러그인 루트 기준 절대 경로다. `MODEL`은 계획의 `reviewerModel`, `egmModel`, 또는 `refuterModel`이다.

- `PROMPT_FILE`에는 호출한 스킬의 검토 프롬프트와 지정된 검토 자료만 저장한다. 현재 대화의 결론이나 요약은 넣지 않는다. 러너는 설치된 `claude`로 요청마다 새 세션을 열고 파일 읽기·검색 도구만 제공한다.
- 코드 EGM은 Codex가 먼저 검토 범위의 diff를 수집한다. 커밋 범위는 `git diff <base>...HEAD`, 미커밋 범위는 `git diff HEAD`와 `git status --porcelain`을 사용한다. 결과를 검토 자료로 첨부하고 Claude에 해당 자료와 미추적 파일을 읽도록 지시한다. diff가 크면 세션 작업 폴더에 저장하고 절대 경로를 전달한다.
- 같은 단계의 리뷰어는 병렬로 실행하고 각 stdout을 기존 결과 형식으로 수집한다. 종료 코드가 0이 아니면 원인을 기록한다. 모델 사용 불가 오류에 한해 일반 리뷰의 `opus`를 `sonnet`으로 한 번 재시도할 수 있다. 성공하면 실제 모델과 `degraded`를 기록한다.
- Claude를 실행할 수 없거나 결과를 받지 못하면 Goldfish는 `not run`, 코드 EGM은 `skipped`로 기록한다. 보안 반박에는 모델 하향을 적용하지 않으며 실패 시 기존 지적을 차단 상태로 유지한다.
