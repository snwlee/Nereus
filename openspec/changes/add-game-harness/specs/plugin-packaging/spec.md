# plugin-packaging (델타)

## REMOVED Requirements

### Requirement: 스킬 라우팅은 nereus 코어가 단독 소유하며 확장점이 없다

**제거 이유**: 형제 플러그인이 스킬을 제공할 수 없어 게임 하네스를 별도 플러그인으로 둘 수 없었다.
아래 ADDED 요구사항이 확장점을 열어 이를 대체한다. 코어 라우트의 우선순위는 그대로 유지된다.

## ADDED Requirements

### Requirement: 형제 플러그인이 스킬 라우트와 스택 탐지를 확장할 수 있다
<!-- id: extensions.load -->
<!-- entities: Plugin, Router, Stack -->
<!-- enforced: plugins/nereus/hooks/scripts/lib/extensions.mjs -->

시스템은 설치·활성화된 형제 플러그인의 루트에서 `nereus-extension.json` 을 읽어
`routes`(스킬 라우팅 항목)와 `stacks`(스택·테스트러너 탐지 항목)를 코어 목록에 병합해야 한다.
발견은 `settings.json` 의 `enabledPlugins` 와 각 항목의 `installPath` 로만 한다 — 디스크 존재만으로는 활성이 아니다.
읽기 실패·형식 오류는 삼키고 그 플러그인만 건너뛴다. 확장이 코어를 죽이면 안 된다.

#### Scenario: 확장을 선언한 형제 플러그인
- **WHEN** 활성 플러그인 루트에 `routes` 를 담은 유효한 `nereus-extension.json` 이 있다
- **THEN** 그 라우트가 프롬프트 라우팅과 SessionStart 스킬맵에 나타난다

#### Scenario: 깨진 확장 파일
- **WHEN** `nereus-extension.json` 이 JSON 으로 파싱되지 않는다
- **THEN** 해당 플러그인의 확장만 무시하고 코어 라우팅은 정상 동작한다

#### Scenario: 비활성 플러그인
- **WHEN** 플러그인 디렉터리는 있으나 `enabledPlugins` 에 없다
- **THEN** 그 확장은 로드되지 않는다

### Requirement: 코어 항목이 확장 항목보다 우선한다
<!-- id: extensions.precedence -->
<!-- entities: Router, Stack -->
<!-- enforced: plugins/nereus/hooks/scripts/lib/router.mjs -->

병합 결과에서 코어가 정의한 라우트·스택이 확장보다 항상 앞에 온다.
라우팅 노출 상한(`MAX_HITS`)은 병합 후에도 그대로 적용되므로, 확장이 코어 스킬을 밀어낼 수 없다.

#### Scenario: 코어와 확장이 같은 프롬프트에 걸린다
- **WHEN** 코어 라우트와 확장 라우트가 모두 정규식에 일치한다
- **THEN** 코어 라우트가 먼저 지목되고, 상한을 넘는 확장 라우트는 노출되지 않는다
