# plugin-packaging

Last verified: 2026-09-12 (commit fbf2753)

## Purpose

이 저장소가 Claude Code 마켓플레이스로서 플러그인을 등록·배선·발견시키는 계약을 정의한다.
새 플러그인(예: 게임 하네스)이 지켜야 할 기준선이며, 특히 **스킬 라우팅의 소유권**이 어디에 있는지를 명시한다.
현재 등록된 플러그인은 `nereus`(코어 하네스)와 `credstore`(MCP 전용) 둘이다.

## Requirements

### Requirement: 플러그인은 마켓플레이스 매니페스트에 등재되어야 한다
<!-- id: marketplace.plugins -->
<!-- entities: Marketplace, Plugin -->
<!-- enforced: .claude-plugin/marketplace.json -->

플러그인은 루트 `.claude-plugin/marketplace.json` 의 `plugins` 배열에 항목을 가져야 한다.
항목은 `name`, `description`, `source`(저장소 상대경로), `category`, `version`, `author` 를 가진다.
등재되지 않은 디렉터리는 `plugins/` 아래에 있어도 설치 대상이 아니다.

#### Scenario: 등재되지 않은 플러그인 디렉터리
- **WHEN** `plugins/<name>/` 이 존재하지만 `marketplace.json` 의 `plugins` 에 항목이 없다
- **THEN** `/plugin install <name>@nereus` 로 설치되지 않는다

### Requirement: 플러그인은 자체 매니페스트를 가져야 한다
<!-- id: plugin.manifest -->
<!-- entities: Plugin -->
<!-- enforced: plugins/*/.claude-plugin/plugin.json -->

각 플러그인은 `<source>/.claude-plugin/plugin.json` 을 가지며 `name`, `version`, `description`, `author`, `license` 를 채운다.
`name` 은 마켓플레이스 항목의 `name` 과 같아야 한다.

#### Scenario: 이름 불일치
- **WHEN** `plugin.json` 의 `name` 이 `marketplace.json` 항목의 `name` 과 다르다
- **THEN** 설치·갱신 시 어느 쪽을 가리키는지 확정할 수 없어 배선이 깨진다

### Requirement: 훅은 Node 스크립트로 작성하고 플러그인 루트 변수로 참조한다
<!-- id: hooks.node -->
<!-- entities: Plugin, Hook -->
<!-- enforced: plugins/nereus/hooks/hooks.json -->

훅은 `<source>/hooks/hooks.json` 에 선언하고, 각 명령은
`node "\${CLAUDE_PLUGIN_ROOT}/hooks/scripts/<name>.mjs"` 형태로 쓴다.
셸 스크립트(`bash *.sh`)를 쓰지 않는다 — 이 하네스는 macOS 와 Windows 를 함께 지원하기 때문이다.
절대경로를 박지 않는다.

#### Scenario: 셸 훅 도입 시도
- **WHEN** 플러그인이 `bash hooks/foo.sh` 형태의 훅을 선언한다
- **THEN** Windows 환경에서 훅이 실행되지 않아 해당 게이트가 조용히 비활성화된다

### Requirement: MCP 서버는 플러그인 루트의 .mcp.json 으로 선언한다
<!-- id: plugin.mcp -->
<!-- entities: Plugin -->
<!-- enforced: plugins/credstore/.mcp.json -->

MCP 서버를 제공하는 플러그인은 `<source>/.mcp.json` 에 `mcpServers` 를 선언한다.
`credstore` 처럼 MCP 만 제공하는 플러그인은 훅·스킬·에이전트 없이 매니페스트와 `.mcp.json` 만으로 성립한다.

#### Scenario: MCP 전용 플러그인
- **WHEN** 플러그인이 `.claude-plugin/plugin.json` 과 `.mcp.json` 만 가진다
- **THEN** 유효한 플러그인으로 설치되며 MCP 도구만 제공한다

<!-- deferred: plugins/nereus/hooks/scripts/session-start.mjs 전체, lib/plugin-inventory.mjs, lib/wiring.mjs -->

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
