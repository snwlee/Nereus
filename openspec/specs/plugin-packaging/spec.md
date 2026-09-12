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

### Requirement: 스킬 라우팅은 nereus 코어가 단독 소유하며 확장점이 없다
<!-- id: router.ROUTES -->
<!-- entities: Plugin, Skill, Router -->
<!-- enforced: plugins/nereus/hooks/scripts/lib/router.mjs -->
<!-- uncertainty: 설계 의도인지 미비인지는 코드만으로 판별되지 않는다. 현 상태를 사실로만 기록한다 -->

`router.mjs` 의 `ROUTES` 는 `Object.freeze` 된 하드코딩 배열이며, 외부 파일·형제 플러그인·설정에서
항목을 읽어들이는 경로가 존재하지 않는다. `skill-router.mjs`(UserPromptSubmit)가 `routePrompt()` 로
프롬프트를 라우팅하고, `session-start.mjs` 가 `skillMapBlock()` 으로 스킬맵을 주입한다.
둘 다 이 배열만 본다. 한 프롬프트당 노출은 `MAX_HITS = 2` 로 제한된다.

#### Scenario: 형제 플러그인이 스킬을 추가한 경우
- **WHEN** `nereus` 가 아닌 플러그인이 새 스킬을 제공한다
- **THEN** 그 스킬은 `ROUTES` 에 없으므로 프롬프트 라우팅에도, SessionStart 스킬맵에도 나타나지 않는다.
  사용자가 `/<skill>` 로 직접 부르지 않는 한 발화하지 않는다

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
