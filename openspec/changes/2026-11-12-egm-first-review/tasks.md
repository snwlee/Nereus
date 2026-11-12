# tasks — egm-first-review

기준선(2026-11-12, Windows): 기존 실패 Test Files 13~14개(목록 `../Nereus/.nereus/baseline-fails.txt`). 완료 조건은 "기준선에 없던 실패 0".

- [x] T1. 리뷰 2차 의견 기본을 EGM 으로
  - Files: Modify `plugins/nereus/skills/review/scripts/review.mjs`, `plugins/nereus/hooks/scripts/lib/config.mjs`, `tests/skills/review-merge.test.ts`, `tests/lib/config.test.ts`, `tests/smoke/no-unwired-exports.test.ts`
  - Interfaces: `REVIEWERS = {ocr, egm(bin:null), codex}` · `EGM_PERSONAS: string[]` · `normalizeReviewers(value) → id[]` · 실행 출력에 `egmPersonas`
  - Steps:
    - [x] 실패 확인: Run `npx vitest run tests/skills/review-merge.test.ts` · Expected: FAIL
    - [x] gemini·agy 리뷰어·프로브 제거, egm 추가, 옛 값 매핑(gemini→egm, both→codex, 오타 배열→기본)
    - [x] 통과 확인: Run 같은 명령 · Expected: PASS
  - Done when: 기본 계획이 OCR+EGM, 전역 설정 `["ocr","gemini"]` 이 OCR+EGM 으로 읽힘(실측)

- [x] T2. 디자인 비평 채널을 impeccable 로
  - Files: Modify `plugins/nereus/skills/design/scripts/design-feedback.mjs`, `plugins/nereus/hooks/scripts/lib/design.mjs`, `plugins/nereus/skills/design/scripts/design-system.mjs`, `tests/skills/design-feedback.test.ts`, `tests/lib/design.test.ts`
  - Interfaces: `RECORD_SOURCE = "impeccable"` · `planRecord({phase, critique, files, hashOf, report, reportPath})` · CLI `record` 는 `--report` (impeccable 원본 파일 경로) 필수
  - Steps:
    - [x] 실패 확인 · Expected: FAIL
    - [x] Gemini·agy 실행 경로 제거, direction|visual 은 안내 + 종료코드 2, 게이트 안내문 교체, 원본 보고서 해시·DEGRADED 거절
    - [x] 통과 확인 · Expected: PASS
  - Done when: 디자인 스크립트에 gemini_cli·agy 참조 없음

- [x] T3. 도구·문서 정리
  - Files: Modify `plugins/nereus/skills/setup/scripts/detect.mjs`, `plugins/nereus/hooks/scripts/session-start.mjs`, `plugins/nereus/hooks/scripts/finish-check.mjs`, 스킬·에이전트 문서 12개, Create `tests/skills/review-channels.test.ts`
  - Interfaces: 없음(문서·도구 목록)
  - Steps:
    - [x] 실패 확인: Run `npx vitest run tests/skills/review-channels.test.ts` · Expected: FAIL
    - [x] codex 필수 해제, agy 행 삭제, 문서의 Gemini 디자인·리뷰 언급과 없어진 명령 지시 교체
    - [x] 통과 확인 · Expected: PASS
  - Done when: 전체 스위트에서 기준선에 없던 실패 0

- [x] T4. EGM 으로 이 변경을 리뷰하고 반영
  - Files: Modify T1~T3 의 파일 (frontend·app 에이전트, finish·setup·spec·review 스킬, design-system.mjs 추가)
  - Interfaces: 없음
  - Steps:
    - [x] goldfish 페르소나 codebase_details·design_critic 로 새 맥락 서브에이전트 2개 병렬 리뷰 → HIGH 2 · MEDIUM 7
    - [x] 실패 확인: 지적마다 테스트를 먼저 추가 · Run `npx vitest run tests/skills/review-channels.test.ts` · Expected: FAIL
    - [x] 통과 확인: Run `npx vitest run` · Expected: 기준선에 없던 실패 0
  - Done when: HIGH·MEDIUM 전부 반영, 새 실패 0

## Global Constraints

- 플러그인 런타임은 Node 표준 라이브러리만.
- Gemini 는 `nereus:image` 에만 남긴다.
