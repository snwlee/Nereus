# tasks — add-threert-scan

기준선: 기존 3d-harness 스펙(역스펙 기준선)과 tests/lib/scene-scan·render-budget·three-budget-data, tests/smoke/three-* 통과 유지.

- [x] T1. 호환 데이터 + 검사기
  - Files: Create `plugins/nereus-3d/threert-compat.json`, `plugins/nereus-3d/lib/threert-scan.mjs`, `tests/lib/threert-scan.test.ts`; Modify `plugins/nereus-3d/lib/scene-scan.mjs`(stripNoise export)
  - Interfaces: `scanThreeRT({sources, data}) → {applies, violations, warnings, unmeasured}` · `loadThreeRTData()`
  - Steps: 실패 확인(`npx vitest run tests/lib/threert-scan.test.ts` FAIL) → 구현 → PASS
  - Done when: 스펙 시나리오 전부 테스트로 통과
- [x] T2. 스킬·라우트·에이전트·문서 배선
  - Files: Create `plugins/nereus-3d/skills/threert/SKILL.md`; Modify `nereus-extension.json`, `agents/graphics-engineer.md`, `README.md`, `skills/threejs/SKILL.md`, `skills/renderbudget/SKILL.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
  - Done when: `npx vitest run tests/smoke` 의 three-*·no-unwired-exports 통과, CLI 실측 1회
