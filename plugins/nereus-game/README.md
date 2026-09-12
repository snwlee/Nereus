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
| Unity (2D 폰) | **동작** | Unity Test Framework (`-batchmode -nographics`) |
| Nintendo Switch | **경계·절차 동작** (실기기 검증은 승인 필요) | 빌드 명령은 설정에서 읽음 |

## 도메인 스킬 (엔진 무관)

`level` · `narrative` · `gameux` · `asset` · `balance` — 전부 특정 엔진 문법을 담지 않는다.
메인 플랫폼이 없고 로블록스와 2D 폰게임을 동시에 대응해야 하므로, 도메인 지식이 엔진에 묶이면 두 벌이 된다.
테스트가 이것을 강제한다(`tests/smoke/game-domain.test.ts`).

## 장르 프로파일

장르는 코드 분기가 아니라 `profiles/*.json` 데이터다. 장르 추가 = 파일 한 장.

| 프로파일 | 루프 | 주 실패 양상 |
|---|---|---|
| `sim-tycoon` | 수집 → 판매 → 재투자 → 확장 | 병목 (다음 단계 도달 불가) |
| `obby-platformer` | 도전 → 실패 → 재시도 → 통과 | 난이도 절벽 |

알 수 없는 장르는 **던진다.** 기본값으로 떨어지면 수치가 그럴듯한 채로 틀린다.

## 밸런싱 시뮬레이터

`lib/balance-sim.mjs` — 결정론적(seed 기반). 경제 정의를 N턴 돌려
`bottlenecks` · `inflation` · `cliffs` 를 수치로 낸다. 같은 입력이면 같은 출력이라 게이트로 쓸 수 있다.

## 훅

`PostToolUse(Edit|Write|MultiEdit)` — `.luau`/`.lua` 편집 후 StyLua 포맷 + selene 린트.

- **로블록스 프로젝트에서만** 돈다(`default.project.json` 기준). `rokit` 셰임이 PATH 에 있어도
  프로젝트 밖에서는 실행하지 않는다.
- 도구가 **없으면** 조용히 건너뛴다(종료 코드 0). 도구가 **찾은 위반**은 stderr 경고로 올린다.

## NDA 경계

Switch 개발을 위해 **NDA 구역의 외부 전송만** 차단한다(PreToolUse `nda-guard`).
읽기·편집은 막지 않는다 — 막으면 개발 자체가 안 된다.

- 기본 구역: `Platform/Switch/**` · `**/NintendoSDK/**` · `**/*.nx.*`
- 차단 대상: 그 경로를 `codex`·`agy`·`ocr`·`curl`·`gh` 등에 넘기는 Bash 명령
- 기본값은 **차단**. 경고로 낮추는 것은 의식적 행위여야 한다
- Lotcheck 체크리스트 본문은 저장소에 없다(항목 자체가 NDA). `.nereus/lotcheck/` 에서 읽는다

## 외부 도구

`rojo` · `lune` · `stylua` · `selene` · `luau-lsp` (전부 선택. 없으면 해당 게이트만 꺼진다)
