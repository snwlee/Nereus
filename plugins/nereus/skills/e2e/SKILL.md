---
name: e2e
description: E2E for [flow] tasks: Playwright on web, Patrol on Flutter, REST Assured on Spring. Run by qa right before review. 트리거: "E2E", "사용자 흐름 테스트".
---

# e2e

nereus:common 규칙을 따른다. 담당: qa.

## 1. 대상 선정
tasks 파일에서 `[flow]` 태그가 있고 이번 작업 단위에 포함된 태스크만. 그 외는 유닛/통합 테스트가 담당한다.

## 2. 스택별 실행

| 스택 | 도구 | 위치 | 명령 |
|---|---|---|---|
| 웹 | Playwright | `e2e/*.spec.ts` | `npx playwright test` |
| Flutter | integration_test + Patrol | `integration_test/*_test.dart` | `patrol test` (권한·알림 필요 시), 아니면 `flutter test integration_test` |
| Spring | REST Assured + Testcontainers | `src/test/java/**/*E2ETest.java` | `./gradlew test --tests '*E2ETest'` |

세팅이 없으면 `references/<도구>.md`대로 한 번 제안하고 승인 시 적용한다. 웹은 공식 `webapp-testing` 스킬의 Playwright 지침을 우선 참고한다.

**회귀 스위트는 Playwright, 손으로 따라가는 확인·증거 수집은 `agent-browser`** 다. 브라우저는 `agent-browser` CLI 가 1순위다 — 처음 쓰기 전에 `agent-browser skills get core` 를 읽고 따른다(`open` → `snapshot -i` → `@eN` 으로 조작 → 다시 읽어 확인 → `close`).
- 흐름 재현: `agent-browser open <url>` → `snapshot -i` → `click @e3`·`fill @e5 "값"` → `get url`·`snapshot` 으로 결과 확인. 가려지거나 비활성인 대상은 성공으로 보고하지 않고 실패한다.
- 증거: `agent-browser screenshot .nereus/e2e-artifacts/<흐름>.png`, 콘솔은 `agent-browser console`·페이지 에러는 `agent-browser errors`, 녹화는 `agent-browser record start <경로>`.
- 로그인된 내 Chrome 에 붙는 `--auto-connect`·`--cdp` 는 **사용자가 그 세션을 쓰라고 한 때만** 쓴다. 실계정에서 저장·전송·결제는 승인 없이 하지 않는다.

## 3. 규칙
- 대기는 결정적으로(요소 상태, 응답 완료). `sleep`·고정 타임아웃 금지.
- 실패 시 2회 재시도. 3회 모두 실패 → 게이트 차단, build로 돌려보낸다(테스트 통과를 위해 제품 코드를 여기서 고치지 않는다).
- 간헐 실패(성공·실패 혼재)는 `.nereus/e2e-quarantine.json`에 `{test, reason, since}`로 격리하고 사용자에게 알린다. 삭제하지 않는다.
- 스크린샷·트레이스는 `.nereus/e2e-artifacts/`에.

## 4. 출력
`.nereus/e2e-report.md`: 흐름별 통과/실패/격리, 아티팩트 경로, 게이트 판정. 통과면 nereus:review.
