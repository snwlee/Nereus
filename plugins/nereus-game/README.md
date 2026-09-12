# nereus-game

게임 개발 하네스. `nereus` 코어의 워크플로(intake → spec → build → review → finish) 위에서
**게임 도메인과 엔진 어댑터만** 담당한다. 워크플로 스킬을 복제하지 않는다.

## 왜 별도 플러그인인가

- 코어 라우터는 한 프롬프트당 스킬 2개(`MAX_HITS`)만 지목한다. 게임 라우트를 코어에 섞으면
  웹·앱 작업 프롬프트에서 자리를 뺏는다.
- 완료의 정의가 다르다. 코어의 finish 는 커밋·아카이브, 게임은 롤아웃·지표 관측이다.

## 붙는 방식

`nereus-extension.json` 이라는 **순수 데이터 파일**로 코어 확장점에 붙는다. 코어는 이 파일을
읽기만 하고 코드를 `import()` 하지 않는다 — 형제 플러그인의 런타임 오류가 코어 훅을 죽이면 안 된다.

```json
{
  "routes": [{ "skill": "nereus-game:roblox", "why": "…", "re": "roblox|rojo|luau" }],
  "stacks": [{ "name": "roblox", "marker": "default.project.json",
               "runnerMarker": "lune.yaml", "runner": "lune", "command": "lune run tests" }]
}
```

코어 라우트·스택이 항상 앞이고, 코어가 러너를 찾으면 확장 러너는 무시된다.

## 지원 스택

| 스택 | 상태 | 테스트 게이트 |
|---|---|---|
| 로블록스 (Rojo + Luau) | **동작** | 1단 `lune` 로컬 · 2단 Open Cloud Luau Execution(finish) |
| Unity (폰) | 미구현 | — |
| Nintendo Switch | 미구현 · NDA 경계 설계 필요 | — |

## 훅

`PostToolUse(Edit|Write|MultiEdit)` — `.luau`/`.lua` 편집 후 StyLua 포맷 + selene 린트.

- **로블록스 프로젝트에서만** 돈다(`default.project.json` 기준). `rokit` 셰임이 PATH 에 있어도
  프로젝트 밖에서는 실행하지 않는다.
- 도구가 **없으면** 조용히 건너뛴다(종료 코드 0). 도구가 **찾은 위반**은 stderr 경고로 올린다.

## 외부 도구

`rojo` · `lune` · `stylua` · `selene` · `luau-lsp` (전부 선택. 없으면 해당 게이트만 꺼진다)
