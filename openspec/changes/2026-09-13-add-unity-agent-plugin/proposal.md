# add-unity-agent-plugin

## Why

Unity 가 **Claude Code 공식 플러그인**을 냈다(`unity@unity-agent-plugin`).
스킬 29개 + Unity CLI + Unity MCP 서버(에디터 실시간 제어)가 한 번에 들어온다.
Claude Code 가 첫 지원 에이전트이고, Unity 팀이 직접 쓰고 보안 검토하며 엔진 업데이트와 함께 갱신한다.

커버 범위가 우리 게임 도메인과 정면으로 겹친다 — UI(`ui-uitk`·`ui-ugui`), 2D·타일맵 7종,
사운드 3종, 현지화(CJK 폰트 포함), 수익화(`implement-in-app-purchases`·`levelplay-unity-integration`),
라이브옵스(`build-live-game`), 성능(`optimize-web`·`urp-postprocessing`).

**겹치지만 층이 다르다.** Nereus 는 프로세스 하네스(intake→spec→build→e2e→review→finish + 게이트)이고
Unity 플러그인은 엔진 도메인 실행 팩이다. 그래서 **흡수가 아니라 위임**이다.
엔진 API 절차를 우리가 베껴 적으면 엔진 업데이트마다 즉시 낡는다 —
`policy.json` 을 출처·확인일과 함께 데이터로 둔 것과 같은 이유다.
**남이 정하고 남이 바꾸는 값은 우리가 들고 있지 않는다.**

### 그런데 지금은 위임할지 말지를 판정할 수 없다

`unity` 스킬은 플러그인의 존재를 모른다. 설치돼 있어도 우리 절차만 돌고,
설치돼 있지 않은데 위임을 지시하면 없는 스킬을 부른다.
**판정 없이 문서로만 "쓰면 좋다"고 적으면 아무 일도 일어나지 않는다.**

### Unity 문서가 스스로 적은 한계

> 단순 uGUI 작업은 개선 폭이 작고, Sonnet 5 에서는 주로 **정확성**을 보탤 뿐 기능 대부분은 플러그인 없이도 만든다.

도입 근거는 "빨라진다"가 아니라 **"API 오답과 버전 드리프트가 줄어든다"** 이다. 스킬에 그대로 적는다.

## What Changes

- `lib/unity-stack.mjs` — `detectUnityAgentPlugin` 추가. 설치·활성·스코프를 판정한다.
  **미설치와 "확인 못 함"을 구분한다** — 인벤토리를 못 읽었을 때 `absent` 를 돌려주면
  설치돼 있는데도 위임을 안 하게 되고, 그 사실이 어디에도 안 남는다.
  `Ruling: 근사 판정은 결과에 근사임을 표시한다` 와 같은 자리다.
- `skills/unity/SKILL.md` — 위임 규칙. 무엇을 넘기고 **무엇을 우리가 계속 쥐는지**(게이트 전부),
  스코프 권고(user 전역 아님), 그리고 Unity 문서가 밝힌 한계.
- `skills/compliance/SKILL.md` — 판정 통과 후 IAP·LevelPlay **배선**은 Unity 스킬로 넘긴다는 한 줄.
  규정 판정 자체는 계속 우리 것이다(엔진과 무관하다).

## Impact

- 영향 스펙: `game-harness` (요구사항 2개 추가)
- 영향 코드: `plugins/nereus-game/lib/unity-stack.mjs`, 스킬 문서 2개
- **코어 `plugins/nereus` 는 바뀌지 않는다.** 확장은 데이터와 자기 lib 안에서 끝난다.
- 로블록스(Luau)와 무관하다. 이 변경은 **Unity 스택 갈래에만** 걸린다.
