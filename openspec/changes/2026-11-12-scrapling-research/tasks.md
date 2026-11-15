# tasks — scrapling-research

기준선: `../Nereus/.nereus/baseline-fails.txt`. 완료 조건은 "기준선에 없던 실패 0".

- [x] T1. scrape.mjs — 2단계 확보와 차단 판정
  - Files: Create `plugins/nereus/skills/research/scripts/scrape.mjs`, `tests/skills/research-scrape.test.ts`
  - Interfaces: `blockedReason(text) → string|null` · `planSteps(url, outDir) → step[]` · `scrapeEscalate(url, outDir, deps) → {ok, method, file, chars, tried[]}`
  - Steps:
    - [x] 실패 확인: Run `npx vitest run tests/skills/research-scrape.test.ts` · Expected: FAIL
    - [x] 구현
    - [x] 통과 확인 · Expected: PASS — 실측 zillow get ok · glassdoor get→fetch ok · g2 둘 다 막힘(종료 코드 1)
  - Done when: 차단 화면이 ok:true 로 나가지 않는다

- [x] T2. CloakBrowser 경로 제거와 setup·문서 교체
  - Files: Delete `plugins/nereus/skills/research/scripts/cloak.mjs`, `tests/lib/cloak.test.ts` · Modify `plugins/nereus/skills/research/SKILL.md`, `plugins/nereus/skills/setup/scripts/detect.mjs`, `tests/skills/setup-detect.test.ts`
  - Interfaces: `TOOLS` 에 `{bin:"scrapling", required:false}`, cloakbrowser 행 삭제
  - Steps:
    - [x] 실패 확인 · Expected: FAIL
    - [x] 교체
    - [x] 통과 확인 · Expected: PASS
  - Done when: 전체 스위트에서 기준선에 없던 실패 0
