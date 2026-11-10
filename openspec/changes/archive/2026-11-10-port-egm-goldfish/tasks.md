# tasks — elephant-goldfish-model 이식

- [x] T1. goldfish 결정론 코어 (대상·분할·링크·파싱·판정) [wave:1]
  - Files: Create `plugins/nereus/skills/goldfish/scripts/goldfish.mjs` · Test `tests/skills/goldfish.test.ts`
  - Interfaces: Consumes 없음 · Produces `findSplit(text)`, `resolveTarget(target, cwd)`, `collectLinks(docPath, text, cwd)`, `stagesFor(mode)`, `parseReport(md)`, `judgeRound(ledger, round)`, `toSeverity(sev)`, `planReview(target, opts)`
  - Steps:
    - [ ] 실패 테스트 작성: spec.md `goldfish.target`·`goldfish.links`·`goldfish.judge` 의 시나리오마다 `it` 하나씩, 임시 디렉터리(`fs.mkdtempSync`)에 문서를 만들어 검증
    - [ ] 실패 확인: Run `npx vitest run tests/skills/goldfish.test.ts` · Expected: FAIL (모듈 없음)
    - [ ] 최소 구현: Node 표준 라이브러리만으로 위 함수 구현, CLI `plan`·`parse`·`judge`
    - [ ] 통과 확인: Run `npx vitest run tests/skills/goldfish.test.ts` · Expected: PASS
  - Done when: goldfish 테스트 전부 통과, CLI `plan` 이 페르소나·표준 절대 경로를 낸다

- [x] T2. drift 참조 판정 [wave:1]
  - Files: Create `plugins/nereus/skills/drift/scripts/drift.mjs` · Test `tests/skills/drift.test.ts`
  - Interfaces: Consumes 없음 · Produces `extractRefs(md)`, `checkRefs(refs, deps)`, `listDocs(target)`, `driftReport(targets, deps)`
  - Steps:
    - [ ] 실패 테스트 작성: spec.md `drift.refs` 시나리오 두 개 + 경로의 `:줄번호` 제거, URL 무시, 심볼 grep 주입
    - [ ] 실패 확인: Run `npx vitest run tests/skills/drift.test.ts` · Expected: FAIL
    - [ ] 최소 구현: 펜스 제외 추출, 문서 폴더·루트 양쪽 존재 확인, `git grep -w` 로 심볼 확인
    - [ ] 통과 확인: Run `npx vitest run tests/skills/drift.test.ts` · Expected: PASS
  - Done when: drift 테스트 통과, 이 저장소의 `openspec/specs` 에 CLI 를 돌려 JSON 이 나온다

- [x] T3. 페르소나·표준·라이선스 반입
  - Files: Create `plugins/nereus/skills/goldfish/personas/*.md` 9개 · `plugins/nereus/skills/goldfish/standards/*.md` 5개 · `plugins/nereus/NOTICE` · `plugins/nereus/LICENSES/Apache-2.0.txt`
  - Interfaces: Consumes T1 `planReview` 의 경로 규칙 · Produces 없음
  - Steps:
    - [ ] 원본 `agents/` 에서 bootstrap_orchestrator 를 뺀 9개, `resources/document_standards/` 5개 복사
    - [ ] synthesizer 의 디렉터리 줄을 `personas/`·`standards/` 로 수정, NOTICE 의 수정 파일 목록에 기록
    - [ ] 확인: Run `npx vitest run tests/skills/goldfish.test.ts` · Expected: PASS (plan 이 가리키는 파일 존재 테스트 포함)
  - Done when: plan 이 내는 모든 경로가 존재한다

- [x] T4. 스킬 문서와 spec 연결
  - Files: Create `plugins/nereus/skills/goldfish/SKILL.md` · `plugins/nereus/skills/drift/SKILL.md` · Modify `plugins/nereus/skills/spec/SKILL.md`
  - Interfaces: Consumes T1·T2 CLI · Produces 없음
  - Steps:
    - [ ] goldfish: 단계표, 서브에이전트 프롬프트 형식, 해소 4분류, 자동 적용·ESCALATE 질문, 수렴 판정 CLI
    - [ ] drift: CLI 실행 → 누락 참조 → 의미 드리프트 확인 → `docs/drift/YYYY-MM-DD.md`
    - [ ] spec §3: medium/large 면 build 전에 goldfish
    - [ ] 확인: Run `npx vitest run tests/skills/prompt-audit.test.ts` · Expected: PASS
  - Done when: 세 문서 저장, prompt-audit 통과

- [x] T5. 라우터 [wave:2]
  - Files: Modify `plugins/nereus/hooks/scripts/lib/router.mjs` · Test `tests/lib/router.test.ts`
  - Interfaces: Consumes 없음 · Produces `ROUTES` 에 `nereus:goldfish`, `nereus:drift`
  - Steps:
    - [ ] 실패 테스트 작성: "설계 문서 리뷰해줘" → goldfish 가 첫 번째, "스펙이랑 코드 드리프트 봐줘" → drift, "코드 리뷰해줘" 는 goldfish 아님
    - [ ] 실패 확인: Run `npx vitest run tests/lib/router.test.ts` · Expected: FAIL
    - [ ] 최소 구현: 두 라우트 추가 (goldfish 는 design·spec·review 앞)
    - [ ] 통과 확인: Run `npx vitest run tests/lib/router.test.ts` · Expected: PASS
  - Done when: 라우터 테스트 전부 통과

- [x] T6. 버전·문서
  - Files: Modify `plugins/nereus/.claude-plugin/plugin.json` · `.claude-plugin/marketplace.json` · `README.md` · `README.ko.md`
  - Interfaces: Consumes 없음 · Produces 없음
  - Steps:
    - [ ] 0.28.0 으로 올리고 README 스킬 목록에 두 스킬 추가
    - [ ] 확인: Run `npm test` · Expected: PASS
  - Done when: 전체 테스트 통과

## Global Constraints

- 플러그인 런타임은 Node 20+ 표준 라이브러리만. 테스트는 vitest.
- 페르소나·표준 본문은 원문 영어를 유지한다.
- 테스트는 `NEREUS_HOME` 을 임시 디렉터리로 격리한다(전역 설정을 읽는 경우).
