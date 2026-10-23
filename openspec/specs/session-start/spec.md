# session-start

> **2026-10-23 변경.** 대화형 세션에는 handoff 를 주입하지 않는다(Baton 폐지 — `baton-handoff` 참고).
> handoff 주입·경로 안내는 **루프 서브세션(`NEREUS_LOOP`)에서만** 한다. 다른 세션 활동 경고는 루프에서
> 원래 생략됐으므로 함께 없어졌다. 대화형 컨텍스트는 Claude Code 자동 압축(50%)이 맡는다.
> 루프는 `NEREUS_LOOP_SINCE`(루프 시작 시각) 이후 파일만 이어받는다 — 루프 이전의 낡은 handoff 를 첫 반복이 상태로 착각하지 않게.

새 컨텍스트가 열릴 때 필요한 상태를 한 번에 주입하는 능력.
진입점: `plugins/nereus/hooks/scripts/session-start.mjs` (`SessionStart` 훅,
matcher `startup|resume|clear|compact`).

Last verified: 2026-10-23

## Purpose

새 컨텍스트가 열릴 때 학습·스킬 맵·하네스 상태를(루프 반복이면 handoff 도) 한 번에 주입한다. 세션을 막지 않고, 스스로 아무것도 바꾸지 않는다.

## Requirements

### Requirement: 루프 반복에서만 handoff 를 주입한다
<!-- id: session-start.handle -->
<!-- entities: HandoffDocument, SessionSource -->
<!-- enforced: session-start.mjs handle() -->

환경변수 `NEREUS_LOOP` 이 설정돼 있고 세션 디렉터리(또는 레거시 단일 파일)에서 고른 **가장 최근 handoff** 가
비어 있지 않으면 시스템은 그 본문을 재개 블록으로 주입해야 한다. `NEREUS_LOOP` 이 없으면 handoff 를 읽지도 주입하지도 않는다.

#### Scenario: 대화형 세션
- **WHEN** `NEREUS_LOOP` 이 없다(`startup`·`resume`·`clear`·`compact` 모두)
- **THEN** 출력에 handoff 본문·재개 체크리스트·handoff 경로 안내가 없다

#### Scenario: 루프 반복
- **WHEN** `NEREUS_LOOP` 이 설정돼 있고 직전 반복이 handoff 를 남겼다
- **THEN** 그 본문을 재개 지시와 함께 주입한다

#### Scenario: 루프 첫 반복
- **WHEN** `NEREUS_LOOP` 이 설정돼 있고 후보 파일이 하나도 없다
- **THEN** 본문 없이 이 반복의 handoff 경로만 알린다

### Requirement: compact 에는 반복 주입하지 않는다
<!-- id: session-start.handle -->
<!-- enforced: session-start.mjs handle() -->

스킬 맵과 "Nereus 상태" 블록은 `source` 가 `compact` 일 때 주입하지 않아야 한다.
같은 대화 안에서 이미 주입됐기 때문이다.

#### Scenario: compact
- **WHEN** `source === "compact"`
- **THEN** 출력에 스킬 맵과 상태 블록이 없다

### Requirement: 도구 상태를 캐시로 조회한다
<!-- id: session-start.toolStatusCached -->
<!-- enforced: session-start.mjs toolStatusCached() -->

시스템은 `REQUIRED_TOOLS` 의 미설치 목록을 `<userConfigDir>/tools.json` 에 캐시하고,
`checkedAt` 이 24시간 이내면 재조사 없이 캐시를 써야 한다. 매 세션 8개 바이너리를
PATH 조회하는 비용을 피하기 위해서다.

#### Scenario: 캐시 만료
- **WHEN** `now - checkedAt >= 24시간`
- **THEN** 다시 조사하고 캐시를 갱신한다

#### Scenario: 캐시 파일 손상
- **WHEN** 캐시 파일이 없거나 JSON 파싱에 실패한다
- **THEN** 조용히 재조사한다(fail-open). 훅은 세션을 막지 않는다

### Requirement: 상태 알림은 한 줄씩 모아 한 블록으로 낸다
<!-- id: session-start.handle -->
<!-- enforced: session-start.mjs handle() -->

codegraph 인덱스 부재, 미설치 도구, 검토 대기 학습 후보, 자동 압축 임계값이 미설정이거나 50% 초과인 것을
각각 한 줄로 모아 "## Nereus 상태" 한 블록으로 출력해야 한다. 알릴 것이 없으면 블록 자체가 없다.
자동 압축 알림은 Claude Code 대화형 세션에서만 낸다 — Codex·OpenCode 는 `~/.claude/settings.json` 을 읽지 않아
끌 수 없고, 루프 반복에는 소음이다. 50% 이하로 일부러 정한 값은 알리지 않는다.

#### Scenario: 알릴 것 없음
- **WHEN** 인덱스가 있고 도구가 다 깔려 있고 대기 후보가 0건이고 `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` 가 50 이하다
- **THEN** 상태 블록을 내지 않는다

