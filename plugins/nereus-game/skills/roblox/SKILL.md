---
name: roblox
description: 로블록스 유즈맵 개발 절차 — Rojo 프로젝트 구조, 2단 테스트(lune/Luau Execution), 익스플로잇 방어 리뷰, 롤아웃. 트리거 "로블록스", "유즈맵", "Rojo", "Luau".
---

# roblox

nereus:common 규칙을 따른다. 워크플로(intake → spec → build → review → finish)는 **nereus 코어가 소유한다**.
이 스킬은 그 위에 얹히는 로블록스 고유 절차만 담는다.

## 1. 프로젝트 전제

Rojo 프로젝트여야 한다. `default.project.json` 이 없으면 로블록스 스택으로 인식되지 않고
TDD 게이트도 켜지지 않는다.

| 도구 | 역할 | 없으면 |
|---|---|---|
| `rojo` | 파일 ↔ Studio 동기화, rbxl 빌드 | **필수.** 없으면 이 스킬은 성립하지 않는다 |
| `lune` | 로컬 Luau 단위테스트(초 단위) | TDD 게이트가 꺼진다 |
| `stylua` · `selene` | 포맷·린트 | 편집 훅이 조용히 건너뛴다 |
| `luau-lsp` | 타입체크 | 정적 검사 1단이 빠진다 |

Studio 조작·플레이테스트는 **Roblox Studio 내장 MCP** 를 쓴다
(Assistant ⟩ … ⟩ Manage MCP Servers ⟩ Enable Studio as MCP server).
서드파티 로블록스 MCP 를 새로 설치하지 않는다 — 내장이 스크립트 편집·에셋 생성·Luau 실행·
플레이테스트(시작/정지·스크린샷·입력 시뮬)·API 문서를 모두 덮는다.

## 2. 테스트는 2단이다

| 단 | 무엇을 | 언제 | 명령 |
|---|---|---|---|
| 1 | 순수 Luau 로직 (DataModel 불필요) | build 게이트, 태스크마다 | `lune run tests` |
| 2 | DataModel·Roblox API 의존 통합 | finish 게이트 | Open Cloud **Luau Execution API** |

2단만 쓰면 태스크마다 업로드가 필요해 느리고, 1단만 쓰면 엔진 의존 코드가 검증되지 않는다.
**로직을 DataModel 에서 떼어내는 설계가 곧 1단 커버리지다** — 이것을 spec 단계에서 태스크로 쪼갠다.

finish 단계에서 `lib/roblox-gate.mjs` 의 `robloxStageTwo` 가 2단을 시도한다.
필요한 환경변수는 셋이다 — `ROBLOX_API_KEY` · `ROBLOX_UNIVERSE_ID` · `ROBLOX_PLACE_ID`.
**하나라도 없으면 미설정으로 통과시킨다**(실패가 아니다). 키가 없다고 finish 를 막으면
키 없는 모든 세션에서 마무리가 불가능해진다.

2단 CI 형태(참고용 청사진. `Roblox/place-ci-cd-demo` 는 아카이브된 샘플이라 의존하지 않는다):
`selene` → `stylua --check` → `rojo build` → 업로드 → Luau Execution → 배포.
태스크는 최대 5분, 플레이스당 동시 10개다. 그보다 긴 검증은 쪼갠다.

## 3. 리뷰 — 익스플로잇이 1순위다

멀티플레이어가 기본이고 **클라이언트는 전부 적대적**이다. 리뷰에서 이 순서로 본다.

1. **RemoteEvent/RemoteFunction 이 클라이언트를 신뢰하는가** — 이 플랫폼 1번 취약점이다.
   클라이언트가 보낸 수량·좌표·아이템 id·가격을 서버가 그대로 쓰면 CRITICAL.
   서버가 자기 상태로 재계산하지 않는 모든 경로가 대상이다.
2. **서버 권위 검증** — 거리·쿨다운·소유권·인벤토리 보유 여부를 서버가 다시 확인하는가.
3. **레이트 리밋** — Remote 호출에 상한이 있는가. 없으면 서버가 죽는다.
4. **민감 로직이 LocalScript 에 있는가** — 클라이언트 코드는 전부 읽히고 바뀐다.
5. **DataStore 쓰기** — 실패·재시도·세션 잠금이 있는가. 진행도 소실은 되돌릴 수 없다.

`nereus:security` 에이전트를 이 체크리스트로 투입한다.

## 4. finish 는 커밋이 아니라 롤아웃이다

배포가 즉시 라이브다. 심사가 없으므로 게이트가 사람 쪽에 있다.

1. 되돌릴 방법을 먼저 확보한다 — 이전 플레이스 버전 번호를 기록한다.
2. 올린다. 되돌리기는 이전 버전 되배포다.
3. **지표를 관측한다** — 동시접속·세션 길이·D1 리텐션·에러율. 악화되면 되돌린다.
4. 코드 품질이 아니라 리텐션이 성패를 가른다. 이 판정을 `nereus:finish` 뒤에 붙인다.

## 5. 하지 말 것

- `Roblox/testez`(2024 아카이브)·`jsdotlua/jest-lua`(정체)를 새로 도입하지 않는다.
  런타임 테스트는 `Roblox/jest-roblox`, 로컬은 lune 이다.
- 서드파티 Roblox Studio MCP 를 설치하지 않는다(내장으로 대체됐다).
- 로블록스 프로젝트 밖에서 stylua·selene 를 돌리지 않는다 — rokit 셰임이 PATH 에 있어도
  프로젝트 매니페스트가 없어 실패하고 소음만 난다.
