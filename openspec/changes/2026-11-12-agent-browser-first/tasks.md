# tasks — agent-browser-first

기준선(2026-11-12, Windows): `../Nereus/.nereus/baseline-fails.txt`. 완료 조건은 "기준선에 없던 실패 0".

- [x] T1. 상주 browser MCP 제거와 agent-browser 1순위 안내
  - Files: Modify `plugins/nereus/.mcp.json`, `plugins/nereus/agents/{frontend,qa,seo}.md`, `plugins/nereus/skills/{e2e,seo,setup,research,computer-use}/SKILL.md`, `plugins/nereus/skills/research/scripts/cloak.mjs` · Create `tests/skills/browser-channel.test.ts`
  - Interfaces: 없음(설정·문서)
  - Steps:
    - [x] 실패 확인: Run `npx vitest run tests/skills/browser-channel.test.ts` · Expected: FAIL (9개)
    - [x] browser 서버·`mcp__plugin_nereus_browser__*` 도구 제거, agent-browser·`skills get core` 안내, seo 는 npx lighthouse + TBT
    - [x] 통과 확인: Run 같은 명령 · Expected: PASS
  - Done when: 플러그인 어디에도 `mcp__plugin_nereus_browser` 가 없다

- [x] T2. agent-browser 를 필수 도구로 감지
  - Files: Modify `plugins/nereus/skills/setup/scripts/detect.mjs`, `plugins/nereus/hooks/scripts/session-start.mjs`
  - Interfaces: `TOOLS` 에 `{bin:"agent-browser", required:true, group:"코어"}` · `REQUIRED_TOOLS` 에 `"agent-browser"`
  - Steps:
    - [x] 실패 확인 · Expected: FAIL (`toolStatusCached` 누락 목록에 없음)
    - [x] 행·목록 추가
    - [x] 통과 확인 · Expected: PASS
  - Done when: 전체 스위트에서 기준선에 없던 실패 0

## Global Constraints

- Playwright 회귀 스위트는 건드리지 않는다.
- mcp-doctor 진단 패턴은 유지한다.
