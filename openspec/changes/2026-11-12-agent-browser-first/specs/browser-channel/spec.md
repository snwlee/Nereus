# browser-channel

nereus 가 브라우저를 어떤 채널로 쓰는지 정한다.

## ADDED Requirements

### Requirement: 브라우저 MCP 를 상주시키지 않는다
<!-- id: browser.noResidentMcp -->
<!-- entities: PluginConfig -->
<!-- enforced: tests/skills/browser-channel.test.ts -->

`.mcp.json` 에 `browser`(chrome-devtools-mcp) 서버가 없고 `context7` 만 남는다. 어떤 에이전트·스킬도 `mcp__plugin_nereus_browser__*` 도구를 가리키지 않는다.

#### Scenario: 세션 시작
- **WHEN** nereus 가 켜진 세션이 시작된다
- **THEN** chrome-devtools-mcp 프로세스가 뜨지 않는다

### Requirement: 브라우저 작업은 agent-browser 가 1순위다
<!-- id: browser.agentBrowserFirst -->
<!-- entities: Agent, Skill, SetupTool -->
<!-- enforced: tests/skills/browser-channel.test.ts -->

frontend·qa 에이전트와 e2e 스킬은 브라우저 확인에 `agent-browser` 를 쓰고, 처음 쓰기 전에 `agent-browser skills get core` 를 읽으라고 안내한다.
setup 은 agent-browser 를 필수 도구로 감지하고 세션 시작은 누락을 알린다.

#### Scenario: 도구 누락
- **WHEN** agent-browser 가 PATH 에 없다
- **THEN** 세션 시작 누락 목록에 `agent-browser` 가 있다

### Requirement: Lighthouse 는 npx 로 돌고 INP 를 지어내지 않는다
<!-- id: browser.lighthouseNpx -->
<!-- entities: Skill -->
<!-- enforced: tests/skills/browser-channel.test.ts -->

seo 스킬은 `npx -y lighthouse` 로 모바일·데스크톱을 측정한다. 실험실 측정은 INP 를 내지 않으므로 TBT 를 대리 지표로 적고, INP 는 실사용 데이터가 있을 때만 적는다.

#### Scenario: CWV 감사
- **WHEN** seo 감사가 Core Web Vitals 를 잰다
- **THEN** 표에 LCP·CLS·TBT 가 있고 실험실 INP 값은 없다