### Requirement: 훅은 실패해도 세션을 막지 않는다
<!-- invariant: 항상 참. 트리거가 없다 -->
<!-- enforced: session-start.mjs -->
<!-- verified_by: tests/hooks/session-start.test.ts -->

파일 읽기·캐시 쓰기 실패는 전부 삼키고 진행한다. 주입할 것이 하나도 없으면
`null` 을 반환한다(빈 페이로드를 내지 않는다).

#### Scenario: 파일 읽기 실패
- **WHEN** handoff 읽기나 캐시 쓰기가 예외를 던진다
- **THEN** 예외를 삼키고 진행하며, 주입할 것이 없으면 null 을 반환한다

### Requirement: 훅은 자동으로 무엇도 변경하지 않는다
<!-- invariant: 항상 참. 트리거가 없다 -->
<!-- enforced: session-start.mjs -->

이 훅은 알림과 컨텍스트 주입만 한다. 사용자 설정이나 프로젝트 파일을 고치지 않는다.
유일한 쓰기는 자기 도구 캐시(`tools.json`)다.

#### Scenario: 훅 1회 실행
- **WHEN** SessionStart 훅이 실행된다
- **THEN** tools.json 캐시 외에 어떤 사용자 설정·프로젝트 파일도 바뀌지 않는다

### Requirement: 새 플러그인 지문이 생겼을 때만 한 줄 알린다
<!-- entities: PluginSnapshot -->

SessionStart 훅은 활성 플러그인 집합의 스냅샷을 `~/.config/nereus/plugin-snapshot.json` 과
비교해, 새로 설치되거나 활성화된 것이 있으면 "## Nereus 상태" 블록에 한 줄을 추가해야 한다.
훅은 어떤 설정도 자동으로 바꾸지 않는다.

#### Scenario: 새 플러그인 설치됨
- **WHEN** 이전 스냅샷에 없던 플러그인이 활성 상태로 발견된다
- **THEN** `새 플러그인 N개 감지 → /nereus:doctor` 한 줄이 상태 블록에 추가되고 스냅샷이 갱신된다

#### Scenario: 변화 없음
- **WHEN** 활성 플러그인 집합이 이전 스냅샷과 같다
- **THEN** 알림 줄을 추가하지 않는다

#### Scenario: 스냅샷 파일 없음 (첫 실행)
- **WHEN** 스냅샷 파일이 없다
- **THEN** 현재 집합을 기준선으로 기록만 하고 알리지 않는다. 첫 실행에 전체를 "새 플러그인"으로 보고하지 않는다

#### Scenario: compact
- **WHEN** `source === "compact"`
- **THEN** 상태 블록 자체를 내지 않는 기존 규칙을 따르며 스냅샷도 갱신하지 않는다

### Requirement: 루프 반복이 쓸 handoff 경로를 알린다
<!-- id: session-start.handle -->
<!-- enforced: session-start.mjs handle() -->

모델은 자기 `session_id` 를 모른다. 그래서 시스템은 루프 반복(`NEREUS_LOOP`) 시작에 그 반복이 쓸 handoff 경로를
주입해, 반복이 **그 경로에만** 쓰게 해야 한다. 파일을 미리 만들지는 않는다. 대화형 세션에는 알리지 않는다.

#### Scenario: 경로 안내
- **WHEN** `NEREUS_LOOP` 이 설정된 새 반복 세션이 열린다
- **THEN** 주입 내용에 `.nereus/handoff/` 아래 이 반복의 경로와 "여기에만 쓴다"는 지시가 들어 있다

#### Scenario: 파일을 만들지 않는다
- **WHEN** 훅이 경로를 계산한다
- **THEN** 디스크에 파일을 만들지 않는다. 훅은 스스로 무엇도 바꾸지 않는다

### Requirement: (Removed 2026-10-23) 다른 세션의 최근 활동을 경고한다

대화형 세션에 handoff 가 없어지면서 없어졌다. 루프 서브세션에서는 원래 생략됐다(반복마다 뜨는 소음).

### Requirement: 되묻지 않는다는 규칙을 매 세션 주입한다
<!-- id: session-start.handle -->
<!-- enforced: session-start.mjs ASK_POLICY -->

시스템은 새 컨텍스트마다 한 줄 정책을 주입해야 한다:
순서·우선순위·착수 승인은 묻지 않고 스스로 정해 끝까지 한다. 질문은 하네스가 알 수 없는 정보와
외부로 나가는 행동에만 쓴다. 스킬 문서에만 적으면 그 스킬을 부르지 않은 턴에는 적용되지 않기 때문이다.

#### Scenario: 새 컨텍스트
- **WHEN** `source` 가 `compact` 가 아니다
- **THEN** 주입 내용에 그 정책 한 줄이 들어 있다

#### Scenario: compact
- **WHEN** `source` 가 `compact` 다
- **THEN** 다시 주입하지 않는다. 같은 대화에 이미 들어 있다
