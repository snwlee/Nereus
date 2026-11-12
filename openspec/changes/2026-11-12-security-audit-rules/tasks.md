# tasks — security-audit-rules

기준선: `../Nereus/.nereus/baseline-fails.txt`. 완료 조건은 "기준선에 없던 실패 0".

- [x] T1. 반증 판정 적용 함수
  - Files: Modify `plugins/nereus/skills/review/scripts/review.mjs` · Create `tests/skills/security-rules.test.ts`
  - Interfaces: `SECURITY_REFUTER_PERSONA: string` · `refutationTargets(findings) → findings` · `applyRefutations(findings, verdicts) → {findings, rejected}`
  - Steps:
    - [x] 실패 확인: Run `npx vitest run tests/skills/security-rules.test.ts` · Expected: FAIL
    - [x] 구현(불변, 판정 없음·모르는 판정은 차단 유지, confirmed 심각도는 내리기만)
    - [x] 통과 확인: Run 같은 명령 · Expected: PASS
  - Done when: 12개 테스트 통과

- [x] T2. 페르소나·에이전트·스킬 문서
  - Files: Create `plugins/nereus/skills/goldfish/personas/security_refuter.md`, `plugins/nereus/skills/review/references/security/{ai-and-llm,supply-chain-and-release}.md` · Modify `plugins/nereus/agents/security.md`, `plugins/nereus/skills/review/SKILL.md`, `plugins/nereus/skills/setup/SKILL.md`
  - Interfaces: 없음
  - Steps:
    - [x] 실패 확인 · Expected: FAIL (문서 검사)
    - [x] 작성
    - [x] 통과 확인 · Expected: PASS
  - Done when: 전체 스위트에서 기준선에 없던 실패 0

## Global Constraints

- 가져온 문서에는 출처(저장소·커밋·MIT·저작권자)를 남긴다.

- [x] T3. SkillSpector 설치 게이트를 실제 CLI·보고서에 맞춘다
  - Files: Modify `plugins/nereus/skills/skill-audit/scripts/scan-gate.mjs`, `plugins/nereus/skills/skill-audit/SKILL.md` · Create `tests/skills/skill-tooling.test.ts`
  - Interfaces: `scanGate(report) → {install, blocking[], warnings[], incomplete}` · CLI `node scan-gate.mjs <report.json>` 종료 코드 0/1
  - Steps:
    - [x] 실패 확인: Run `npx vitest run tests/skills/skill-tooling.test.ts` · Expected: FAIL
    - [x] `issues` 키 읽기, `execution_successful:false` 차단, 불완전 분석 경고, CLI 진입점, 문서 `--format json`
    - [x] 통과 확인 · Expected: PASS — 실제 보고서(cloudflare 스킬)로 HIGH 7 차단·종료 코드 1 확인
  - Done when: 2.11 실제 보고서를 형식 깨짐으로 막지 않는다

- [x] T4. 플러그인 전체 검증과 frontmatter 엄격 YAML
  - Files: Modify `plugins/nereus/skills/skill-audit/SKILL.md`, frontmatter 가 있는 에이전트·스킬 35개, `plugins/nereus/skills/phone/SKILL.md`
  - Interfaces: 없음
  - Steps:
    - [x] 실패 확인 · Expected: FAIL (35개 파일)
    - [x] `: `·` #` 가 든 따옴표 없는 값을 JSON 문자열로 감싼다, phone 예시 번호를 자리표시자로
    - [x] 통과 확인: PyYAML safe_load 48/48 · Expected: PASS
  - Done when: 전체 스위트에서 기준선에 없던 실패 0
